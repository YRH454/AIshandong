"""Generate compact, interactive knowledge maps from a tutoring exchange."""

import json
import re

from app.services.llm import chat_qwen


_LAYOUTS = {"mindmap", "flow"}
_ROLES = {"core", "branch", "detail"}
_MAP_TYPES = {"concept_tree", "process_flow"}
_NODE_KINDS = {"core", "foundation", "principle", "process", "example", "pitfall"}
_VISUAL_KINDS = {"definition", "sequence", "code", "input_output", "warning", "formula", "comparison", "stack"}


def _default_kind(index: int, role: str) -> str:
    """Give older maps a teaching-oriented presentation without breaking them."""
    if role == "core":
        return "core"
    return ("foundation", "principle", "process", "example", "pitfall")[min(index, 4)]


def _default_group(kind: str, role: str) -> str:
    return {
        "core": "核心概念",
        "foundation": "基础",
        "principle": "原理",
        "process": "过程",
        "example": "案例",
        "pitfall": "易错点",
    }.get(kind, "补充细节" if role == "detail" else "关联概念")


def _normalize_visual(value: object, *, detail: str, kind: str) -> dict:
    raw = value if isinstance(value, dict) else {}
    visual_kind = _clean(raw.get("kind"), 24).lower()
    fallback_kind = {
        "principle": "formula",
        "process": "stack",
        "example": "input_output",
        "pitfall": "warning",
    }.get(kind, "definition")
    items = [_clean(item, 64) for item in raw.get("items", []) if _clean(item, 64)][:3]
    return {
        "kind": visual_kind if visual_kind in _VISUAL_KINDS else fallback_kind,
        "headline": _clean(raw.get("headline"), 72) or detail[:72],
        "items": items,
        "code": _clean(raw.get("code"), 120),
        "input": _clean(raw.get("input"), 60),
        "output": _clean(raw.get("output"), 60),
        "formula": _clean(raw.get("formula"), 120),
        "before": _clean(raw.get("before"), 72),
        "after": _clean(raw.get("after"), 72),
    }


def _safe_order(value: object, fallback: int, maximum: int) -> int:
    try:
        return max(1, min(maximum, int(value)))
    except (TypeError, ValueError):
        return fallback


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


def _clean(value: object, limit: int) -> str:
    return " ".join(str(value or "").strip().split())[:limit]


def _context_text(items: list[dict]) -> str:
    lines: list[str] = []
    for item in items[-4:]:
        role = str(item.get("role") or "user")
        content = _clean(item.get("content"), 1600)
        if content:
            lines.append(f"{role}: {content}")
        image_analysis = item.get("image_analysis")
        if isinstance(image_analysis, dict):
            recognized = _clean(image_analysis.get("recognized_text"), 900)
            points = "、".join(_clean(point, 80) for point in image_analysis.get("knowledge_points", [])[:5])
            if recognized or points:
                lines.append(f"图片识别补充：{recognized}" + (f"；知识点：{points}" if points else ""))
    return "\n".join(lines)


