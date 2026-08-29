"""语音能力 API — 千问 TTS 语音合成 / ASR 语音识别

POST /tts 文本→语音(下载到 static/audio);POST /asr 语音→文本。
"""
import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.llm import qwen_tts, qwen_asr
from app.api.auth import enforce_registered_request
from app.utils.input_security import validate_media_reference

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/audio",
    tags=["audio"],
    dependencies=[Depends(enforce_registered_request)],
)


class TTSRequest(BaseModel):
    user_id: int
    text: str
    voice: str = "Cherry"


class ASRRequest(BaseModel):
    user_id: int
    audio: str  # URL / 本地路径 / base64 data URI


@router.post("/tts")
def tts(req: TTSRequest):
    """文本 → 语音"""
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "文本不能为空")
    if len(text) > 1000:
        raise HTTPException(400, "文本过长（最多1000字），请分段")
    url = qwen_tts(text, voice=req.voice)
    if not url:
        raise HTTPException(500, "语音合成失败，请确认已配置千问 API Key")
    return {"audio_url": url}


@router.post("/asr")
def asr(req: ASRRequest):
    """语音 → 文本"""
    if not req.audio:
        raise HTTPException(400, "音频不能为空")
    validate_media_reference(req.audio, field="音频地址")
    text = qwen_asr(req.audio)
    if not text:
        raise HTTPException(500, "语音识别失败，请确认已配置千问 API Key")
    return {"text": text}
