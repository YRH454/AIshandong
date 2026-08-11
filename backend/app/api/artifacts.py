"""Learning artifacts generated from tutoring conversations."""

import json
import logging
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.artifact_agent import generate_learning_document
from app.agents.map_agent import generate_knowledge_map, normalize_edited_knowledge_map
from app.agents.map_collaboration_agent import collaborate_on_knowledge_map
from app.agents.practice_agent import generate_practice_set
from app.agents.dynamic_explanation_agent import (
    generate_dynamic_explanation,
    normalize_dynamic_explanation,
    regenerate_dynamic_explanation_scene,
)
from app.agents.library_agent import recommend_library_path
from app.database import query
from app.services.generation_jobs import get_generation_job, submit_generation_job
from app.services.artifact_db import (
    create_artifact,
    find_duplicate_artifacts,
    get_artifact,
    list_artifact_versions,
    list_artifacts,
    permanently_delete_artifact,
    restore_artifact,
    restore_artifact_version,
    save_artifact,
    set_artifact_favorite,
    trash_artifact,
    update_knowledge_map_content,
    update_interactive_presentation_content,
    update_artifact_metadata,
)
from app.services.practice_db import (
    create_practice_set,
    get_practice_for_artifact,
    get_practice_map_context,
    list_attempts_for_artifact,
    list_topic_reviews,
    refresh_topic_mastery_for_artifact,
    submit_attempt,
)
from app.services.map_db import (
    apply_practice_results,
    clear_map_progress,
    get_map_progress,
    prune_map_progress,
    set_map_node_progress,
)
from app.services.learning_progress_db import get_topic_learning_state, record_learning_activity

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/artifacts", tags=["artifacts"])


def _json(value, default):
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value or "")
    except (TypeError, json.JSONDecodeError):
        return default


class GenerateDocumentRequest(BaseModel):
    user_id: int
    session_id: int
    qa_id: str
    purpose: str = Field(default="review", pattern="^(review|preview|exam)$")
    depth: str = Field(default="standard", pattern="^(concise|standard|deep)$")
    style: str = Field(default="plain", pattern="^(plain|notes|exam)$")
    async_mode: bool = False


class GeneratePracticeRequest(BaseModel):
    user_id: int
    session_id: int
    qa_id: str
    question_count: int = Field(default=5, ge=5, le=5)
    focus_points: list[str] = Field(default_factory=list, max_length=5)
    source_map_artifact_id: int | None = None
    async_mode: bool = False


class GenerateKnowledgeMapRequest(BaseModel):
    user_id: int
    session_id: int
    qa_id: str
    async_mode: bool = False


class GenerateDynamicExplanationRequest(BaseModel):
    user_id: int
    session_id: int
    qa_id: str
    async_mode: bool = False


class CreateImageAnalysisArtifactRequest(BaseModel):
    user_id: int
    session_id: int
    qa_id: str


class SubmitPracticeAttemptRequest(BaseModel):
    user_id: int
    answers: dict[str, str] = Field(default_factory=dict)


class UpdateMapNodeProgressRequest(BaseModel):
    user_id: int
    status: str = Field(pattern="^(new|review|mastered)$")


class UpdateKnowledgeMapRequest(BaseModel):
    user_id: int
    map: dict


class UpdateInteractivePresentationRequest(BaseModel):
    user_id: int
    presentation: dict


class RegenerateInteractiveSceneRequest(UpdateInteractivePresentationRequest):
    scene_id: str = Field(min_length=1, max_length=80)


class CollaborateKnowledgeMapRequest(BaseModel):
    user_id: int


class SaveArtifactRequest(BaseModel):
    user_id: int
    title: str = Field(min_length=1, max_length=180)
    course_name: str = Field(min_length=1, max_length=120)
    topic_name: str = Field(min_length=1, max_length=120)
    save_strategy: str = Field(default="separate", pattern="^(separate|version|update)$")
    duplicate_artifact_id: int | None = None


class UpdateArtifactRequest(SaveArtifactRequest):
    pass


class FavoriteArtifactRequest(BaseModel):
    user_id: int
    favorite: bool


class ArtifactActionRequest(BaseModel):
    user_id: int