def _normalize_map(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("知识图解不是有效对象")

    raw_nodes = raw.get("nodes")
    if not isinstance(raw_nodes, list):
        raw_nodes = []
    nodes: list[dict] = []
    source_ids: dict[str, str] = {}
    labels: set[str] = set()
    for index, candidate in enumerate(raw_nodes[:9], start=1):
        if not isinstance(candidate, dict):
            continue
        label = _clean(candidate.get("label"), 24)
        if not label or label in labels:
            continue
        node_id = f"n{len(nodes) + 1}"
        source_id = _clean(candidate.get("id"), 80) or node_id
        source_ids[source_id] = node_id
        labels.add(label)
        role = _clean(candidate.get("role"), 20).lower()
        safe_role = role if role in _ROLES else ("core" if not nodes else "branch")
        kind = _clean(candidate.get("kind"), 24).lower()
        safe_kind = kind if kind in _NODE_KINDS else _default_kind(len(nodes) - 1, safe_role)
        detail = _clean(candidate.get("detail"), 300)
        nodes.append({
            "id": node_id,
            "label": label,
            "role": safe_role,
            "kind": safe_kind,
            "group": _clean(candidate.get("group"), 20) or _default_group(safe_kind, safe_role),
            "order": _safe_order(candidate.get("order"), index, 12),
            "detail": detail,
            "example": _clean(candidate.get("example"), 180),
            "mistake": _clean(candidate.get("mistake"), 180),
            "visual": _normalize_visual(candidate.get("visual"), detail=detail, kind=safe_kind),
        })
    if len(nodes) < 3:
        raise ValueError("知识图解节点不足，请重新生成")

    core = next((node for node in nodes if node["role"] == "core"), nodes[0])
    for node in nodes:
        if node is not core and node["role"] == "core":
            node["role"] = "branch"
    core["role"] = "core"

    edges: list[dict] = []
    edge_keys: set[tuple[str, str]] = set()
    raw_edges = raw.get("edges") if isinstance(raw.get("edges"), list) else []
    for candidate in raw_edges[:12]:
        if not isinstance(candidate, dict):
            continue
        from_id = source_ids.get(_clean(candidate.get("from"), 80))
        to_id = source_ids.get(_clean(candidate.get("to"), 80))
        if not from_id or not to_id or from_id == to_id or (from_id, to_id) in edge_keys:
            continue
        edges.append({"from": from_id, "to": to_id, "label": _clean(candidate.get("label"), 24)})
        edge_keys.add((from_id, to_id))
    if not edges:
        edges = [{"from": core["id"], "to": node["id"], "label": ""} for node in nodes if node is not core]

    raw_path = raw.get("learning_path") if isinstance(raw.get("learning_path"), list) else []
    learning_path: list[str] = []
    for item in raw_path:
        node_id = source_ids.get(_clean(item, 80))
        if node_id and node_id not in learning_path:
            learning_path.append(node_id)
    if not learning_path:
        learning_path = [core["id"], *[node["id"] for node in nodes if node is not core]]

    layout = _clean(raw.get("layout"), 20).lower()
    map_type = _clean(raw.get("map_type"), 24).lower()
    map_type = map_type if map_type in _MAP_TYPES else ("process_flow" if layout == "flow" else "concept_tree")
    groups = [_clean(item, 20) for item in raw.get("groups", []) if _clean(item, 20)][:6]
    if not groups:
        groups = list(dict.fromkeys(node["group"] for node in nodes if node["role"] != "core"))
    return {
        "schema_version": 2,
        "layout": layout if layout in _LAYOUTS else "mindmap",
        "map_type": map_type,
        "groups": groups,
        "nodes": nodes,
        "edges": edges,
        "learning_path": learning_path,
    }


def normalize_edited_knowledge_map(raw: object) -> dict:
    """Validate an edited map while preserving user-created ids and positions.

    Generated maps use compact, deterministic ids.  Once a learner begins to
    arrange the canvas, those ids are referenced by progress records and manual
    edges, so this normalizer deliberately keeps valid ids intact instead of
    renumbering the graph like ``_normalize_map`` does.
    """
    if not isinstance(raw, dict):
        raise ValueError("知识图解不是有效对象")

    raw_nodes = raw.get("nodes") if isinstance(raw.get("nodes"), list) else []
    nodes: list[dict] = []
    used_ids: set[str] = set()
    labels: set[str] = set()
    for index, candidate in enumerate(raw_nodes[:14], start=1):
        if not isinstance(candidate, dict):
            continue
        label = _clean(candidate.get("label"), 24)
        if not label or label in labels:
            continue
        supplied_id = _clean(candidate.get("id"), 48)
        node_id = re.sub(r"[^A-Za-z0-9_-]", "", supplied_id)[:40] or f"node-{index}"
        suffix = 2
        base_id = node_id
        while node_id in used_ids:
            node_id = f"{base_id[:34]}-{suffix}"
            suffix += 1
        role = _clean(candidate.get("role"), 20).lower()
        safe_role = role if role in _ROLES else ("core" if not nodes else "branch")
        kind = _clean(candidate.get("kind"), 24).lower()
        safe_kind = kind if kind in _NODE_KINDS else _default_kind(len(nodes) - 1, safe_role)
        detail = _clean(candidate.get("detail"), 300)
        position = candidate.get("position") if isinstance(candidate.get("position"), dict) else {}
        try:
            x = max(55, min(945, float(position.get("x"))))
            y = max(60, min(540, float(position.get("y"))))
            safe_position = {"x": round(x, 1), "y": round(y, 1)}
        except (TypeError, ValueError):
            safe_position = None
        node = {
            "id": node_id,
            "label": label,
            "role": safe_role,
            "kind": safe_kind,
            "group": _clean(candidate.get("group"), 20) or _default_group(safe_kind, safe_role),
            "order": _safe_order(candidate.get("order"), index, 18),
            "detail": detail,
            "example": _clean(candidate.get("example"), 180),
            "mistake": _clean(candidate.get("mistake"), 180),
            "visual": _normalize_visual(candidate.get("visual"), detail=detail, kind=safe_kind),
        }
        if safe_position:
            node["position"] = safe_position
        nodes.append(node)
        used_ids.add(node_id)
        labels.add(label)
    if len(nodes) < 3:
        raise ValueError("知识图解至少需要保留三个节点")

    core = next((node for node in nodes if node["role"] == "core"), nodes[0])
    for node in nodes:
        if node is not core and node["role"] == "core":
            node["role"] = "branch"
    core["role"] = "core"

    edges: list[dict] = []
    edge_keys: set[tuple[str, str]] = set()
    raw_edges = raw.get("edges") if isinstance(raw.get("edges"), list) else []
    for candidate in raw_edges[:28]:
        if not isinstance(candidate, dict):
            continue
        from_id = _clean(candidate.get("from"), 48)
        to_id = _clean(candidate.get("to"), 48)
        if from_id not in used_ids or to_id not in used_ids or from_id == to_id or (from_id, to_id) in edge_keys:
            continue
        edges.append({"from": from_id, "to": to_id, "label": _clean(candidate.get("label"), 24)})
        edge_keys.add((from_id, to_id))
    if not edges:
        edges = [{"from": core["id"], "to": node["id"], "label": "关联"} for node in nodes if node is not core]

    learning_path: list[str] = []
    raw_path = raw.get("learning_path") if isinstance(raw.get("learning_path"), list) else []
    for item in raw_path:
        node_id = _clean(item, 48)
        if node_id in used_ids and node_id not in learning_path:
            learning_path.append(node_id)
    for node in nodes:
        if node["id"] not in learning_path:
            learning_path.append(node["id"])

    layout = _clean(raw.get("layout"), 20).lower()
    map_type = _clean(raw.get("map_type"), 24).lower()
    map_type = map_type if map_type in _MAP_TYPES else ("process_flow" if layout == "flow" else "concept_tree")
    groups = [_clean(item, 20) for item in raw.get("groups", []) if _clean(item, 20)][:6]
    if not groups:
        groups = list(dict.fromkeys(node["group"] for node in nodes if node["role"] != "core"))
    return {
        "schema_version": 3,
        "layout": layout if layout in _LAYOUTS else "mindmap",
        "map_type": map_type,
        "groups": groups,
        "nodes": nodes,
        "edges": edges,
        "learning_path": learning_path,
    }


def generate_knowledge_map(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
) -> dict:
    """Return a compact map payload safe for deterministic browser rendering."""
    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 的知识图解 Agent。请根据真实对话内容生成一张适合大学生学习的中文知识图解。"
                "图解目标是帮助学生看懂概念关系和学习顺序，不是罗列整章目录。不要虚构课程事实。\n"
                "必须只返回一个 JSON 对象，字段严格为 title、summary、highlights、layout、map_type、groups、nodes、edges、learning_path。\n"
                "layout 只能是 mindmap（概念关系）或 flow（算法、代码、解题步骤）；map_type 只能为 concept_tree 或 process_flow。\n"
                "nodes 必须有 5 到 9 个节点；每项字段为 id、label、role、kind、group、order、detail、example、mistake、visual。"
                "role 只能为 core、branch、detail，且只能有一个 core。kind 只能为 core、foundation、principle、process、example、pitfall；"
                "group 使用核心概念、基础、原理、过程、案例、易错点中的合适中文分类。label 不超过 12 个汉字或等长文字，detail 不超过 120 字。\n"
                "visual 是微型教学可视化对象：kind 只能为 definition、sequence、code、input_output、warning、formula、comparison、stack；"
                "可选字段为 headline、items（最多 3 项）、code、input、output、formula、before、after。每个节点都必须有 visual，且内容必须可直接帮助学生理解。\n"
                "视觉多样性是硬性要求：核心概念用 definition；基础可用 definition 或 formula；原理优先 formula 或 comparison；"
                "过程优先 sequence 或 stack；案例优先 input_output 或 code；易错点必须是 warning 或 comparison。"
                "同一张图至少出现 4 种不同 visual.kind，不能把所有节点写成同一种文字卡。formula 给出真实公式或关系式；"
                "sequence/stack 的 items 写真实步骤；input_output 写具体输入和输出；comparison 的 before/after 写真实对比。\n"
                "edges 每项为 from、to、label；from/to 使用 nodes 中的 id，最多 12 条，只保留有意义的关系。\n"
                "learning_path 是 3 到 6 个 nodes id，按最推荐的学习顺序排列。\n"
                "groups 是节点分类出现的顺序。learning_path 是 3 到 6 个 nodes id，按推荐学习顺序排列。highlights 是 2 到 4 条简短学习提示。"
            ),
        },
        {
            "role": "system",
            "content": (
                "Quality bar: create a study map, not a chapter outline. Choose flow only for a real "
                "ordered algorithm, code execution, or solution procedure; otherwise choose mindmap. "
                "Every node detail must state both what it is and why it matters. Each node needs a distinct "
                "teaching role: definition, mechanism, process, worked case, or misconception. The visual payload "
                "must add a concrete second way of understanding it rather than repeating the detail. Use concrete "
                "examples from the supplied exchange and a genuine misconception when evidence supports one. "
                "Keep only necessary edges and label each edge with at most four Chinese characters. Avoid generic "
                "phrases such as learn the basics, understand the concept, or study in depth."
            ),
        },
        {
            "role": "user",
            "content": (
                f"当前学习状态：{json.dumps(learning_state, ensure_ascii=False)}\n\n"
                f"本轮问题：{question[:5000]}\n\n"
                f"本轮讲解：{answer[:10000]}\n\n"
                f"必要上下文：\n{_context_text(recent_context)}"
            ),
        },
    ]
    response = chat_qwen(messages, temperature=0.2, max_tokens=2200, json_mode=True)
    result = _parse_json(response.choices[0].message.content or "")
    map_data = _normalize_map(result)
    title = _clean(result.get("title"), 80) or "当前主题知识图解"
    summary = _clean(result.get("summary"), 240) or "用概念关系和推荐顺序梳理当前学习内容。"
    highlights = [_clean(item, 100) for item in result.get("highlights", []) if _clean(item, 100)][:4]
    return {
        "title": title,
        "summary": summary,
        "highlights": highlights or ["点击节点查看定义、例子和易错点", "按推荐顺序理解概念关系"],
        "map": map_data,
    }
