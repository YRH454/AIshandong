"""Generate browser-safe, scene-based interactive learning presentations."""

import json
import re

from app.services.llm import chat_qwen


_VISUAL_TYPES = {
    "concept",
    "journey",
    "sequence",
    "stack",
    "compare",
    "contrast",
    "example",
    "lab",
    "pitfall",
    "error-lab",
    "map",
    "recap",
    "code-trace",
    "timeline",
    "network",
}
_PALETTES = {"sage", "cobalt", "ember", "plum", "ink"}
_FALLBACK_VISUAL_TYPES = ("concept", "journey", "stack", "code-trace", "contrast", "lab", "timeline", "network", "map", "recap")


def _clean(value: object, limit: int) -> str:
    return " ".join(str(value or "").strip().split())[:limit]


def _parse_json(text: str) -> dict:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.S)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def _context_text(messages: list[dict]) -> str:
    lines: list[str] = []
    for message in messages[-4:]:
        content = _clean(message.get("content"), 1600)
        if content:
            lines.append(f"{message.get('role', 'user')}: {content}")
    return "\n".join(lines)


def _normalize_check(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    prompt = _clean(value.get("prompt"), 180)
    options = [_clean(item, 80) for item in value.get("options", []) if _clean(item, 80)][:4]
    answer = _clean(value.get("answer"), 80)
    if answer.isdigit() and 1 <= int(answer) <= len(options):
        answer = options[int(answer) - 1]
    explanation = _clean(value.get("explanation"), 220)
    if not prompt or len(options) < 2 or answer not in options or not explanation:
        return None
    return {"prompt": prompt, "options": options, "answer": answer, "explanation": explanation}


def _normalize_visual(value: object, visual_type: str, key_point: str, narration: str) -> dict:
    raw = value if isinstance(value, dict) else {}
    items = [_clean(item, 84) for item in raw.get("items", []) if _clean(item, 84)][:5]
    headline = _clean(raw.get("headline"), 92) or key_point
    if visual_type in {"sequence", "journey", "stack", "code-trace", "timeline", "network"} and len(items) < 2:
        items = [key_point, "把这一层和下一步连起来理解"]
    if visual_type in {"concept", "map", "recap"} and not items:
        items = [key_point]
    if visual_type in {"compare", "contrast"} and len(items) < 1:
        items = [key_point]
    return {
        "headline": headline,
        "items": items,
        "before": _clean(raw.get("before"), 96),
        "after": _clean(raw.get("after"), 96),
        "example": _clean(raw.get("example"), 180) or (narration[:140] if visual_type in {"example", "lab"} else ""),
    }


def _normalize_scene(value: object, index: int, check_count: int) -> tuple[dict | None, int]:
    if not isinstance(value, dict):
        return None, check_count
    title = _clean(value.get("title"), 52)
    narration = _clean(value.get("narration"), 420)
    key_point = _clean(value.get("key_point"), 110)
    visual_type = _clean(value.get("visual_type"), 24).lower()
    if not title or not narration or not key_point:
        return None, check_count
    if visual_type not in _VISUAL_TYPES:
        visual_type = _FALLBACK_VISUAL_TYPES[min(index, len(_FALLBACK_VISUAL_TYPES) - 1)]
    try:
        suggested_seconds = int(value.get("suggested_seconds") or 42)
    except (TypeError, ValueError):
        suggested_seconds = 42
    check = _normalize_check(value.get("check")) if check_count < 2 else None
    return {
        "id": f"scene-{index + 1}",
        "title": title,
        "narration": narration,
        "key_point": key_point,
        "visual_type": visual_type,
        "visual": _normalize_visual(value.get("visual"), visual_type, key_point, narration),
        "check": check,
        "suggested_seconds": max(20, min(90, suggested_seconds)),
    }, check_count + (1 if check else 0)


def normalize_dynamic_explanation(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("动态讲解不是有效对象")
    scenes: list[dict] = []
    check_count = 0
    source_scenes = raw.get("scenes") if isinstance(raw.get("scenes"), list) else []
    for source in source_scenes[:10]:
        scene, check_count = _normalize_scene(source, len(scenes), check_count)
        if scene:
            scenes.append(scene)
    if not 3 <= len(scenes) <= 10:
        raise ValueError("互动学习演示需要 3 到 10 个完整场景")
    title = _clean(raw.get("title"), 90) or "当前主题互动学习演示"
    summary = _clean(raw.get("summary"), 240) or "用可播放的图文与互动步骤理解当前主题。"
    highlights = [_clean(item, 100) for item in raw.get("highlights", []) if _clean(item, 100)][:5]
    palette = _clean(raw.get("palette"), 16).lower()
    return {
        "schema_version": 3,
        "title": title,
        "summary": summary,
        "highlights": highlights or [scene["key_point"] for scene in scenes[:3]],
        "palette": palette if palette in _PALETTES else "sage",
        "scenes": scenes,
    }


def regenerate_dynamic_explanation_scene(
    presentation: dict,
    scene_id: str,
    source_prompt: str,
) -> dict:
    """Regenerate one presentation scene while keeping the rest of the teaching arc intact."""
    normalized = normalize_dynamic_explanation(presentation)
    scene_index = next((index for index, item in enumerate(normalized["scenes"]) if item["id"] == scene_id), None)
    if scene_index is None:
        raise ValueError("The selected scene does not exist in this presentation")

    current_scene = normalized["scenes"][scene_index]
    context_scenes = [
        {
            "position": index + 1,
            "title": item["title"],
            "key_point": item["key_point"],
            "visual_type": item["visual_type"],
        }
        for index, item in enumerate(normalized["scenes"])
    ]
    response = chat_qwen(
        [
            {
                "role": "system",
                "content": (
                    "You are RHYME's scene editor for an interactive Chinese learning presentation. "
                    "Return exactly one JSON object for the selected scene only. Keep it consistent with the surrounding "
                    "teaching arc, but replace the scene with a clearer, more concrete, visually distinctive version. "
                    "Do not return markdown, a list of slides, or presentation-level fields.\n"
                    "The JSON must contain title, narration, key_point, visual_type, visual, check, suggested_seconds. "
                    "visual_type must be one of concept, journey, sequence, stack, compare, contrast, example, lab, pitfall, "
                    "error-lab, map, recap, code-trace, timeline, network. visual must contain headline, items (up to 5 short concrete labels), before, after, example. "
                    "narration should be 70-220 Chinese characters. Do not add invented course facts. A check is optional and, "
                    "if included, must have 2-4 options with the answer exactly matching one option."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Original learner question: {_clean(source_prompt, 4000)}\n\n"
                    f"Presentation title: {normalized['title']}\n"
                    f"Presentation summary: {normalized['summary']}\n"
                    f"Full scene outline: {json.dumps(context_scenes, ensure_ascii=False)}\n\n"
                    f"Selected scene position: {scene_index + 1}\n"
                    f"Current scene to improve: {json.dumps(current_scene, ensure_ascii=False)}"
                ),
            },
        ],
        temperature=0.3,
        max_tokens=1500,
        json_mode=True,
    )
    candidate = _parse_json(response.choices[0].message.content or "")
    previous_check_count = sum(1 for item in normalized["scenes"][:scene_index] if item.get("check"))
    scene, _ = _normalize_scene(candidate, scene_index, previous_check_count)
    if not scene:
        raise ValueError("The regenerated scene was incomplete")
    return scene


def generate_dynamic_explanation(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
) -> dict:
    """Create a variable-length, browser-safe interactive presentation from a tutoring turn."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are RHYME's interactive learning presentation agent. Turn the supplied tutoring exchange into a "
                "Chinese learning presentation that a browser can render as a rich, interactive HTML learning stage. "
                "It is not a video script and it must not be a fixed six-scene template. Return exactly one JSON object "
                "with title, summary, palette, highlights, and scenes.\n"
                "Choose 3 to 10 scenes from the learning task. A short definition can use 3 or 4 focused scenes. A process, "
                "problem-solving method, examination topic, or difficult misconception may need 7 to 10 scenes. Every scene "
                "must earn its place in the teaching arc.\n"
                "palette must be one of sage, cobalt, ember, plum, ink. Use one coherent palette for the whole presentation.\n"
                "Each scene must contain title, narration, key_point, visual_type, visual, check, suggested_seconds. narration is "
                "a concise spoken explanation of 70 to 220 Chinese characters. key_point is one memorable sentence. "
                "suggested_seconds is 20 to 90.\n"
                "visual_type must be one of concept, journey, sequence, stack, compare, contrast, example, lab, pitfall, error-lab, map, recap, code-trace, timeline, network. "
                "Use several genuinely different visual types when the topic has enough material. concept shows relationships around a core; "
                "journey or sequence shows ordered change; stack shows nested layers or calls; compare or contrast exposes a meaningful before/after; "
                "example or lab lets the learner inspect a concrete case; pitfall or error-lab demonstrates a real wrong path and correction; "
                "map or recap compresses the ideas into a take-away structure. Use code-trace when code, an algorithm, recursion, "
                "or variables need to be stepped through: items must be concrete calls, statements, or state snapshots. Use timeline "
                "when order in time or stages matters. Use network when an idea, packet, signal, or responsibility moves through connected nodes.\n"
                "visual must contain headline, items (up to 5 short concrete labels), before, after, example. The labels must name real steps, "
                "relationships, calls, cases, or checks from the supplied answer. Never fill visuals with generic labels such as 'understand better' "
                "or 'keep learning'. A scene's text and visual should reveal different parts of the same idea instead of repeating each other.\n"
                "You may add at most two checks, placed only after their prerequisite explanation. Each check contains prompt, options (2 to 4), "
                "answer exactly matching an option, and explanation. Do not invent course facts that are absent from the supplied answer."
            ),
        },
        {
            "role": "system",
            "content": (
                "Quality bar: create a coherent teaching arc, not a list of slides. Start from the learner's actual confusion, then make the "
                "mechanism visible, walk through a concrete case, surface a boundary or misconception when useful, and finish with a recallable connection. "
                "The presentation should feel varied and visually rich, but every scene must preserve one clear visual focus."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Current learning state: {json.dumps(learning_state, ensure_ascii=False)}\n\n"
                f"Question: {question[:5000]}\n\n"
                f"Tutor answer: {answer[:10000]}\n\n"
                f"Useful context:\n{_context_text(recent_context)}"
            ),
        },
    ]
    response = chat_qwen(messages, temperature=0.25, max_tokens=3800, json_mode=True)
    result = normalize_dynamic_explanation(_parse_json(response.choices[0].message.content or ""))
    return {
        "title": result["title"],
        "summary": result["summary"],
        "highlights": result["highlights"],
        "explanation": result,
    }