class RecordLearningActivityRequest(BaseModel):
    user_id: int
    activity_type: str = Field(min_length=1, max_length=48, pattern="^[A-Za-z0-9_]+$")
    activity_data: dict = Field(default_factory=dict)


class DuplicateArtifactRequest(BaseModel):
    user_id: int
    artifact_id: int
    title: str = Field(min_length=1, max_length=180)
    course_name: str = Field(min_length=1, max_length=120)
    topic_name: str = Field(min_length=1, max_length=120)


@router.get("")
def get_artifacts(user_id: int, session_id: int | None = None, status: str = "all"):
    if status not in {"all", "draft", "saved", "deleted"}:
        raise HTTPException(status_code=400, detail="不支持的资料状态")
    return {"artifacts": list_artifacts(user_id, session_id, status)}


@router.get("/topics/reviews")
def get_topic_reviews(user_id: int):
    return {"reviews": list_topic_reviews(user_id)}


@router.get("/topics/state")
def get_topic_state(user_id: int, course_name: str, topic_name: str):
    state = get_topic_learning_state(user_id, course_name.strip(), topic_name.strip())
    if not state:
        raise HTTPException(status_code=404, detail="主题不存在或还没有保存的资料")
    return state


@router.get("/generation-jobs/{job_id}")
def get_generation_job_status(job_id: str, user_id: int):
    job = get_generation_job(job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="生成任务不存在或已过期")
    return job


@router.get("/{artifact_id}/map-progress")
def get_knowledge_map_progress(artifact_id: int, user_id: int):
    progress = get_map_progress(artifact_id, user_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="没有找到可复习的知识图解")
    return progress


@router.patch("/{artifact_id}/map-progress/{node_id}")
def update_knowledge_map_node_progress(artifact_id: int, node_id: str, req: UpdateMapNodeProgressRequest):
    progress = set_map_node_progress(artifact_id, req.user_id, node_id, req.status)
    if progress is None:
        raise HTTPException(status_code=404, detail="知识图解节点不存在或已失效")
    record_learning_activity(
        req.user_id,
        artifact_id,
        f"map_node_{req.status}",
        {"node_id": node_id, "status": req.status},
    )
    return progress


@router.post("/{artifact_id}/activity")
def record_artifact_activity(artifact_id: int, req: RecordLearningActivityRequest):
    activity = record_learning_activity(
        req.user_id,
        artifact_id,
        req.activity_type,
        req.activity_data,
    )
    if not activity:
        raise HTTPException(status_code=404, detail="资料不存在、尚未保存或已删除")
    return {"activity": activity}


@router.patch("/{artifact_id}/knowledge-map")
def update_knowledge_map(artifact_id: int, req: UpdateKnowledgeMapRequest):
    try:
        map_data = normalize_edited_knowledge_map(req.map)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    artifact = update_knowledge_map_content(
        artifact_id,
        req.user_id,
        json.dumps(map_data, ensure_ascii=False),
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="知识图解不存在或已被删除")
    progress = prune_map_progress(artifact_id, req.user_id)
    return {"artifact": artifact, "map_progress": progress}


@router.patch("/{artifact_id}/interactive-presentation")
def update_interactive_presentation(artifact_id: int, req: UpdateInteractivePresentationRequest):
    try:
        presentation = normalize_dynamic_explanation(req.presentation)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    artifact = update_interactive_presentation_content(
        artifact_id,
        req.user_id,
        json.dumps(presentation, ensure_ascii=False),
        presentation["title"],
        presentation["summary"],
        presentation["highlights"],
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="互动演示不存在或已删除")
    if artifact.get("status") == "saved":
        record_learning_activity(req.user_id, artifact["id"], "presentation_edited")
    return {"artifact": artifact, "saved_as_version": artifact["id"] != artifact_id}


