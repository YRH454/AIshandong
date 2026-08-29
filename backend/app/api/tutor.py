"""智能辅导 API — 多轮对话 + SSE流式 + 画像关联 + 安全审核"""

import json
import time
import random
import logging
import re
from threading import Thread
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agents.tutor_agent import (
    build_tutor_messages, stream_tutor_answer,
    check_follow_up_relevance, build_profile_context,
    extract_learning_state, normalize_learning_state,
)
from app.database import query, execute, insert
from app.api.auth import enforce_registered_request
from app.safety.content_filter import filter_content

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/tutor",
    tags=["tutor"],
    dependencies=[Depends(enforce_registered_request)],
)


def _json_object(value, default):
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def _clean_image_value(value, limit: int = 1200) -> str:
    """Normalize values returned by the vision model before storing them in chat history."""
    return " ".join(str(value or "").strip().split())[:limit]


def _parse_image_analysis(raw: str) -> dict:
    """Accept strict JSON when available, with a useful safe fallback for imperfect model output."""
    text = str(raw or "").strip()
    candidate = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        start, end = candidate.find("{"), candidate.rfind("}")
        try:
            parsed = json.loads(candidate[start:end + 1]) if start >= 0 and end > start else {}
        except json.JSONDecodeError:
            parsed = {}

    if not isinstance(parsed, dict):
        parsed = {}
    points = parsed.get("knowledge_points", [])
    if not isinstance(points, list):
        points = []
    knowledge_points = [
        _clean_image_value(point, 80)
        for point in points
        if _clean_image_value(point, 80)
    ][:5]
    recognized_text = _clean_image_value(parsed.get("recognized_text"), 4000)
    summary = _clean_image_value(parsed.get("summary"), 360)
    title = _clean_image_value(parsed.get("title"), 80)
    return {
        "title": title or "图片学习内容",
        "summary": summary or (recognized_text[:180] if recognized_text else "已识别图片内容，可继续讲解或生成练习。"),
        "recognized_text": recognized_text or _clean_image_value(text, 4000),
        "knowledge_points": knowledge_points,
        "course_name": _clean_image_value(parsed.get("course_name"), 80),
        "topic_name": _clean_image_value(parsed.get("topic_name"), 80),
    }


def _image_analysis_prompt(question: str) -> str:
    return f"""你是一位大学课程助教。请识别学生上传的学习图片，并且只返回一个合法 JSON 对象，不要 Markdown、不要解释。

学生问题：{question or '请讲解这张图片'}

JSON 格式：
{{
  "title": "不超过 20 字的题目或内容名称",
  "summary": "一句话说明图片的学习内容",
  "recognized_text": "尽可能忠实提取的题干、选项、公式、代码或重点文字；看不清处标注不清晰",
  "knowledge_points": ["最多 5 个具体知识点"],
  "course_name": "明确可判断的课程名，否则留空",
  "topic_name": "最具体的学习主题，否则留空"
}}"""


def _refresh_learning_state_in_background(
    *,
    session_id: int,
    user_id: int,
    question: str,
    answer: str,
    previous_state: dict,
) -> None:
    """Keep adaptive learning memory off the response-critical path."""
    started = time.perf_counter()
    try:
        updated_state = extract_learning_state(
            question=question,
            answer=answer,
            previous=previous_state,
        )
        execute(
            "UPDATE chat_sessions SET learning_state = %s, updated_at = NOW() WHERE id = %s AND user_id = %s",
            (json.dumps(updated_state, ensure_ascii=False), session_id, user_id),
        )
        logger.info(
            "[chat-timing] sid=%s stage=learning_state_background seconds=%.3f",
            session_id,
            time.perf_counter() - started,
        )
    except Exception:
        logger.exception("background learning-state update failed: sid=%s", session_id)


# ─── 数据模型 ────────────────────────────────────────

class ChatRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    message: str
    mode: str = "text"
    parent_id: str | None = None
    images: list[str] | None = None  # base64 data URI 或 URL，有图时走视觉理解


