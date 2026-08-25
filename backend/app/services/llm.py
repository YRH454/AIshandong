"""LLM 客户端封装：Qwen(主力)、DeepSeek(推理)、Seedance(视频)、Mimo(多模态) + 千问多模态(DashScope)"""
import os
import time
import tempfile
import httpx
from openai import OpenAI
from app.config import (
    QWEN_API_KEY, QWEN_MODEL, QWEN_BASE_URL,
    DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL,
    SEEDANCE_API_KEY, SEEDANCE_MODEL, SEEDANCE_BASE_URL,
    MIMO_API_KEY, MIMO_BASE_URL,
    DASHSCOPE_API_KEY, QWEN_VISION_MODEL, WAN_IMAGE_MODEL, WAN_VIDEO_MODEL,
    Qwen_TTS_MODEL, QWEN_ASR_MODEL, DASHSCOPE_API_URL,
)

# 共享 httpx 客户端（连接池复用，避免每次请求新建 TCP 连接）
# limits: 每个 host 最多 10 个 keep-alive 连接，总共 20 个连接
_limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
http_client = httpx.Client(timeout=httpx.Timeout(90.0, connect=10.0), limits=_limits)

qwen = OpenAI(api_key=QWEN_API_KEY, base_url=QWEN_BASE_URL, http_client=http_client)
seedance = OpenAI(api_key=SEEDANCE_API_KEY, base_url=SEEDANCE_BASE_URL, http_client=http_client)
deepseek = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL, http_client=http_client)
mimo = OpenAI(api_key=MIMO_API_KEY, base_url=MIMO_BASE_URL, http_client=http_client) if MIMO_BASE_URL else None


def chat_qwen(messages: list, temperature=0.7, max_tokens=2048, json_mode=False, request_timeout: float | None = None):
    """调用千问主力模型"""
    return chat_qwen_model(QWEN_MODEL, messages, temperature=temperature,
                           max_tokens=max_tokens, json_mode=json_mode,
                           request_timeout=request_timeout)


# ── 千问多模型调用 ─────────────────────────────────────────
# 按任务类型分配不同模型:写作→max,代码→coder,快速→flash,长文本→long
# 所有模型共用同一个 DashScope Key(OpenAI 兼容接口)

MODEL_REGISTRY = {
    "qwen-max": "qwen-max",
    "qwen-plus": "qwen-plus",
    "qwen-flash": "qwen-flash",
    "qwen-turbo": "qwen-turbo",
    "qwen-coder": "qwen-coder-plus",
    "qwen-long": "qwen-long",
    "qwen-reasoner": "qwq-plus",  # 需流式
}