@router.post("/{artifact_id}/interactive-presentation/regenerate-scene")
def regenerate_interactive_presentation_scene(artifact_id: int, req: RegenerateInteractiveSceneRequest):
    artifact = get_artifact(artifact_id, req.user_id)
    if not artifact or artifact.get("kind") != "interactive" or artifact.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="互动演示不存在或已删除")
    try:
        presentation = normalize_dynamic_explanation(req.presentation)
        scene = regenerate_dynamic_explanation_scene(
            presentation,
            req.scene_id,
            str(artifact.get("source_prompt") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("互动演示单页重做失败")
        raise HTTPException(status_code=502, detail="AI 暂时无法重做这一页，请稍后再试") from exc
    return {"scene": scene}


@router.post("/{artifact_id}/knowledge-map/collaborate")
def collaborate_knowledge_map(artifact_id: int, req: CollaborateKnowledgeMapRequest):
    artifact = get_artifact(artifact_id, req.user_id)
    if not artifact or artifact.get("kind") != "map" or artifact.get("status") == "deleted":
        raise HTTPException(status_code=404, detail="知识图解不存在或已被删除")
    map_data = _json(artifact.get("content"), {})
    if not isinstance(map_data, dict) or not isinstance(map_data.get("nodes"), list):
        raise HTTPException(status_code=400, detail="知识图解内容无法读取")
    progress = get_map_progress(artifact_id, req.user_id) or {"progress": {}, "summary": {}}
    try:
        return collaborate_on_knowledge_map(map_data, progress)
    except Exception as exc:
        logger.exception("知识图解协作检查失败")
        raise HTTPException(status_code=502, detail="智能协作暂时无法完成，请稍后重试") from exc


@router.post("/generate-document")
def generate_document(req: GenerateDocumentRequest):
    if req.async_mode:
        sync_req = GenerateDocumentRequest(
            user_id=req.user_id,
            session_id=req.session_id,
            qa_id=req.qa_id,
            purpose=req.purpose,
            depth=req.depth,
            style=req.style,
        )
        return {"job": submit_generation_job("notes", req.user_id, lambda: generate_document(sync_req))}
    request_started = time.perf_counter()
    rows = query(
        "SELECT messages, learning_state FROM chat_sessions "
        "WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (req.session_id, req.user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="没有找到对应的学习对话")

    messages = _json(rows[0].get("messages"), [])
    learning_state = _json(rows[0].get("learning_state"), {})
    assistant_index = next(
        (index for index, message in enumerate(messages)
         if message.get("role") == "assistant" and message.get("id") == req.qa_id),
        None,
    )
    if assistant_index is None:
        raise HTTPException(status_code=404, detail="没有找到这条回答，请刷新页面后重试")
    assistant_message = messages[assistant_index]
    user_message = next(
        (message for message in reversed(messages[:assistant_index]) if message.get("role") == "user"),
        None,
    )
    if not user_message:
        raise HTTPException(status_code=400, detail="这条回答缺少原始问题，暂时无法生成")

    try:
        generation_started = time.perf_counter()
        generated = generate_learning_document(
            question=str(user_message.get("content", "")),
            answer=str(assistant_message.get("content", "")),
            recent_context=messages[max(0, assistant_index - 4):assistant_index + 1],
            learning_state=learning_state,
            purpose=req.purpose,
            depth=req.depth,
            style=req.style,
            user_id=req.user_id,
        )
        logger.info("[artifact-timing] kind=notes sid=%s stage=generation seconds=%.3f", req.session_id, time.perf_counter() - generation_started)
        classification_started = time.perf_counter()
        recommendation = recommend_library_path(
            user_id=req.user_id,
            learning_state=learning_state,
            title=generated["title"],
            summary=generated["summary"],
            source_prompt=str(user_message.get("content", "")),
            highlights=generated["highlights"],
        )
        logger.info("[artifact-timing] kind=notes sid=%s stage=classification seconds=%.3f", req.session_id, time.perf_counter() - classification_started)
        persist_started = time.perf_counter()
        artifact = create_artifact({
            "user_id": req.user_id,
            "session_id": req.session_id,
            "qa_id": req.qa_id,
            "kind": "notes",
            "title": generated["title"],
            "summary": generated["summary"],
            "highlights": generated["highlights"],
            "content": generated["content"],
            "source_prompt": str(user_message.get("content", ""))[:5000],
            "purpose": req.purpose,
            "depth": req.depth,
            "style": req.style,
            "course_name": recommendation["course_name"],
            "topic_name": recommendation["topic_name"],
            "recommended_course_name": recommendation["course_name"],
            "recommended_topic_name": recommendation["topic_name"],
            "classification_source": recommendation["source"],
            "classification_confidence": recommendation["confidence"],
            "classification_keywords": recommendation["keywords"],
            "keywords": recommendation["keywords"],
            "status": "draft",
        })
        logger.info("[artifact-timing] kind=notes sid=%s stage=persist seconds=%.3f total_seconds=%.3f", req.session_id, time.perf_counter() - persist_started, time.perf_counter() - request_started)
        return {"artifact": artifact}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("学习文档生成失败")
        raise HTTPException(status_code=502, detail="学习文档生成失败，请稍后重试") from exc


@router.post("/create-image-analysis")
def create_image_analysis_artifact(req: CreateImageAnalysisArtifactRequest):
    """Turn the structured result of a photographed question into a saveable draft artifact."""
    rows = query(
        "SELECT messages, learning_state FROM chat_sessions "
        "WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (req.session_id, req.user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="没有找到对应的学习对话")

    messages = _json(rows[0].get("messages"), [])
    learning_state = _json(rows[0].get("learning_state"), {})
    assistant_index = next(
        (index for index, message in enumerate(messages)
         if message.get("role") == "assistant" and message.get("id") == req.qa_id),
        None,
    )
    if assistant_index is None:
        raise HTTPException(status_code=404, detail="这条图片讲解尚未保存完成，请稍后重试")

    assistant_message = messages[assistant_index]
    user_message = next(
        (message for message in reversed(messages[:assistant_index])
         if message.get("role") == "user" and message.get("id") == f"u_{req.qa_id}"),
        None,
    )
    if not user_message:
        raise HTTPException(status_code=404, detail="没有找到这张图片的原始提问")

    analysis = user_message.get("image_analysis")
    if not isinstance(analysis, dict):
        raise HTTPException(status_code=400, detail="这条旧对话没有可保存的图片识别结果，请重新上传图片")

    title = str(analysis.get("title") or "题目图片解析").strip()[:180]
    summary = str(analysis.get("summary") or "图片识别与题目讲解").strip()[:500]
    recognized_text = str(analysis.get("recognized_text") or "").strip()[:5000]
    knowledge_points = [str(point).strip()[:120] for point in analysis.get("knowledge_points", []) if str(point).strip()][:5]
    answer = str(assistant_message.get("content") or "").strip()
    source_prompt = str(user_message.get("content") or "").strip()
    content_parts = [f"# {title}", "", summary, ""]
    if recognized_text:
        content_parts.extend(["## 图片识别内容", "", recognized_text, ""])
    if knowledge_points:
        content_parts.extend(["## 关联知识点", "", *[f"- {point}" for point in knowledge_points], ""])
    if answer:
        content_parts.extend(["## 题目讲解", "", answer])
    content = "\n".join(content_parts).strip()

    image_course = str(analysis.get("course_name") or "").strip()
    image_topic = str(analysis.get("topic_name") or "").strip()
    if image_course and image_topic:
        recommendation = {
            "course_name": image_course[:120],
            "topic_name": image_topic[:120],
            "source": "image_analysis",
            "confidence": 0.88,
            "keywords": knowledge_points,
        }
    else:
        recommendation = recommend_library_path(
            user_id=req.user_id,
            learning_state=learning_state,
            title=title,
            summary=summary,
            source_prompt=source_prompt,
            highlights=knowledge_points,
        )

    artifact = create_artifact({
        "user_id": req.user_id,
        "session_id": req.session_id,
        "qa_id": req.qa_id,
        "kind": "notes",
        "title": title,
        "summary": summary,
        "highlights": knowledge_points or ["图片识别结果", "题目讲解"],
        "content": content,
        "source_prompt": source_prompt[:5000],
        "purpose": "review",
        "depth": "standard",
        "style": "plain",
        "course_name": recommendation["course_name"],
        "topic_name": recommendation["topic_name"],
        "recommended_course_name": recommendation["course_name"],
        "recommended_topic_name": recommendation["topic_name"],
        "classification_source": recommendation["source"],
        "classification_confidence": recommendation["confidence"],
        "classification_keywords": recommendation["keywords"],
        "keywords": recommendation["keywords"],
        "status": "draft",
    })
    return {"artifact": artifact}


@router.post("/generate-knowledge-map")
def generate_knowledge_map_artifact(req: GenerateKnowledgeMapRequest):
    if req.async_mode:
        sync_req = GenerateKnowledgeMapRequest(
            user_id=req.user_id,
            session_id=req.session_id,
            qa_id=req.qa_id,
        )
        return {"job": submit_generation_job("map", req.user_id, lambda: generate_knowledge_map_artifact(sync_req))}
    request_started = time.perf_counter()
    rows = query(
        "SELECT messages, learning_state FROM chat_sessions "
        "WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (req.session_id, req.user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="没有找到对应的学习对话")

    messages = _json(rows[0].get("messages"), [])
    learning_state = _json(rows[0].get("learning_state"), {})
    assistant_index = next(
        (index for index, message in enumerate(messages)
         if message.get("role") == "assistant" and message.get("id") == req.qa_id),
        None,
    )
    if assistant_index is None:
        raise HTTPException(status_code=404, detail="没有找到这条回答，请刷新后重试")
    assistant_message = messages[assistant_index]
    user_message = next(
        (message for message in reversed(messages[:assistant_index]) if message.get("role") == "user"),
        None,
    )
    if not user_message:
        raise HTTPException(status_code=400, detail="这条回答缺少原始问题，暂时无法生成图解")

    try:
        generation_started = time.perf_counter()
        generated = generate_knowledge_map(
            question=str(user_message.get("content", "")),
            answer=str(assistant_message.get("content", "")),
            recent_context=messages[max(0, assistant_index - 4):assistant_index + 1],
            learning_state=learning_state,
        )
        logger.info("[artifact-timing] kind=map sid=%s stage=generation seconds=%.3f", req.session_id, time.perf_counter() - generation_started)
        keywords = [node["label"] for node in generated["map"]["nodes"]][:5]
        classification_started = time.perf_counter()
        recommendation = recommend_library_path(
            user_id=req.user_id,
            learning_state=learning_state,
            title=generated["title"],
            summary=generated["summary"],
            source_prompt=str(user_message.get("content", "")),
            highlights=keywords,
        )
        logger.info("[artifact-timing] kind=map sid=%s stage=classification seconds=%.3f", req.session_id, time.perf_counter() - classification_started)
        persist_started = time.perf_counter()
        artifact = create_artifact({
            "user_id": req.user_id,
            "session_id": req.session_id,
            "qa_id": req.qa_id,
            "kind": "map",
            "title": generated["title"],
            "summary": generated["summary"],
            "highlights": generated["highlights"],
            "content": json.dumps(generated["map"], ensure_ascii=False),
            "source_prompt": str(user_message.get("content", ""))[:5000],
            "purpose": "review",
            "depth": "standard",
            "style": "plain",
            "course_name": recommendation["course_name"],
            "topic_name": recommendation["topic_name"],
            "recommended_course_name": recommendation["course_name"],
            "recommended_topic_name": recommendation["topic_name"],
            "classification_source": recommendation["source"],
            "classification_confidence": recommendation["confidence"],
            "classification_keywords": recommendation["keywords"],
            "keywords": recommendation["keywords"],
            "status": "draft",
        })
        logger.info("[artifact-timing] kind=map sid=%s stage=persist seconds=%.3f total_seconds=%.3f", req.session_id, time.perf_counter() - persist_started, time.perf_counter() - request_started)
        return {"artifact": artifact}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("知识图解生成失败")
        raise HTTPException(status_code=502, detail="知识图解生成失败，请稍后重试") from exc


@router.post("/generate-dynamic-explanation")
def generate_dynamic_explanation_artifact(req: GenerateDynamicExplanationRequest):
    """Create a scene-based explanation that the browser can play without video generation."""
    if req.async_mode:
        sync_req = GenerateDynamicExplanationRequest(
            user_id=req.user_id,
            session_id=req.session_id,
            qa_id=req.qa_id,
        )
        return {
            "job": submit_generation_job(
                "interactive",
                req.user_id,
                lambda: generate_dynamic_explanation_artifact(sync_req),
            )
        }

    request_started = time.perf_counter()
    rows = query(
        "SELECT messages, learning_state FROM chat_sessions "
        "WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (req.session_id, req.user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="没有找到对应的学习对话")

    messages = _json(rows[0].get("messages"), [])
    learning_state = _json(rows[0].get("learning_state"), {})
    assistant_index = next(
        (index for index, message in enumerate(messages)
         if message.get("role") == "assistant" and message.get("id") == req.qa_id),
        None,
    )
    if assistant_index is None:
        raise HTTPException(status_code=404, detail="没有找到这条回答，请刷新后重试")
    assistant_message = messages[assistant_index]
    user_message = next(
        (message for message in reversed(messages[:assistant_index]) if message.get("role") == "user"),
        None,
    )
    if not user_message:
        raise HTTPException(status_code=400, detail="这条回答缺少原始问题，暂时无法生成动态讲解")

    try:
        generation_started = time.perf_counter()
        generated = generate_dynamic_explanation(
            question=str(user_message.get("content", "")),
            answer=str(assistant_message.get("content", "")),
            recent_context=messages[max(0, assistant_index - 4):assistant_index + 1],
            learning_state=learning_state,
        )
        logger.info(
            "[artifact-timing] kind=interactive sid=%s stage=generation seconds=%.3f",
            req.session_id,
            time.perf_counter() - generation_started,
        )
        classification_started = time.perf_counter()
        recommendation = recommend_library_path(
            user_id=req.user_id,
            learning_state=learning_state,
            title=generated["title"],
            summary=generated["summary"],
            source_prompt=str(user_message.get("content", "")),
            highlights=generated["highlights"],
        )
        logger.info(
            "[artifact-timing] kind=interactive sid=%s stage=classification seconds=%.3f",
            req.session_id,
            time.perf_counter() - classification_started,
        )
        persist_started = time.perf_counter()
        artifact = create_artifact({
            "user_id": req.user_id,
            "session_id": req.session_id,
            "qa_id": req.qa_id,
            "kind": "interactive",
            "title": generated["title"],
            "summary": generated["summary"],
            "highlights": generated["highlights"],
            "content": json.dumps(generated["explanation"], ensure_ascii=False),
            "source_prompt": str(user_message.get("content", ""))[:5000],
            "purpose": "review",
            "depth": "standard",
            "style": "plain",
            "course_name": recommendation["course_name"],
            "topic_name": recommendation["topic_name"],
            "recommended_course_name": recommendation["course_name"],
            "recommended_topic_name": recommendation["topic_name"],
            "classification_source": recommendation["source"],
            "classification_confidence": recommendation["confidence"],
            "classification_keywords": recommendation["keywords"],
            "keywords": recommendation["keywords"],
            "status": "draft",
        })
        logger.info(
            "[artifact-timing] kind=interactive sid=%s stage=persist seconds=%.3f total_seconds=%.3f",
            req.session_id,
            time.perf_counter() - persist_started,
            time.perf_counter() - request_started,
        )
        return {"artifact": artifact}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("动态讲解生成失败")
        raise HTTPException(status_code=502, detail="动态讲解生成失败，请稍后重试") from exc


@router.post("/generate-practice")
def generate_practice(req: GeneratePracticeRequest):
    if req.async_mode:
        sync_req = GeneratePracticeRequest(
            user_id=req.user_id,
            session_id=req.session_id,
            qa_id=req.qa_id,
            question_count=req.question_count,
            focus_points=req.focus_points,
            source_map_artifact_id=req.source_map_artifact_id,
        )
        return {"job": submit_generation_job("practice", req.user_id, lambda: generate_practice(sync_req))}
    request_started = time.perf_counter()
    rows = query(
        "SELECT messages, learning_state FROM chat_sessions "
        "WHERE id = %s AND user_id = %s AND session_type = 'tutoring'",
        (req.session_id, req.user_id),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="没有找到对应的学习对话")
    messages = _json(rows[0].get("messages"), [])
    learning_state = _json(rows[0].get("learning_state"), {})
    assistant_index = next(
        (index for index, message in enumerate(messages)
         if message.get("role") == "assistant" and message.get("id") == req.qa_id),
        None,
    )
    if assistant_index is None:
        raise HTTPException(status_code=404, detail="没有找到这条回答，请刷新页面后重试")
    assistant_message = messages[assistant_index]
    user_message = next(
        (message for message in reversed(messages[:assistant_index]) if message.get("role") == "user"),
        None,
    )
    if not user_message:
        raise HTTPException(status_code=400, detail="这条回答缺少原始问题，暂时无法生成练习")

    if req.source_map_artifact_id is not None:
        source_map = get_artifact(req.source_map_artifact_id, req.user_id)
        if not source_map or source_map.get("kind") != "map" or source_map.get("status") == "deleted":
            raise HTTPException(status_code=400, detail="来源知识图解不存在，无法生成针对性练习")

    try:
        generation_started = time.perf_counter()
        generated = generate_practice_set(
            question=str(user_message.get("content", "")),
            answer=str(assistant_message.get("content", "")),
            recent_context=messages[max(0, assistant_index - 4):assistant_index + 1],
            learning_state=learning_state,
            user_id=req.user_id,
            question_count=req.question_count,
            focus_points=[point.strip() for point in req.focus_points if point.strip()],
        )
        logger.info("[artifact-timing] kind=practice sid=%s stage=generation seconds=%.3f", req.session_id, time.perf_counter() - generation_started)
        classification_started = time.perf_counter()
        recommendation = recommend_library_path(
            user_id=req.user_id,
            learning_state=learning_state,
            title=generated["title"],
            summary=generated["summary"],
            source_prompt=str(user_message.get("content", "")),
            highlights=generated["knowledge_points"] or generated["highlights"],
        )
        logger.info("[artifact-timing] kind=practice sid=%s stage=classification seconds=%.3f", req.session_id, time.perf_counter() - classification_started)
        persist_started = time.perf_counter()
        practice_content = "\n".join([
            f"# {generated['title']}",
            "",
            generated["summary"],
            "",
            "这是一份可交互作答的练习集。打开后完成 5 题，提交时才会显示答案与逐题解析。",
            "",
            "## 覆盖知识点",
            *[f"- {item}" for item in generated["knowledge_points"]],
        ])
        artifact = create_artifact({
            "user_id": req.user_id,
            "session_id": req.session_id,
            "qa_id": req.qa_id,
            "kind": "practice",
            "title": generated["title"],
            "summary": generated["summary"],
            "highlights": generated["highlights"],
            "content": practice_content,
            "source_prompt": str(user_message.get("content", ""))[:5000],
            "purpose": "review",
            "depth": "standard",
            "style": "exam",
            "course_name": recommendation["course_name"],
            "topic_name": recommendation["topic_name"],
            "recommended_course_name": recommendation["course_name"],
            "recommended_topic_name": recommendation["topic_name"],
            "classification_source": recommendation["source"],
            "classification_confidence": recommendation["confidence"],
            "classification_keywords": recommendation["keywords"],
            "keywords": recommendation["keywords"],
            "source_map_artifact_id": req.source_map_artifact_id,
            "status": "draft",
        })
        practice = create_practice_set(
            req.user_id,
            artifact["id"],
            generated["questions"],
            generated["knowledge_points"],
        )
        logger.info("[artifact-timing] kind=practice sid=%s stage=persist seconds=%.3f total_seconds=%.3f", req.session_id, time.perf_counter() - persist_started, time.perf_counter() - request_started)
        return {"artifact": artifact, "practice": {key: value for key, value in practice.items() if key != "questions"} | {
            "questions": [{key: value for key, value in item.items() if key not in {"answer", "accepted_answers", "explanation"}} for item in practice["questions"]]
        }}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("练习测验生成失败")
        raise HTTPException(status_code=502, detail="练习测验生成失败，请稍后重试") from exc


@router.get("/{artifact_id}/practice")
def get_artifact_practice(artifact_id: int, user_id: int):
    practice = get_practice_for_artifact(artifact_id, user_id)
    if not practice:
        raise HTTPException(status_code=404, detail="没有找到这份练习集")
    return {"practice": practice, "attempts": list_attempts_for_artifact(artifact_id, user_id)}


@router.post("/practice-sets/{practice_set_id}/submit")
def submit_practice_attempt(practice_set_id: int, req: SubmitPracticeAttemptRequest):
    result = submit_attempt(practice_set_id, req.user_id, req.answers)
    if not result:
        raise HTTPException(status_code=404, detail="练习集不存在或已无权访问")
    record_learning_activity(
        req.user_id,
        result["artifact_id"],
        "practice_submitted",
        {
            "score": result["attempt"].get("score"),
            "weak_points": result["attempt"].get("weak_points", []),
        },
    )
    map_context = get_practice_map_context(practice_set_id, req.user_id)
    if map_context:
        result["map_progress"] = apply_practice_results(
            map_context["map_artifact_id"],
            req.user_id,
            result["attempt"].get("results", []),
        )
    return result


@router.post("/duplicates")
def detect_duplicate_artifacts(req: DuplicateArtifactRequest):
    duplicates = find_duplicate_artifacts(
        req.artifact_id,
        req.user_id,
        req.title.strip(),
        req.course_name.strip(),
        req.topic_name.strip(),
    )
    return {"duplicates": duplicates}


@router.patch("/{artifact_id}/save")
def archive_artifact(artifact_id: int, req: SaveArtifactRequest):
    artifact = save_artifact(
        artifact_id,
        req.user_id,
        req.title.strip(),
        req.course_name.strip(),
        req.topic_name.strip(),
        req.save_strategy,
        req.duplicate_artifact_id,
    )
    if not artifact:
        raise HTTPException(status_code=400, detail="保存条件已经变化，请重新确认资料和版本选择")
    if req.save_strategy == "update" and artifact.get("kind") == "map":
        clear_map_progress(artifact_id, req.user_id)
        clear_map_progress(artifact["id"], req.user_id)
    topic_mastery = refresh_topic_mastery_for_artifact(artifact["id"], req.user_id)
    if topic_mastery is not None:
        artifact["topic_mastery"] = topic_mastery
    record_learning_activity(req.user_id, artifact["id"], "saved")
    return {"artifact": artifact, "topic_mastery": topic_mastery}


@router.get("/{artifact_id}/versions")
def get_artifact_versions(artifact_id: int, user_id: int):
    versions = list_artifact_versions(artifact_id, user_id)
    if not versions:
        raise HTTPException(status_code=404, detail="没有找到这份资料的版本记录")
    return {"versions": versions}


@router.post("/{artifact_id}/restore-version")
def restore_selected_artifact_version(artifact_id: int, req: ArtifactActionRequest):
    artifact = restore_artifact_version(artifact_id, req.user_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="这个版本已经无法恢复")
    return {"artifact": artifact}


@router.patch("/{artifact_id}/favorite")
def favorite_artifact(artifact_id: int, req: FavoriteArtifactRequest):
    artifact = set_artifact_favorite(artifact_id, req.user_id, req.favorite)
    if not artifact:
        raise HTTPException(status_code=404, detail="资料不存在或已被删除")
    return {"artifact": artifact}


@router.patch("/{artifact_id}/trash")
def move_artifact_to_trash(artifact_id: int, req: ArtifactActionRequest):
    artifact = trash_artifact(artifact_id, req.user_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="资料不存在、尚未保存或已经在回收站")
    return {"artifact": artifact}


@router.patch("/{artifact_id}/restore")
def restore_deleted_artifact(artifact_id: int, req: ArtifactActionRequest):
    artifact = restore_artifact(artifact_id, req.user_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="回收站中没有找到这份资料")
    return {"artifact": artifact}


@router.delete("/{artifact_id}")
def delete_artifact_forever(artifact_id: int, user_id: int):
    if not permanently_delete_artifact(artifact_id, user_id):
        raise HTTPException(status_code=404, detail="只能永久删除回收站中的资料")
    return {"deleted": True, "artifact_id": artifact_id}


@router.patch("/{artifact_id}")
def update_artifact(artifact_id: int, req: UpdateArtifactRequest):
    artifact = update_artifact_metadata(
        artifact_id,
        req.user_id,
        req.title.strip(),
        req.course_name.strip(),
        req.topic_name.strip(),
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="资料不存在、尚未保存或已被删除")
    return {"artifact": artifact}
