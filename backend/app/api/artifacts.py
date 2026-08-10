"""Learning artifacts generated from tutoring conversations."""

import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.artifact_agent import generate_learning_document
from app.agents.library_agent import recommend_library_path
from app.database import query
from app.services.artifact_db import (
    create_artifact,
    find_duplicate_artifacts,
    list_artifact_versions,
    list_artifacts,
    permanently_delete_artifact,
    restore_artifact,
    restore_artifact_version,
    save_artifact,
    set_artifact_favorite,
    trash_artifact,
    update_artifact_metadata,
)

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


@router.post("/generate-document")
def generate_document(req: GenerateDocumentRequest):
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
        recommendation = recommend_library_path(
            user_id=req.user_id,
            learning_state=learning_state,
            title=generated["title"],
            summary=generated["summary"],
            source_prompt=str(user_message.get("content", "")),
            highlights=generated["highlights"],
        )
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
        return {"artifact": artifact}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("学习文档生成失败")
        raise HTTPException(status_code=502, detail="学习文档生成失败，请稍后重试") from exc


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
    return {"artifact": artifact}


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