class FeedbackRequest(BaseModel):
    user_id: int
    session_id: int
    qa_id: str
    helpful: bool


class UpdateSessionRequest(BaseModel):
    title: str | None = None
    is_pinned: bool | None = None


# ─── 会话管理 ────────────────────────────────────────

@router.get("/sessions")
def list_sessions(user_id: int):
    """列出用户所有辅导会话"""
    rows = query(
        "SELECT id, title, messages, learning_state, is_pinned, created_at, updated_at FROM chat_sessions "
        "WHERE user_id = %s AND session_type = 'tutoring' ORDER BY is_pinned DESC, updated_at DESC",
        (user_id,)
    )
    sessions = []
    for r in rows:
        msgs = _json_object(r["messages"], [])
        # 取最后一个问题作为预览
        preview = ""
        for m in reversed(msgs):
            if m.get("role") == "user":
                preview = m["content"][:50]
                break
        if not preview and msgs:
            preview = msgs[0].get("content", "")[:50]
        sessions.append({
            "id": r["id"],
            "title": r.get("title") or preview or "新对话",
            "preview": preview or r.get("title") or "新对话",
            "message_count": len(msgs),
            "is_pinned": bool(r.get("is_pinned")),
            "learning_state": normalize_learning_state(_json_object(r.get("learning_state"), {})),
            "created_at": str(r["created_at"]),
            "updated_at": str(r["updated_at"]),
        })
    return {"sessions": sessions}


@router.post("/sessions/new")
def new_session(user_id: int):
    """新建辅导会话"""
    sid = insert("chat_sessions", {
        "user_id": user_id,
        "session_type": "tutoring",
        "title": "",
        "messages": json.dumps([], ensure_ascii=False),
        "learning_state": json.dumps({}, ensure_ascii=False),
    })
    return {"session_id": sid}


