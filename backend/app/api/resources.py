"""个性化学习资源 API：需求规划、并行生成、SSE 进度与资源包管理。"""
from __future__ import annotations

import json
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.agents.resources_agent import (
    AGENT_META, AGENT_RUNNERS, DEFAULT_TYPES, build_package_overview,
    orchestrate, run_agent, run_agents,
)
from app.services.profile_db import get_chat_session_by_id, get_profile
from app.database import query, execute, insert
from app.api.auth import enforce_registered_request
from app.services.resources_db import (
    create_package, get_media_by_package, get_package, get_resource_session,
    list_packages, list_resource_sessions, save_package_resources,
    save_resource_session,
)

import logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/resources",
    tags=["resources"],
    dependencies=[Depends(enforce_registered_request)],
)


def _event(payload: dict | str) -> str:
    data = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    return f"data: {data}\n\n"


def _latest_plan(messages: list) -> dict | None:
    for message in reversed(messages):
        plan = message.get("plan") if isinstance(message, dict) else None
        if isinstance(plan, dict) and plan.get("agents"):
            return plan
    return None


def _session(user_id: int, session_id: int | None):
    session = get_chat_session_by_id(session_id) if session_id else get_resource_session(user_id)
    if session and int(session.get("user_id", user_id)) != user_id:
        raise HTTPException(403, "该会话不属于当前用户")
    return session


def _student_profile(user_id: int) -> dict | None:
    try:
        record = get_profile(user_id)
        return record.get("profile") if record else None
    except Exception:
        return None


def _bind_runtime_user(plan: dict, user_id: int) -> dict:
    """Attach the authenticated owner to agent params used by async workers."""
    for agent in plan.get("agents", []):
        if not isinstance(agent, dict):
            continue
        params = agent.setdefault("params", {})
        if isinstance(params, dict):
            params["user_id"] = int(user_id)
    return plan


@router.get("/sessions")
def sessions(user_id: int):
    return {"user_id": user_id, "sessions": list_resource_sessions(user_id)}


@router.post("/sessions/new")
def new_session(user_id: int):
    from app.database import execute
    execute(
        "UPDATE chat_sessions SET is_active = FALSE WHERE user_id = %s "
        "AND session_type = 'resource_generation' AND is_active = TRUE", (user_id,),
    )
    return {"status": "ready"}


class StartRequest(BaseModel):
    user_id: int
    message: str = Field(min_length=2, max_length=2000)
    session_id: int | None = None
    resource_types: list[str] | None = None


@router.post("/start")
def start_generation(req: StartRequest):
    selected = req.resource_types or DEFAULT_TYPES
    invalid = [key for key in selected if key not in AGENT_META]
    if invalid:
        raise HTTPException(400, f"不支持的资源类型：{', '.join(invalid)}")

    # 垃圾输入检测
    from app.safety.garbage_detector import detect_garbage_input
    if detect_garbage_input(req.message, "")["suspicious"]:
        raise HTTPException(400, "请用正常的文字描述你的学习需求")

    session = _session(req.user_id, req.session_id)
    messages = list(session.get("messages", [])) if session else []
    profile = _student_profile(req.user_id)
    plan = orchestrate(req.message, messages, profile, selected)
    _bind_runtime_user(plan, req.user_id)

    # 规划结果安全过滤
    try:
        from app.safety.content_filter import filter_content
        plan_text = json.dumps(plan, ensure_ascii=False)
        filtered, _ = filter_content(plan_text, user_id=req.user_id, agent_name="orchestrator", content_type="text")
        if filtered != plan_text:
            logger.warning(f"用户 {req.user_id} 的资源规划被安全过滤")
    except Exception:
        pass

    messages.append({"role": "user", "content": req.message})
    labels = "、".join(agent.get("label", agent["key"]) for agent in plan.get("agents", []))
    reply = f"已理解你的目标：{plan.get('summary', '')}\n将生成：{labels}。"
    messages.append({"role": "assistant", "content": reply, "plan": plan})
    sid = save_resource_session(req.user_id, messages, req.session_id)
    return {
        "reply": reply, "messages": messages, "session_id": sid, "plan": plan,
        "available_agents": AGENT_META, "profile_used": bool(profile),
    }


class GenerateRequest(BaseModel):
    user_id: int
    message: str = ""
    session_id: int | None = None
    resource_types: list[str] | None = None