def chat_qwen_model(model: str, messages: list, temperature=0.3, max_tokens=4096,
                    json_mode=False, stream=False, request_timeout: float | None = None):
    """调用指定千问模型。

    model 可为 "qwen-max" / "qwen-coder" / "qwen-flash" / "qwen-long" 等（MODEL_REGISTRY 键）
    或完整的真实模型名。qwq 推理模型仅支持流式,这里自动处理。
    """
    real_model = MODEL_REGISTRY.get(model, model)
    kwargs = dict(
        model=real_model, messages=messages,
        temperature=temperature, max_tokens=max_tokens,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if request_timeout is not None:
        kwargs["timeout"] = request_timeout
    if stream or real_model == "qwq-plus":
        kwargs["stream"] = True
    return qwen.chat.completions.create(**kwargs)


def get_qwen_client(model: str):
    """获取指定千问模型的 OpenAI 客户端(供 LangChain ChatOpenAI 复用连接池)"""
    return qwen


def chat_qwen_stream(messages: list, temperature=0.7, max_tokens=2048, model: str | None = None):
    """流式调用千问"""
    return qwen.chat.completions.create(
        model=MODEL_REGISTRY.get(model or QWEN_MODEL, model or QWEN_MODEL), messages=messages,
        temperature=temperature, max_tokens=max_tokens,
        stream=True,
    )


def chat_deepseek(messages: list, temperature=0.3, max_tokens=4096, json_mode=False, tools: list = None, search_enable: bool = False):
    """调用 DeepSeek"""
    kwargs = dict(
        model=DEEPSEEK_MODEL, messages=messages,
        temperature=temperature, max_tokens=max_tokens,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    if tools:
        kwargs["tools"] = tools
    if search_enable:
        kwargs["extra_body"] = {"search_enable": True}
    return deepseek.chat.completions.create(**kwargs)


def chat_deepseek_stream(messages: list, temperature=0.5, max_tokens=4096):
    """流式调用 DeepSeek"""
    return deepseek.chat.completions.create(
        model=DEEPSEEK_MODEL, messages=messages,
        temperature=temperature, max_tokens=max_tokens,
        stream=True,
    )


def generate_glm_image(prompt: str, size: str = "1280x1280") -> str | None:
    """智谱 GLM-Image 生成画像插图"""
    import os, json, time
    api_key = os.getenv("GLM_IMAGE_API_KEY") or os.getenv("QWEN_API_KEY")
    if not api_key:
        return None
    try:
        resp = __import__("httpx").post(
            "https://open.bigmodel.cn/api/paas/v4/images/generations",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            json={"model": "glm-image", "prompt": prompt, "size": size, "watermark_enabled": False},
            timeout=120,
        )
        if resp.status_code != 200:
            print(f"[GLM-Image] API error: {resp.status_code} {resp.text[:200]}")
            return None
        data = resp.json()
        img_url = data.get("data", [{}])[0].get("url", "")
        if not img_url:
            return None
        img_resp = __import__("httpx").get(img_url, timeout=30)
        if img_resp.status_code != 200:
            return None
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", "profiles")
        os.makedirs(static_dir, exist_ok=True)
        fname = f"profile_{int(time.time())}.png"
        fpath = os.path.join(static_dir, fname)
        with open(fpath, "wb") as f:
            f.write(img_resp.content)
        return f"/static/profiles/{fname}"
    except Exception as e:
        print(f"[GLM-Image] {e}")
        return None


# ════════════════════════════════════════════════════════════
# 千问多模态(DashScope)— 视觉理解 / 万相图像 / 万相视频 / 语音
# ════════════════════════════════════════════════════════════

def _dashscope_headers(async_task: bool = False) -> dict:
    headers = {"Authorization": f"Bearer {DASHSCOPE_API_KEY}", "Content-Type": "application/json"}
    if async_task:
        headers["X-DashScope-Async"] = "enable"
    return headers


def chat_qwen_vision(messages: list, images: list[dict], model: str | None = None, temperature: float = 0.3, max_tokens: int = 1024) -> str:
    """视觉理解：图片(URL 或 base64 data URI)+ 文本 → 理解结果(OpenAI 兼容接口)

    images: [{"type": "image_url", "image_url": {"url": "..."}}, ...]
    或简写为 ["url1", "data:image/png;base64,xxx"]
    """
    if not DASHSCOPE_API_KEY:
        raise RuntimeError("未配置千问 API Key(QWEN_API_KEY/DASHSCOPE_API_KEY)")
    content: list = []
    for img in images:
        if isinstance(img, str):
            content.append({"type": "image_url", "image_url": {"url": img}})
        elif isinstance(img, dict):
            content.append(img)
    for m in messages:
        content.append({"type": "text", "text": m.get("content", "") if isinstance(m, dict) else str(m)})

    client = OpenAI(api_key=DASHSCOPE_API_KEY, base_url=QWEN_BASE_URL, http_client=http_client)
    resp = client.chat.completions.create(
        model=model or QWEN_VISION_MODEL,
        messages=[{"role": "user", "content": content}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content or ""


def generate_wan_image(prompt: str, size: str = "1024*1024", save_dir: str = "profiles") -> str | None:
    """万相文生图(wan2.7-image-pro)→ 下载到本地 static,返回本地 URL

    size: "1024*1024" / "1280*720" 等像素格式
    """
    if not DASHSCOPE_API_KEY:
        return None
    try:
        payload = {
            "model": WAN_IMAGE_MODEL,
            "input": {"messages": [{"role": "user", "content": [{"text": prompt}]}]},
            "parameters": {"size": size, "n": 1, "watermark": False},
        }
        resp = httpx.post(
            f"{DASHSCOPE_API_URL}/services/aigc/multimodal-generation/generation",
            json=payload, headers=_dashscope_headers(), timeout=120,
        )
        if resp.status_code != 200:
            print(f"[Wan-Image] API error: {resp.status_code} {resp.text[:200]}")
            return None
        data = resp.json()
        img_url = ""
        for choice in data.get("output", {}).get("choices", []):
            for content in choice.get("message", {}).get("content", []):
                if content.get("type") == "image" and content.get("image"):
                    img_url = content["image"]
                    break
        if not img_url:
            return None
        return _download_to_static(img_url, subdir=save_dir, prefix="wan")
    except Exception as e:
        print(f"[Wan-Image] {e}")
        return None


def submit_wan_video(prompt: str, size: str = "1280*720", duration: int = 5) -> str | None:
    """万相文生视频(wan2.7-t2v)— 异步任务模式,返回 task_id(需轮询)"""
    if not DASHSCOPE_API_KEY:
        return None
    try:
        payload = {
            "model": WAN_VIDEO_MODEL,
            "input": {"prompt": prompt},
            "parameters": {"size": size, "duration": duration},
        }
        resp = httpx.post(
            f"{DASHSCOPE_API_URL}/services/aigc/video-generation/video-synthesis",
            json=payload, headers=_dashscope_headers(async_task=True), timeout=60,
        )
        if resp.status_code != 200:
            print(f"[Wan-Video] submit error: {resp.status_code} {resp.text[:200]}")
            return None
        task_id = resp.json().get("output", {}).get("task_id")
        if not task_id:
            print(f"[Wan-Video] no task_id: {resp.text[:200]}")
        return task_id
    except Exception as e:
        print(f"[Wan-Video] {e}")
        return None


def query_wan_video(task_id: str) -> dict:
    """轮询万相视频任务状态:
    {"status": "PENDING|RUNNING|SUCCEEDED|FAILED",
     "video_url": "..."(SUCCEEDED 时), "message": "..."(FAILED 时)}
    """
    try:
        resp = httpx.get(
            f"{DASHSCOPE_API_URL}/tasks/{task_id}",
            headers={"Authorization": f"Bearer {DASHSCOPE_API_KEY}"}, timeout=30,
        )
        if resp.status_code != 200:
            return {"status": "FAILED", "message": f"查询失败 {resp.status_code}"}
        data = resp.json()
        out = data.get("output", {})
        status = out.get("task_status", "PENDING")
        result = {"status": status}
        if status == "SUCCEEDED":
            result["video_url"] = out.get("video_url", "")
        elif status == "FAILED":
            result["message"] = out.get("message", "生成失败")
        return result
    except Exception as e:
        return {"status": "FAILED", "message": str(e)}


def qwen_tts(text: str, voice: str = "Cherry", speed: float = 1.0) -> str | None:
    """千问语音合成(文本→音频)→ 下载到本地 static/audio,返回本地 URL"""
    if not DASHSCOPE_API_KEY:
        return None
    try:
        payload = {
            "model": Qwen_TTS_MODEL,
            "input": {"text": text, "voice": voice},
            "parameters": {"format": "mp3", "speed": speed},
        }
        resp = httpx.post(
            f"{DASHSCOPE_API_URL}/services/aigc/multimodal-generation/generation",
            json=payload, headers=_dashscope_headers(), timeout=120,
        )
        if resp.status_code != 200:
            print(f"[Qwen-TTS] API error: {resp.status_code} {resp.text[:200]}")
            return None
        data = resp.json()
        audio_url = ""
        # 响应结构: output.audio.url 或 output.choices[].message.content[].audio
        audio = data.get("output", {}).get("audio", {})
        if isinstance(audio, dict) and audio.get("url"):
            audio_url = audio["url"]
        else:
            for choice in data.get("output", {}).get("choices", []):
                for content in choice.get("message", {}).get("content", []):
                    if content.get("type") == "audio" and content.get("audio"):
                        audio_url = content["audio"]
                        break
        if not audio_url:
            return None
        return _download_to_static(audio_url, subdir="audio", prefix="tts", ext=".mp3")
    except Exception as e:
        print(f"[Qwen-TTS] {e}")
        return None


def qwen_asr(audio_url_or_path: str) -> str | None:
    """千问语音识别(音频→文本)— DashScope 原生 MultiModalConversation 接口

    输入支持: 公网 URL(http/https)、本地文件路径(file:// 自动上传)、base64 data URI(自动转临时文件)。
    """
    if not DASHSCOPE_API_KEY:
        return None
    try:
        import dashscope as _ds

        _ds.api_key = DASHSCOPE_API_KEY
        _ds.base_http_api_url = DASHSCOPE_API_URL
        audio_ref = audio_url_or_path
        tmp_path = None
        if audio_url_or_path.startswith("data:"):
            # base64 data URI → 临时 wav 文件
            import base64 as _b64
            mime, b64 = audio_url_or_path.split(",", 1)[0][5:].split(";")[0], audio_url_or_path.split(",", 1)[1]
            ext = ".webm" if "webm" in mime else ".mp3"
            tmp_path = os.path.join(tempfile.gettempdir(), f"asr_{int(time.time() * 1000)}{ext}")
            with open(tmp_path, "wb") as f:
                f.write(_b64.b64decode(b64))
            audio_ref = f"file://{tmp_path}"
        elif audio_url_or_path.startswith(("http://", "https://", "file://")):
            pass
        elif os.path.exists(audio_url_or_path):
            audio_ref = f"file://{os.path.abspath(audio_url_or_path)}"
        else:
            audio_ref = audio_url_or_path

        messages = [{
            "role": "user",
            "content": [{"audio": audio_ref}],
        }]
        resp = _ds.MultiModalConversation.call(
            model=QWEN_ASR_MODEL,
            messages=messages,
            result_format="message",
            asr_options={"enable_lid": True, "enable_itn": True},
        )
        if tmp_path and os.path.exists(tmp_path):
            try: os.remove(tmp_path)
            except Exception: pass
        if resp.status_code != 200:
            print(f"[Qwen-ASR] {resp.status_code} {getattr(resp, 'message', '')}")
            return None
        text = resp.output.choices[0].message.content[0].get("text", "")
        return text or None
    except Exception as e:
        print(f"[Qwen-ASR] {e}")
        return None


def _download_to_static(url: str, subdir: str, prefix: str, ext: str = ".png") -> str | None:
    """下载远端媒体到 backend/static/{subdir},返回 /static/... 本地 URL"""
    try:
        img_resp = httpx.get(url, timeout=60)
        if img_resp.status_code != 200:
            return None
        static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static", subdir)
        os.makedirs(static_dir, exist_ok=True)
        fname = f"{prefix}_{int(time.time() * 1000)}{ext}"
        fpath = os.path.join(static_dir, fname)
        with open(fpath, "wb") as f:
            f.write(img_resp.content)
        return f"/static/{subdir}/{fname}"
    except Exception as e:
        print(f"[download-to-static] {e}")
        return None