@router.patch("/sessions/{session_id}")
def update_session(session_id: int, req: UpdateSessionRequest, user_id: int):
    """Rename or pin a tutoring session owned by the current user."""
    if req.title is None and req.is_pinned is None:
        raise HTTPException(status_code=400, detail="没有需要更新的会话信息")

    rows = query(
        "SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (session_id, user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="会话不存在")

    changes: list[str] = []
    values: list[object] = []
    if req.title is not None:
        title = " ".join(req.title.strip().split())[:160]
        if not title:
            raise HTTPException(status_code=400, detail="对话名称不能为空")
        changes.append("title = %s")
        values.append(title)
    if req.is_pinned is not None:
        changes.append("is_pinned = %s")
        values.append(req.is_pinned)

    values.extend([session_id, user_id])
    execute(
        f"UPDATE chat_sessions SET {', '.join(changes)}, updated_at = NOW() "
        "WHERE id = %s AND user_id = %s",
        tuple(values),
    )
    return {"session_id": session_id, "status": "updated"}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, user_id: int):
    """Permanently remove a chat record; saved learning artifacts are retained."""
    rows = query(
        "SELECT id FROM chat_sessions WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (session_id, user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="会话不存在或已删除")
    execute(
        "DELETE FROM chat_sessions WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (session_id, user_id),
    )
    return {"session_id": session_id, "status": "deleted"}


# ─── 历史记录 ────────────────────────────────────────

@router.get("/history")
def get_history(user_id: int, session_id: int):
    """获取指定会话的QA历史"""
    rows = query(
        "SELECT title, messages, learning_state FROM chat_sessions WHERE id = %s AND user_id = %s",
        (session_id, user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="会话不存在")
    msgs = _json_object(rows[0]["messages"], [])
    return {
        "title": rows[0].get("title") or "学习对话",
        "messages": msgs,
        "learning_state": normalize_learning_state(_json_object(rows[0].get("learning_state"), {})),
    }


# ─── 核心：流式对话 ────────────────────────────────────

@router.post("/chat")
def tutor_chat(req: ChatRequest):
    """发送消息并流式返回AI回答"""
    request_started = time.perf_counter()
    uid = req.user_id
    sid = req.session_id
    question = req.message.strip()
    mode = req.mode
    parent_id = req.parent_id
    images = req.images or []

    if not question:
        raise HTTPException(status_code=400, detail="消息不能为空")

    if images:
        # 与独立视觉接口使用同一组限制：最多 3 张、单张 data URL 不超过 8 MB。
        # 这一步必须在写入会话前完成，避免无效图片留下半条历史记录。
        from app.api.vision import _validate_images
        _validate_images(images)

    # 垃圾输入检测（纯乱敲/乱码在写库前拦截）
    from app.safety.garbage_detector import detect_garbage_input
    garbage = detect_garbage_input(question, "")
    if garbage["suspicious"]:
        raise HTTPException(status_code=400, detail="请用正常的文字描述你的问题")

    # 获取或创建会话（校验会话归属，防止越权续写他人会话）
    if sid:
        rows = query(
            "SELECT title, messages, learning_state FROM chat_sessions WHERE id = %s AND user_id = %s",
            (sid, uid),
        )
        if not rows:
            raise HTTPException(status_code=404, detail="会话不存在")
        messages_history = _json_object(rows[0]["messages"], [])
        learning_state = normalize_learning_state(_json_object(rows[0].get("learning_state"), {}))
        session_title = rows[0].get("title") or ""
    else:
        sid = insert("chat_sessions", {
            "user_id": uid,
            "session_type": "tutoring",
            "title": question[:80],
            "messages": json.dumps([], ensure_ascii=False),
            "learning_state": json.dumps({}, ensure_ascii=False),
        })
        messages_history = []
        learning_state = normalize_learning_state({})
        session_title = question[:80]

    # 处理追问上下文
    parent_qa = None
    if parent_id:
        for m in messages_history:
            if m.get("id") == parent_id and m.get("role") == "assistant":
                # 找到对应的用户问题
                idx = messages_history.index(m)
                if idx > 0 and messages_history[idx - 1].get("role") == "user":
                    parent_qa = {
                        "question": messages_history[idx - 1]["content"],
                        "answer": m["content"],
                    }
                break

    # 构建对话历史（供LLM参考）
    conv_history = []
    for m in messages_history[-6:]:
        conv_history.append({"role": m["role"], "content": m["content"]})

    # Delay the expensive vision and RAG work until the SSE connection is open.
    vision_context = None
    image_analysis = None
    # 生成QA ID
    qa_id = f"qa_{int(time.time() * 1000)}_{random.randint(100, 999)}"

    # 先持久化用户消息：即使客户端中途断开，问题也不会丢失
    user_msg = {"role": "user", "content": question, "id": f"u_{qa_id}", "mode": mode, "timestamp": time.time()}
    if images:
        user_msg["images"] = images
    if parent_id:
        user_msg["parent_id"] = parent_id
    messages_history.append(user_msg)
    session_title = session_title or question[:80]
    try:
        execute(
            "UPDATE chat_sessions SET title = %s, messages = %s, updated_at = NOW() WHERE id = %s",
            (session_title, json.dumps(messages_history, ensure_ascii=False), sid)
        )
    except Exception as e:
        logger.error(f"保存用户消息失败: {e}")

    def event_gen():
        full_answer = ""
        stream_started = None
        first_chunk_at = None
        # event_gen assigns this after image analysis, so it must be initialized
        # inside the generator for ordinary text-only turns as well.
        vision_context = None

        # Send this before model, image, or RAG work so the client can react at once.
        start_event = {
            'type': 'start',
            'qa_id': qa_id,
            'mode': mode,
            'phase': 'image_analysis' if images else 'retrieving',
        }
        yield f"data: {json.dumps(start_event, ensure_ascii=False)}\n\n"
        logger.info("[chat-timing] sid=%s stage=sse_start seconds=%.3f", sid, time.perf_counter() - request_started)

        if images:
            yield f"data: {json.dumps({'type': 'status', 'phase': 'image_analysis'}, ensure_ascii=False)}\n\n"
            vision_started = time.perf_counter()
            try:
                from app.services.llm import chat_qwen_vision
                vision_images = [{"type": "image_url", "image_url": {"url": image}} for image in images]
                raw_image_analysis = chat_qwen_vision(
                    [{"role": "user", "content": _image_analysis_prompt(question)}],
                    vision_images,
                    temperature=0.3,
                    max_tokens=1024,
                )
                image_analysis = _parse_image_analysis(raw_image_analysis)
                vision_context = "\n".join(filter(None, [
                    image_analysis["summary"],
                    f"识别文字：{image_analysis['recognized_text']}" if image_analysis["recognized_text"] else "",
                    f"知识点：{'、'.join(image_analysis['knowledge_points'])}" if image_analysis["knowledge_points"] else "",
                ]))
                user_msg["image_analysis"] = image_analysis
                execute(
                    "UPDATE chat_sessions SET messages = %s, updated_at = NOW() WHERE id = %s",
                    (json.dumps(messages_history, ensure_ascii=False), sid),
                )
                yield f"data: {json.dumps({'type': 'status', 'phase': 'retrieving', 'image_analysis': image_analysis}, ensure_ascii=False)}\n\n"
                logger.info("[chat-timing] sid=%s stage=vision seconds=%.3f", sid, time.perf_counter() - vision_started)
            except Exception:
                logger.exception("vision understanding failed: sid=%s", sid)
                yield f"data: {json.dumps({'type': 'status', 'phase': 'retrieving', 'image_error': True}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'status', 'phase': 'retrieving'}, ensure_ascii=False)}\n\n"
        context_started = time.perf_counter()
        llm_messages = build_tutor_messages(
            question=question,
            mode=mode,
            user_id=uid,
            history=conv_history,
            parent_qa=parent_qa,
            learning_state=learning_state,
        )
        logger.info(
            "[chat-timing] sid=%s stage=context seconds=%.3f",
            sid,
            time.perf_counter() - context_started,
        )
        if vision_context:
            llm_messages.insert(1, {"role": "system", "content": f"学生上传了图片，你对图片的理解如下，请结合回答：\n{vision_context}"})
        yield f"data: {json.dumps({'type': 'status', 'phase': 'answering'}, ensure_ascii=False)}\n\n"

        try:
            stream_started = time.perf_counter()
            stream = stream_tutor_answer(llm_messages, mode=mode)
            for chunk in stream:
                delta = chunk.choices[0].delta
                text = delta.content if delta and delta.content else ""
                if text:
                    if first_chunk_at is None:
                        first_chunk_at = time.perf_counter()
                        logger.info(
                            "[chat-timing] sid=%s stage=first_token model_seconds=%.3f total_seconds=%.3f",
                            sid,
                            first_chunk_at - stream_started,
                            first_chunk_at - request_started,
                        )
                    full_answer += text
                    yield f"data: {json.dumps({'type': 'chunk', 'content': text}, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"辅导流式生成失败: {e}")
            if not full_answer.strip():
                error_msg = "抱歉，AI辅导暂时出了点问题，请稍后再试。"
                yield f"data: {json.dumps({'type': 'chunk', 'content': error_msg}, ensure_ascii=False)}\n\n"
                full_answer = error_msg
            else:
                logger.warning("千问流已返回正文，忽略结束阶段的连接异常并保存完整回答")

        # 安全审核：对生成内容进行 5 层过滤
        filter_started = time.perf_counter()
        filtered_answer, audit_result = filter_content(
            full_answer,
            user_id=uid,
            agent_name="tutor",
            content_type="code" if mode == "code" else "text",
            user_input=question,
        )
        logger.info("[chat-timing] sid=%s stage=filter seconds=%.3f", sid, time.perf_counter() - filter_started)

        # 保存AI回复（保存审核后的版本）
        ai_msg = {"role": "assistant", "content": filtered_answer, "id": qa_id, "mode": mode, "timestamp": time.time()}
        if parent_id:
            ai_msg["parent_id"] = parent_id

        messages_history.append(ai_msg)

        persist_started = time.perf_counter()
        try:
            execute(
                "UPDATE chat_sessions SET title = %s, messages = %s, updated_at = NOW() WHERE id = %s",
                (
                    session_title or question[:80],
                    json.dumps(messages_history, ensure_ascii=False),
                    sid,
                )
            )
        except Exception as e:
            logger.error(f"保存辅导会话失败: {e}")
        logger.info(
            "[chat-timing] sid=%s stage=persist seconds=%.3f total_seconds=%.3f first_token_seen=%s",
            sid,
            time.perf_counter() - persist_started,
            time.perf_counter() - request_started,
            first_chunk_at is not None,
        )

        Thread(
            target=_refresh_learning_state_in_background,
            kwargs={
                "session_id": sid,
                "user_id": uid,
                "question": question,
                "answer": filtered_answer,
                "previous_state": learning_state,
            },
            daemon=True,
        ).start()

        # 完成事件
        yield f"data: {json.dumps({'type': 'done', 'qa_id': qa_id, 'session_id': sid, 'learning_state': learning_state}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── 反馈 ────────────────────────────────────────

@router.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    """对QA进行点赞/点踩"""
    rows = query("SELECT messages FROM chat_sessions WHERE id = %s AND user_id = %s", (req.session_id, req.user_id))
    if not rows:
        return {"error": "会话不存在"}

    msgs = json.loads(rows[0]["messages"]) if isinstance(rows[0]["messages"], str) else rows[0]["messages"]
    for m in msgs:
        if m.get("id") == req.qa_id:
            m["helpful"] = req.helpful
            break

    try:
        execute(
            "UPDATE chat_sessions SET messages = %s WHERE id = %s",
            (json.dumps(msgs, ensure_ascii=False), req.session_id)
        )
    except Exception:
        pass

    return {"status": "ok"}


# ─── 画像关联检查 ────────────────────────────────────

@router.get("/profile-status")
def check_profile(user_id: int):
    """检查用户是否已有画像"""
    ctx = build_profile_context(user_id)
    return {"has_profile": bool(ctx), "preview": ctx[:200] if ctx else ""}


# ─── 视觉问答入库（图片答疑记入会话历史）───────────────

class VisionRecordRequest(BaseModel):
    user_id: int
    session_id: int | None = None
    question: str = ""
    answer: str
    mode: str = "vision"


@router.post("/vision-record")
def record_vision_qa(req: VisionRecordRequest):
    """把图片答疑(视觉理解)的结果保存进辅导会话历史,保证多模态问答上下文连续"""
    # 获取或创建会话（校验归属）
    sid = req.session_id
    if sid:
        rows = query("SELECT messages FROM chat_sessions WHERE id = %s AND user_id = %s", (sid, req.user_id))
        if not rows:
            return {"error": "会话不存在"}
        messages_history = json.loads(rows[0]["messages"]) if rows else []
    else:
        sid = insert("chat_sessions", {
            "user_id": req.user_id,
            "session_type": "tutoring",
            "title": (req.question or "图片问题")[:80],
            "messages": json.dumps([], ensure_ascii=False),
            "learning_state": json.dumps({}, ensure_ascii=False),
        })
        messages_history = []

    qa_id = f"vision_{int(time.time() * 1000)}_{random.randint(100, 999)}"
    now = time.time()
    user_msg = {"role": "user", "content": req.question or "（图片问题）", "id": f"u_{qa_id}", "mode": "vision", "timestamp": now}
    ai_msg = {"role": "assistant", "content": req.answer, "id": qa_id, "mode": "vision", "timestamp": now}
    messages_history.append(user_msg)
    messages_history.append(ai_msg)
    try:
        execute(
            "UPDATE chat_sessions SET messages = %s, updated_at = NOW() WHERE id = %s",
            (json.dumps(messages_history, ensure_ascii=False), sid)
        )
    except Exception as e:
        logger.error(f"保存视觉问答失败: {e}")
    return {"session_id": sid, "qa_id": qa_id, "saved": True}