def _generation_context(user_id: int, session_id: int | None):
    session = _session(user_id, session_id)
    messages = list(session.get("messages", [])) if session else []
    plan = _latest_plan(messages)
    if not plan:
        raise HTTPException(409, "请先提交学习需求并确认资源计划")
    return session, messages, plan


@router.get("/generate/stream")
def generate_stream(user_id: int, session_id: int | None = None):
    session, messages, plan = _generation_context(user_id, session_id)
    _bind_runtime_user(plan, user_id)

    def event_gen():
        agents = plan.get("agents", [])
        sid = session.get("id") if session else session_id
        package_id = create_package(
            user_id, plan.get("needs", {}), plan,
            [agent["key"] for agent in agents], session_id=sid,
        )
        yield _event({
            "type": "job_created", "package_id": package_id, "plan": plan,
            "total": len(agents), "available_agents": AGENT_META,
        })

        results: dict[str, dict] = {}
        executor = ThreadPoolExecutor(max_workers=min(4, len(agents)), thread_name_prefix="resource-agent")
        futures = {}
        for index, cfg in enumerate(agents, 1):
            yield _event({
                "type": "agent_start", "agent": cfg["key"],
                "label": cfg.get("label", cfg["key"]), "index": index, "total": len(agents),
            })
            futures[executor.submit(run_agent, cfg)] = cfg["key"]

        pending = set(futures)
        started_at = time.monotonic()
        deadline = 100
        try:
            while pending:
                completed, pending = wait(pending, timeout=1, return_when=FIRST_COMPLETED)
                elapsed = int(time.monotonic() - started_at)
                if not completed:
                    yield _event({
                        "type": "heartbeat", "elapsed": elapsed,
                        "completed": len(results), "total": len(agents),
                        "progress": round(len(results) / max(1, len(agents)) * 100),
                    })
                for future in completed:
                    key = futures[future]
                    try:
                        _, result = future.result()
                    except Exception as exc:
                        result = {"type": key, "label": AGENT_META[key]["label"], "error": str(exc)}
                    results[key] = result
                    common = {
                        "agent": key, "completed": len(results), "total": len(agents),
                        "progress": round(len(results) / max(1, len(agents)) * 100),
                    }
                    if result.get("error"):
                        yield _event({"type": "agent_error", **common, "error": result["error"]})
                    else:
                        yield _event({"type": "agent_done", **common, "label": result["label"], "result": result})
                if elapsed >= deadline and pending:
                    for future in pending:
                        key = futures[future]
                        future.cancel()
                        results[key] = {"type": key, "label": AGENT_META[key]["label"], "error": "生成超时，可稍后重试"}
                        yield _event({"type": "agent_error", "agent": key, "error": "生成超时，可稍后重试", "completed": len(results), "total": len(agents)})
                    pending.clear()
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        overview = build_package_overview(plan, results)
        status = "done" if overview["resource_count"] == len(agents) else "partial"
        save_package_resources(package_id, results, status)
        # 后台轮询万相视频任务：media 资源若带 video_task_id,完成时把 video_url 写回资源包
        _schedule_video_poll(package_id)
        summary = f"资源包已完成：{overview['resource_count']}/{len(agents)} 项资源可用，预计学习 {overview['estimated_minutes']} 分钟。"
        messages.append({"role": "assistant", "content": summary, "package_id": package_id})
        save_resource_session(user_id, messages, sid)
        yield _event({"type": "package_ready", "package_id": package_id, "status": status, "overview": overview, "results": results})
        yield _event("[DONE]")

    return StreamingResponse(
        event_gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/generate")
def generate_sync(req: GenerateRequest):
    if req.message:
        start = start_generation(StartRequest(
            user_id=req.user_id, message=req.message, session_id=req.session_id,
            resource_types=req.resource_types,
        ))
        req.session_id = start["session_id"]
    session, messages, plan = _generation_context(req.user_id, req.session_id)
    _bind_runtime_user(plan, req.user_id)
    sid = session.get("id") if session else req.session_id
    results = run_agents(plan)
    package_id = create_package(req.user_id, plan.get("needs", {}), plan, [a["key"] for a in plan["agents"]], sid)
    overview = build_package_overview(plan, results)
    status = "done" if overview["resource_count"] == len(plan["agents"]) else "partial"
    save_package_resources(package_id, results, status)
    messages.append({"role": "assistant", "content": f"资源包已生成，共 {overview['resource_count']} 项资源。", "package_id": package_id})
    save_resource_session(req.user_id, messages, sid)
    return {"session_id": sid, "package_id": package_id, "plan": plan, "overview": overview, "results": results}


@router.post("/packages/{package_id}/retry/{agent_key}")
def retry_resource(package_id: int, agent_key: str, user: dict = Depends(enforce_registered_request)):
    if agent_key not in AGENT_RUNNERS:
        raise HTTPException(404, "未知资源类型")
    package = get_package(package_id)
    if not package:
        raise HTTPException(404, "资源包不存在")
    if int(package.get("user_id", -1)) != int(user["id"]):
        raise HTTPException(403, "无权操作该资源包")
    cfg = next((a for a in package.get("generation_plan", {}).get("agents", []) if a.get("key") == agent_key), None)
    if not cfg:
        raise HTTPException(400, "该资源不在原始计划中")
    _bind_runtime_user({"agents": [cfg]}, int(user["id"]))
    _, result = run_agent(cfg)
    resources = package.get("resources") or {}
    resources[agent_key] = result
    status = "done" if all(not value.get("error") for value in resources.values()) else "partial"
    save_package_resources(package_id, resources, status)
    return {"package_id": package_id, "agent": agent_key, "result": result, "status": status}


@router.get("/packages")
def list_user_packages(user_id: int):
    return {"user_id": user_id, "packages": list_packages(user_id)}


@router.get("/packages/{package_id}")
def get_resource_package(package_id: int, user: dict = Depends(enforce_registered_request)):
    package = get_package(package_id)
    if not package:
        return {"package_id": package_id, "exists": False}
    if int(package.get("user_id", -1)) != int(user["id"]):
        raise HTTPException(403, "无权查看该资源包")
    package["overview"] = build_package_overview(package.get("generation_plan") or {}, package.get("resources") or {})
    return {"package_id": package_id, "exists": True, "package": package}


@router.get("/packages/{package_id}/media")
def package_media(package_id: int, user: dict = Depends(enforce_registered_request)):
    package = get_package(package_id)
    if not package:
        raise HTTPException(404, "资源包不存在")
    if int(package.get("user_id", -1)) != int(user["id"]):
        raise HTTPException(403, "无权查看该资源包")
    return {"package_id": package_id, "media": get_media_by_package(package_id)}


@router.get("/meta/agents")
def agents_meta():
    return {"agents": AGENT_META, "default_types": DEFAULT_TYPES}


@router.get("/learning-path")
def learning_path(user_id: int):
    """兼容旧前端；新版本使用 /api/v1/learning-paths/current。"""
    from app.services.learning_path_service import get_current_path
    return get_current_path(user_id)


# ─── 学习行为反馈（资源掌握/评分/实验证据回传）──────────────

class FeedbackRequest(BaseModel):
    user_id: int
    resource_type: str
    resource_id: str | None = None
    action: str = "mastered"  # mastered / rated / lab_evidence / exercise_wrong
    rating: int | None = None
    detail: str | None = None
    node_id: str | None = None


@router.post("/packages/{package_id}/feedback")
def submit_feedback(package_id: int, req: FeedbackRequest):
    """记录资源学习行为（标记掌握/评分/实验证据/练习出错）→ learning_events + mastery_states

    带 node_id 时联动学习路径节点掌握度;exercise_wrong 触发画像薄弱点更新。
    """
    package = get_package(package_id)
    if not package:
        raise HTTPException(404, "资源包不存在")
    if package.get("user_id") != req.user_id:
        raise HTTPException(403, "无权操作该资源包")

    valid_actions = {"mastered", "rated", "lab_evidence", "exercise_wrong"}
    if req.action not in valid_actions:
        raise HTTPException(400, f"不支持的行为类型：{req.action}")
    if req.action == "rated" and not (1 <= (req.rating or 0) <= 5):
        raise HTTPException(400, "评分应为 1-5 分")

    event_data = {
        "package_id": package_id,
        "resource_type": req.resource_type,
        "resource_id": req.resource_id,
        "action": req.action,
        "rating": req.rating,
        "detail": req.detail,
        "node_id": req.node_id,
    }

    # 1. 写入 learning_events（资源侧 path_id=0,路径侧用真实 path_id）
    path_id = 0
    if req.node_id:
        try:
            rows = query("SELECT id FROM learning_paths WHERE user_id = %s ORDER BY updated_at DESC LIMIT 1", (req.user_id,))
            if rows:
                path_id = rows[0]["id"]
        except Exception:
            pass
    event_id = insert("learning_events", {
        "user_id": req.user_id,
        "path_id": path_id,
        "node_id": req.node_id,
        "event_type": f"resource_{req.action}",
        "event_data": json.dumps(event_data, ensure_ascii=False),
    })

    # 2. 更新掌握度（虚拟节点 res-{package}-{type} 或真实路径节点）
    mastery_node = req.node_id or f"res-{package_id}-{req.resource_type}"
    mastery_gain = {
        "mastered": 80,
        "rated": 40 if (req.rating or 0) >= 4 else 15,
        "lab_evidence": 75,
        "exercise_wrong": -10,
    }.get(req.action, 0)
    mastery = None
    try:
        rows = query("SELECT mastery FROM mastery_states WHERE user_id = %s AND node_id = %s", (req.user_id, mastery_node))
        current = rows[0]["mastery"] if rows else 0
        new_mastery = max(0, min(100, int(current) + mastery_gain))
        if rows:
            execute("UPDATE mastery_states SET mastery = %s, evidence = %s WHERE user_id = %s AND node_id = %s",
                    (new_mastery, json.dumps([event_data], ensure_ascii=False), req.user_id, mastery_node))
        else:
            insert("mastery_states", {
                "user_id": req.user_id, "node_id": mastery_node,
                "mastery": new_mastery, "evidence": json.dumps([event_data], ensure_ascii=False),
            })
        mastery = {"node_id": mastery_node, "mastery": new_mastery, "evidence_count": 1}
    except Exception as e:
        logger.warning(f"掌握度更新失败: {e}")

    # 3. 练习出错 → 触发画像薄弱点更新（节流保护）
    if req.action == "exercise_wrong":
        try:
            from app.services.orchestrator import on_quiz_submitted
            on_quiz_submitted(req.user_id, [{"correct": False, "quiz": {"question": req.detail or req.resource_type}}])
        except Exception:
            pass

    return {"event_id": event_id, "mastery": mastery}


# ─── 万相视频任务后台轮询 ────────────────────────────────

def _schedule_video_poll(package_id: int):
    """在后台线程轮询资源包内所有 media 的万相视频任务,SUCCEEDED 后把 video_url 写回包。

    结果 URL 24h 过期,所以必须在成功时立刻下载到本地 static。
    """
    import threading

    def _poll():
        try:
            deadline = time.monotonic() + 20 * 60  # 最多轮询 20 分钟
            while time.monotonic() < deadline:
                package = get_package(package_id)
                if not package:
                    return
                resources = package.get("resources") or {}
                media = resources.get("media")
                if not isinstance(media, dict) or media.get("error"):
                    return
                content = media.get("content")
                if not isinstance(content, dict):
                    return
                task_id = content.get("video_task_id")
                if not task_id:
                    return
                status = content.get("video_status")
                if status == "SUCCEEDED":
                    return
                if status == "FAILED":
                    return
                from app.services.llm import query_wan_video, _download_to_static
                from app.services.media_db import update_video_task
                result = query_wan_video(task_id)
                if result["status"] == "SUCCEEDED":
                    local = _download_to_static(result.get("video_url", ""), subdir="videos", prefix="wan", ext=".mp4")
                    content["video_url"] = local or result.get("video_url", "")
                    content["video_status"] = "SUCCEEDED"
                    update_video_task(
                        task_id,
                        int(package.get("user_id", 0)),
                        status="SUCCEEDED",
                        video_url=result.get("video_url", ""),
                        local_url=local or "",
                    )
                    save_package_resources(package_id, resources)
                    return
                if result["status"] == "FAILED":
                    content["video_status"] = "FAILED"
                    content["video_error"] = result.get("message", "")
                    update_video_task(
                        task_id,
                        int(package.get("user_id", 0)),
                        status="FAILED",
                        error=result.get("message", ""),
                    )
                    save_package_resources(package_id, resources)
                    return
                update_video_task(task_id, int(package.get("user_id", 0)), status=result["status"])
                time.sleep(15)
        except Exception:
            pass

    t = threading.Thread(target=_poll, daemon=True)
    t.start()
