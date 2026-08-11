"""Quiet, multi-agent review for learner-edited knowledge maps."""

from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import re

from app.services.llm import chat_qwen


_KINDS = {"edge", "node_note", "new_node", "review"}
_NOTE_FIELDS = {"detail", "example", "mistake"}
_ROLES = {"branch", "detail"}


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
        return json.loads(match.group(0)) if match else {}


def _ask_agent(instruction: str, map_data: dict, progress: dict) -> list[dict]:
    response = chat_qwen([
        {
            "role": "system",
            "content": (
                "你是学习知识图解的后台协作 Agent。不要解释你的角色，也不要输出 Markdown。"
                "只返回 JSON 对象：{\"suggestions\":[...] }。每个 suggestion 最多 1 条简洁 reason。"
                "你只能建议，不得捏造课程事实；有把握时最多给 2 条。\n" + instruction
            ),
        },
        {
            "role": "user",
            "content": "当前图解：\n" + json.dumps(map_data, ensure_ascii=False) + "\n\n学习进度：\n" + json.dumps(progress, ensure_ascii=False),
        },
    ], temperature=0.2, max_tokens=1200, json_mode=True)
    raw = _parse_json(response.choices[0].message.content or "")
    return raw.get("suggestions", []) if isinstance(raw.get("suggestions"), list) else []


def _normalize_suggestion(raw: object, node_ids: set[str]) -> dict | None:
    if not isinstance(raw, dict):
        return None
    kind = _clean(raw.get("kind"), 20)
    reason = _clean(raw.get("reason"), 110)
    if kind not in _KINDS or not reason:
        return None
    if kind == "edge":
        from_id, to_id = _clean(raw.get("from"), 48), _clean(raw.get("to"), 48)
        if from_id not in node_ids or to_id not in node_ids or from_id == to_id:
            return None
        return {"kind": kind, "from": from_id, "to": to_id, "label": _clean(raw.get("label"), 24) or "关联", "reason": reason}
    if kind == "node_note":
        node_id = _clean(raw.get("node_id"), 48)
        field = _clean(raw.get("field"), 20)
        value = _clean(raw.get("value"), 180)
        if node_id not in node_ids or field not in _NOTE_FIELDS or not value:
            return None
        return {"kind": kind, "node_id": node_id, "field": field, "value": value, "reason": reason}
    if kind == "new_node":
        label = _clean(raw.get("label"), 24)
        detail = _clean(raw.get("detail"), 220)
        from_id = _clean(raw.get("from"), 48)
        role = _clean(raw.get("role"), 20)
        if not label or not detail or from_id not in node_ids:
            return None
        return {
            "kind": kind, "label": label, "detail": detail, "from": from_id,
            "role": role if role in _ROLES else "detail",
            "label_edge": _clean(raw.get("label_edge"), 24) or "补充",
            "reason": reason,
        }
    node_id = _clean(raw.get("node_id"), 48)
    if node_id not in node_ids:
        return None
    return {"kind": kind, "node_id": node_id, "reason": reason}


def collaborate_on_knowledge_map(map_data: dict, progress: dict) -> dict:
    """Run structural, comprehension, and study-path reviewers concurrently.

    Their identities remain an implementation detail.  The learner receives one
    compact, deduplicated set of changes that they can individually accept.
    """
    node_ids = {str(node.get("id") or "") for node in map_data.get("nodes", []) if isinstance(node, dict)}
    instructions = [
        "检查概念依赖和连线是否缺失。只建议 edge 或 new_node；字段分别为 kind,from,to,label,reason，或 kind,label,detail,from,role,label_edge,reason。",
        "检查每个节点是否足够让学生看懂。只建议 node_note；字段为 kind,node_id,field(detail/example/mistake),value,reason。",
        "结合学习进度检查最应该回看的节点。只建议 review；字段为 kind,node_id,reason。不要把已理解的节点反复标记。",
    ]
    candidates: list[dict] = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(_ask_agent, instruction, map_data, progress) for instruction in instructions]
        for future in as_completed(futures):
            try:
                candidates.extend(future.result())
            except Exception:
                continue

    suggestions: list[dict] = []
    fingerprints: set[str] = set()
    for raw in candidates:
        suggestion = _normalize_suggestion(raw, node_ids)
        if not suggestion:
            continue
        fingerprint = json.dumps(suggestion, ensure_ascii=False, sort_keys=True)
        if fingerprint in fingerprints:
            continue
        suggestions.append(suggestion)
        fingerprints.add(fingerprint)
        if len(suggestions) >= 4:
            break
    return {
        "summary": "已从结构、理解与复习路径三个角度检查这张图解。" if suggestions else "图解结构已经比较完整，暂时没有需要强行修改的地方。",
        "suggestions": suggestions,
    }
