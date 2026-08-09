"""智能辅导 API — 多轮对话 + SSE流式 + 画像关联 + 安全审核"""

import json
import time
import random
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.agents.tutor_agent import (
    build_tutor_messages, stream_tutor_answer,
    check_follow_up_relevance, build_profile_context,
    extract_learning_state, normalize_learning_state,
)
from app.database import query, execute, insert
from app.safety.content_filter import filter_content

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tutor", tags=["tutor"])


def _json_object(value, default):
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


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


# ─── 会话管理 ────────────────────────────────────────

@router.get("/sessions")
def list_sessions(user_id: int):
    """列出用户所有辅导会话"""
    rows = query(
        "SELECT id, title, messages, learning_state, created_at, updated_at FROM chat_sessions "
        "WHERE user_id = %s AND session_type = 'tutoring' ORDER BY updated_at DESC",
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
    uid = req.user_id
    sid = req.session_id
    question = req.message.strip()
    mode = req.mode
    parent_id = req.parent_id

    if not question:
        raise HTTPException(status_code=400, detail="消息不能为空")

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

    # 图片模式：先做视觉理解，把理解结果注入上下文
    vision_context = None
    if req.images:
        try:
            from app.services.llm import chat_qwen_vision
            images = [{"type": "image_url", "image_url": {"url": img}} for img in req.images]
            vision_context = chat_qwen_vision(
                [{"role": "user", "content": question or "请描述这张图片并讲解相关知识"}],
                images, temperature=0.3, max_tokens=1024,
            )
        except Exception as e:
            logger.error(f"视觉理解失败: {e}")
            vision_context = None

    # 构建LLM消息
    llm_messages = build_tutor_messages(
        question=question,
        mode=mode,
        user_id=uid,
        history=conv_history,
        parent_qa=parent_qa,
        learning_state=learning_state,
    )
    # 若有图片理解结果，作为上下文注入系统消息之后
    if vision_context:
        llm_messages.insert(1, {"role": "system", "content": f"学生上传了图片，你对图片的理解如下，请结合回答：\n{vision_context}"})

    # 生成QA ID
    qa_id = f"qa_{int(time.time() * 1000)}_{random.randint(100, 999)}"

    # 先持久化用户消息：即使客户端中途断开，问题也不会丢失
    user_msg = {"role": "user", "content": question, "id": f"u_{qa_id}", "mode": mode, "timestamp": time.time()}
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

        # 开始事件
        yield f"data: {json.dumps({'type': 'start', 'qa_id': qa_id, 'mode': mode}, ensure_ascii=False)}\n\n"

        try:
            stream = stream_tutor_answer(llm_messages, mode=mode)
            for chunk in stream:
                delta = chunk.choices[0].delta
                text = delta.content if delta and delta.content else ""
                if text:
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
        filtered_answer, audit_result = filter_content(
            full_answer,
            user_id=uid,
            agent_name="tutor",
            content_type="code" if mode == "code" else "text",
            user_input=question,
        )

        # 保存AI回复（保存审核后的版本）
        ai_msg = {"role": "assistant", "content": filtered_answer, "id": qa_id, "mode": mode, "timestamp": time.time()}
        if parent_id:
            ai_msg["parent_id"] = parent_id

        messages_history.append(ai_msg)

        updated_learning_state = extract_learning_state(
            question=question,
            answer=filtered_answer,
            previous=learning_state,
        )

        try:
            execute(
                "UPDATE chat_sessions SET title = %s, messages = %s, learning_state = %s, updated_at = NOW() WHERE id = %s",
                (
                    session_title or question[:80],
                    json.dumps(messages_history, ensure_ascii=False),
                    json.dumps(updated_learning_state, ensure_ascii=False),
                    sid,
                )
            )
        except Exception as e:
            logger.error(f"保存辅导会话失败: {e}")

        # 完成事件
        yield f"data: {json.dumps({'type': 'done', 'qa_id': qa_id, 'session_id': sid, 'learning_state': updated_learning_state}, ensure_ascii=False)}\n\n"
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
