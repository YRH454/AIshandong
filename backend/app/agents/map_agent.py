"""Generate compact, interactive knowledge maps from a tutoring exchange."""

import json
import hashlib
import logging
import re
from datetime import datetime, timezone
from difflib import SequenceMatcher

from app.services.llm import chat_qwen, chat_qwen_model


logger = logging.getLogger(__name__)


_LAYOUTS = {"mindmap", "flow"}
_ROLES = {"core", "branch", "detail"}
_MAP_TYPES = {"concept_tree", "process_flow", "comparison_map", "system_map", "timeline_map", "causal_map", "relationship_map", "decision_map", "lab_map"}
_NODE_KINDS = {"core", "foundation", "principle", "process", "example", "pitfall"}
_VISUAL_KINDS = {"definition", "sequence", "code", "input_output", "warning", "formula", "comparison", "stack"}
_SEMANTIC_ROLES = {
    "premise", "trigger", "mechanism", "transformation", "result", "verification", "failure",
    "subject", "object", "direction", "condition", "covariation", "exception", "evidence",
    "start", "input", "execution", "state_change", "decision", "output", "review",
    "definition", "inside", "outside", "criterion", "neighbor", "boundary_case", "quick_check",
    "setup", "observation", "variation", "boundary", "formal_name", "meaning", "attributes", "alias",
    "recognition_signal", "confusable", "restatement", "error_origin", "missing_condition", "wrong_branch",
    "consequence", "warning_signal", "correction", "result_check", "components", "near_concept", "example", "self_check",
    "origin", "early_phase", "turning_point", "evolution", "milestone", "current_state", "retrospect",
}
_SCENE_KINDS = {"flow_route", "stack_tower", "input_output_lab", "compare_split", "formula_board", "code_trace", "cause_chain", "pitfall_fork"}
_SCENE_THEMES = {"coral", "violet", "cobalt", "amber", "teal", "rose", "ink", "lime"}
_SCENE_THEME_BY_KIND = {
    "flow_route": "cobalt", "stack_tower": "violet", "input_output_lab": "teal", "compare_split": "amber",
    "formula_board": "ink", "code_trace": "coral", "cause_chain": "lime", "pitfall_fork": "rose",
}
_SCENE_COMPOSITIONS = {
    "editorial_path", "layered_atlas", "experiment_stage", "split_argument",
    "formula_poster", "code_observatory", "causal_landscape", "decision_desk",
}
_VISUAL_LANGUAGES = {
    "quiet_editorial", "technical_blueprint", "paper_collage", "museum_label",
    "studio_notebook", "cinematic_console",
}


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


def _normalize_scene_design(value: object) -> dict:
    """Keep the visual-director payload compact and safe for deterministic UI rendering."""
    raw = value if isinstance(value, dict) else {}
    composition = _clean(raw.get("composition"), 32).lower()
    visual_language = _clean(raw.get("visual_language"), 32).lower()
    annotations: list[dict] = []
    candidates = raw.get("annotations") if isinstance(raw.get("annotations"), list) else []
    for item in candidates[:5]:
        if not isinstance(item, dict):
            continue
        title = _clean(item.get("title"), 48)
        body = _clean(item.get("body"), 180)
        if not title or not body:
            continue
        annotations.append({"label": _clean(item.get("label"), 24), "title": title, "body": body})
    return {
        "composition": composition if composition in _SCENE_COMPOSITIONS else "",
        "visual_language": visual_language if visual_language in _VISUAL_LANGUAGES else "",
        "annotations": annotations,
        "review_prompt": _clean(raw.get("review_prompt"), 160),
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


def _normalize_semantic_role(value: object) -> str:
    role = _clean(value, 32).lower()
    return role if role in _SEMANTIC_ROLES else ""


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


def knowledge_map_deep_dive_fingerprint(source_node: dict, parent_map: dict) -> str:
    """Return a stable cache key for one node's current learning context."""
    connected_ids = {
        edge.get("to") if edge.get("from") == source_node.get("id") else edge.get("from")
        for edge in parent_map.get("edges", []) if isinstance(edge, dict)
        if edge.get("from") == source_node.get("id") or edge.get("to") == source_node.get("id")
    }
    neighbours = [
        {
            "label": node.get("label"),
            "detail": node.get("detail"),
            "kind": node.get("kind"),
        }
        for node in parent_map.get("nodes", []) if isinstance(node, dict) and node.get("id") in connected_ids
    ]
    payload = {
        "source": {
            "id": source_node.get("id"), "label": source_node.get("label"),
            "detail": source_node.get("detail"), "example": source_node.get("example"),
            "mistake": source_node.get("mistake"), "visual": source_node.get("visual"),
        },
        "neighbours": neighbours,
        "map_type": parent_map.get("map_type"),
    }
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:20]


def _source_fragments(answer: str) -> list[str]:
    """Extract useful, readable fragments for the no-network fallback map.

    The fallback is intentionally based on the tutor's actual answer.  It is
    used only if the model call or its JSON envelope is unavailable, so a
    temporary API hiccup never leaves the learner with an unusable map.
    """
    text = re.sub(r"```[\s\S]*?```", " ", answer or "")
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", text)
    text = re.sub(r"[`*_>#|]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    fragments = [
        _clean(part, 220)
        for part in re.split(r"(?<=[。！？；])|(?<=\.)\s+", text)
        if len(_clean(part, 220)) >= 12
    ]
    return fragments[:12] or [_clean(answer, 220) or "围绕当前问题，先识别概念、条件、过程和常见误区。"]


def _fallback_knowledge_map(question: str, answer: str) -> dict:
    """Build a valid, useful map when an upstream model response is malformed.

    This is not a second generic answer: each node cites a different fragment
    from the answer already shown in the conversation.  Keeping this local
    makes the knowledge-map entry point resilient to model timeouts and JSON
    truncation while preserving the existing visual-story experience.
    """
    fragments = _source_fragments(answer)
    clean_question = _clean(re.sub(r"[？?。！!]", "", question or ""), 28)
    core_label = clean_question or "当前学习主题"
    if len(core_label) > 12:
        for marker in ("是什么", "怎么", "如何", "为什么", "请", "用"):
            core_label = core_label.split(marker, 1)[0].strip()
            if len(core_label) <= 12:
                break
    core_label = core_label[:12] or "当前主题"

    def source(index: int) -> str:
        return fragments[min(index, len(fragments) - 1)]

    # A fallback must still feel like a complete map, but the first view is
    # deliberately compact: one core idea plus eight independently readable
    # atoms.  Detailed drill-down is a later interaction, not a second tree
    # squeezed into the overview.
    nodes = [
        {"id": "n1", "label": core_label, "role": "core", "kind": "core", "group": "核心概念", "order": 1, "detail": source(0), "example": source(3), "mistake": "只记住结论，却没有确认它成立的条件。", "visual": {"kind": "definition", "headline": source(0), "items": [source(1)[:64], source(2)[:64]]}},
        {"id": "n2", "parent_id": "n1", "label": "概念边界", "role": "branch", "kind": "foundation", "group": "基础", "order": 2, "detail": source(1), "example": source(2), "mistake": "把相近概念当成同一个概念。", "visual": {"kind": "definition", "headline": "先回答“它是什么”", "items": [source(1)[:64], "用自己的话复述"]}},
        {"id": "n3", "parent_id": "n1", "label": "关键术语", "role": "branch", "kind": "foundation", "group": "基础", "order": 3, "detail": source(2), "example": source(2), "mistake": "只记名称，不知道它在当前问题里指什么。", "visual": {"kind": "comparison", "headline": "相近说法要看适用边界", "before": "相似表述", "after": "实际含义"}},
        {"id": "n4", "parent_id": "n1", "label": "成立机制", "role": "branch", "kind": "principle", "group": "原理", "order": 4, "detail": source(2), "example": source(3), "mistake": "忽略前提，直接套用结论。", "visual": {"kind": "formula", "headline": "条件 → 规则 → 结果", "formula": "满足条件 → 应用规则 → 得到结果"}},
        {"id": "n5", "parent_id": "n1", "label": "关键关系", "role": "branch", "kind": "principle", "group": "原理", "order": 5, "detail": source(3), "example": source(3), "mistake": "只背结果，没有理解变量关系。", "visual": {"kind": "comparison", "headline": "变化前后要对照", "before": "输入与条件", "after": "规则与结论"}},
        {"id": "n6", "parent_id": "n1", "label": "推理路径", "role": "branch", "kind": "process", "group": "过程", "order": 6, "detail": source(3), "example": source(4), "mistake": "跳过中间步骤，只看开始和结论。", "visual": {"kind": "sequence", "headline": "把一次推理走完整", "items": ["识别条件", "执行规则", "检查结果"]}},
        {"id": "n7", "parent_id": "n1", "label": "应用验证", "role": "branch", "kind": "example", "group": "案例", "order": 7, "detail": source(4), "example": source(4), "mistake": "只背抽象描述，不会在题目中识别它。", "visual": {"kind": "input_output", "headline": "用一个例子验证理解", "input": "题目情境", "output": source(4)[:60]}},
        {"id": "n8", "parent_id": "n1", "label": "常见误判", "role": "branch", "kind": "pitfall", "group": "易错点", "order": 8, "detail": source(5), "example": source(5), "mistake": "把定义、条件或步骤中的任意一项遗漏。", "visual": {"kind": "warning", "headline": "先停下来核对前提"}},
        {"id": "n9", "parent_id": "n1", "label": "发展脉络", "role": "branch", "kind": "process", "group": "脉络", "order": 9, "detail": f"回看{core_label}从问题出现、方法形成到当前理解的关键变化。", "example": source(4), "mistake": "只背最终结论，没有理解它为什么会逐步形成。", "visual": {"kind": "sequence", "headline": "起源 → 转折 → 现状", "items": ["最初问题", "关键转折", "当前认识"]}},
    ]
    map_data = {
        "schema_version": 5,
        "layout": "flow" if re.search(r"步骤|过程|调用|算法|执行|函数|代码", f"{question} {answer}") else "mindmap",
        "map_type": "process_flow" if re.search(r"步骤|过程|调用|算法|执行|函数|代码", f"{question} {answer}") else "concept_tree",
        "groups": ["基础", "原理", "过程", "案例", "易错点"],
        "nodes": nodes,
        "edges": [
            {"from": "n1", "to": "n2", "label": "先辨析"}, {"from": "n1", "to": "n3", "label": "确认含义"}, {"from": "n1", "to": "n4", "label": "理解原理"}, {"from": "n1", "to": "n5", "label": "看清关系"},
            {"from": "n1", "to": "n6", "label": "推演过程"}, {"from": "n1", "to": "n7", "label": "放入案例"}, {"from": "n1", "to": "n8", "label": "校验误区"}, {"from": "n1", "to": "n9", "label": "回看演变"},
            {"from": "n2", "to": "n3", "label": "界定"}, {"from": "n3", "to": "n4", "label": "决定前提"}, {"from": "n4", "to": "n6", "label": "指导推理"}, {"from": "n5", "to": "n8", "label": "防止误判"}, {"from": "n6", "to": "n7", "label": "案例验证"}, {"from": "n8", "to": "n9", "label": "纠正"},
        ],
        "learning_path": ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9"],
    }
    map_data["visual_scenes"] = _fallback_visual_scenes(nodes)
    return {
        "title": f"{core_label} · 知识图解",
        "summary": "已根据当前讲解整理出定义、条件、步骤、例子和易错点；模型暂时不可用时仍可继续学习。",
        "highlights": ["先从定义开始，再检查成立条件", "沿学习路径走一遍过程", "用具体例子验证，再回看易错点"],
        "map": map_data,
    }


def _fallback_visual_scenes(nodes: list[dict]) -> list[dict]:
    """Turn the dependable map structure into a varied visual story for older maps too."""
    core = next((node for node in nodes if node["role"] == "core"), nodes[0])
    ordered = sorted((node for node in nodes if node is not core), key=lambda node: node.get("order", 99))
    process_by_id: dict[str, dict] = {}
    for node in nodes:
        if node.get("kind") == "process" or node.get("visual", {}).get("kind") in {"sequence", "stack"}:
            process_by_id[node["id"]] = node
    process = list(process_by_id.values())
    example = next((node for node in nodes if node.get("kind") == "example"), None)
    principle = next((node for node in nodes if node.get("kind") == "principle" or node.get("visual", {}).get("kind") == "formula"), None)
    pitfall = next((node for node in nodes if node.get("kind") == "pitfall"), None)
    scenes: list[dict] = []
    route_nodes = (process if len(process) >= 2 else ordered)[:5]
    if len(route_nodes) >= 2:
        scenes.append({
            "id": "route", "kind": "flow_route", "theme": "cobalt", "title": f"顺着“{core['label']}”走一遍",
            "statement": "把抽象关系改成有先后顺序的理解路线。", "takeaway": " → ".join(node["label"] for node in route_nodes),
            "node_ids": [node["id"] for node in route_nodes], "steps": [node.get("visual", {}).get("headline") or node["detail"] for node in route_nodes],
        })
    if len(process) >= 2:
        scenes.append({
            "id": "stack", "kind": "stack_tower", "theme": "violet", "title": "层层展开，再逐层回到结果",
            "statement": "每一层只处理当前这一层该做的事。", "node_ids": [node["id"] for node in process[:5]],
            "steps": [node["label"] for node in process[:5]],
        })
    if example:
        visual = example.get("visual", {})
        visual_items = visual.get("items") if isinstance(visual.get("items"), list) else []
        scenes.append({
            "id": "lab", "kind": "input_output_lab", "theme": "teal", "title": f"把“{example['label']}”放进实验台",
            "statement": "用一次具体的输入、变化与输出验证理解。", "node_ids": [example["id"]],
            "input": visual.get("input") or (visual_items[0] if visual_items else "") or example.get("example"),
            "output": visual.get("output") or (visual_items[1] if len(visual_items) > 1 else "") or example["detail"],
        })
    if principle:
        visual = principle.get("visual", {})
        scenes.append({
            "id": "formula", "kind": "formula_board", "theme": "ink", "title": f"“{principle['label']}”的关系式",
            "statement": "先看关系，再回到每一个概念的位置。", "node_ids": [principle["id"]],
            "formula": visual.get("formula") or visual.get("headline") or principle["detail"], "takeaway": principle["detail"],
        })
    if pitfall:
        visual = pitfall.get("visual", {})
        scenes.append({
            "id": "fork", "kind": "pitfall_fork", "theme": "rose", "title": f"“{pitfall['label']}”的两条岔路",
            "statement": "把错误路径和正确判断同时看清楚。", "node_ids": [pitfall["id"]],
            "left": pitfall.get("mistake") or visual.get("before") or "忽略必要条件，沿错误路径继续",
            "right": visual.get("after") or pitfall["detail"],
        })
    if len(scenes) < 3 and len(ordered) >= 2:
        candidates = ordered[:4]
        scenes.append({
            "id": "chain", "kind": "cause_chain", "theme": "lime", "title": "把关系连成一条因果线",
            "statement": "每一步都解释下一步为什么会发生。", "node_ids": [node["id"] for node in candidates],
            "steps": [node["label"] for node in candidates],
        })
    return scenes[:5]


def _normalize_visual_scenes(value: object, id_map: dict[str, str], nodes: list[dict]) -> list[dict]:
    valid_ids = {node["id"] for node in nodes}
    raw_scenes = value if isinstance(value, list) else []
    scenes: list[dict] = []
    seen_kinds: set[str] = set()
    for index, candidate in enumerate(raw_scenes[:7], start=1):
        if not isinstance(candidate, dict):
            continue
        kind = _clean(candidate.get("kind"), 32).lower()
        if kind not in _SCENE_KINDS or kind in seen_kinds:
            continue
        node_ids: list[str] = []
        for item in candidate.get("node_ids", []) if isinstance(candidate.get("node_ids"), list) else []:
            mapped = id_map.get(_clean(item, 80))
            if mapped and mapped in valid_ids and mapped not in node_ids:
                node_ids.append(mapped)
        if not node_ids:
            continue
        title = _clean(candidate.get("title"), 80)
        statement = _clean(candidate.get("statement"), 240)
        if not title or not statement:
            continue
        theme = _clean(candidate.get("theme"), 20).lower()
        design = _normalize_scene_design(candidate.get("design"))
        scenes.append({
            "id": re.sub(r"[^A-Za-z0-9_-]", "", _clean(candidate.get("id"), 48)) or f"scene-{index}",
            "kind": kind, "theme": theme if theme in _SCENE_THEMES else _SCENE_THEME_BY_KIND[kind],
            "title": title, "statement": statement, "takeaway": _clean(candidate.get("takeaway"), 180),
            "node_ids": node_ids[:5], "steps": [_clean(item, 140) for item in candidate.get("steps", []) if _clean(item, 140)][:5],
            "left": _clean(candidate.get("left"), 180), "right": _clean(candidate.get("right"), 180),
            "input": _clean(candidate.get("input"), 120), "output": _clean(candidate.get("output"), 120),
            "formula": _clean(candidate.get("formula"), 160), "code": _clean(candidate.get("code"), 260),
            "design": design,
        })
        seen_kinds.add(kind)
        if len(scenes) >= 5:
            break
    for fallback in _fallback_visual_scenes(nodes):
        if len(scenes) >= 3 or len(scenes) >= 5:
            break
        if fallback["kind"] not in seen_kinds:
            scenes.append(fallback)
            seen_kinds.add(fallback["kind"])
    return scenes[:5]


def _normalize_map(raw: object) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("知识图解不是有效对象")

    raw_nodes = raw.get("nodes")
    if not isinstance(raw_nodes, list):
        raw_nodes = []
    nodes: list[dict] = []
    source_ids: dict[str, str] = {}
    labels: set[str] = set()
    # The generated first view is intentionally an overview, never a dense
    # chapter tree.  Keep one core plus at most eight peer knowledge atoms.
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
        normalized_node = {
            "id": node_id,
            "label": label,
            "role": safe_role,
            "kind": safe_kind,
            "group": _clean(candidate.get("group"), 20) or _default_group(safe_kind, safe_role),
            "order": _safe_order(candidate.get("order"), index, 9),
            "detail": detail,
            "example": _clean(candidate.get("example"), 180),
            "mistake": _clean(candidate.get("mistake"), 180),
            "visual": _normalize_visual(candidate.get("visual"), detail=detail, kind=safe_kind),
            "_parent_source": _clean(candidate.get("parent_id"), 80),
        }
        semantic_role = _normalize_semantic_role(candidate.get("semantic_role"))
        if semantic_role:
            normalized_node["semantic_role"] = semantic_role
        nodes.append(normalized_node)
    if len(nodes) < 3:
        raise ValueError("知识图解节点不足，请重新生成")

    core = next((node for node in nodes if node["role"] == "core"), nodes[0])
    for node in nodes:
        if node is not core and node["role"] == "core":
            node["role"] = "branch"
    core["role"] = "core"
    for node in nodes:
        if node is not core:
            node["role"] = "branch"
            node["parent_id"] = core["id"]
        node.pop("_parent_source", None)

    edges: list[dict] = []
    edge_keys: set[tuple[str, str]] = set()
    raw_edges = raw.get("edges") if isinstance(raw.get("edges"), list) else []
    for candidate in raw_edges[:32]:
        if not isinstance(candidate, dict):
            continue
        from_id = source_ids.get(_clean(candidate.get("from"), 80))
        to_id = source_ids.get(_clean(candidate.get("to"), 80))
        if not from_id or not to_id or from_id == to_id or (from_id, to_id) in edge_keys:
            continue
        edges.append({"from": from_id, "to": to_id, "label": _clean(candidate.get("label"), 24)})
        edge_keys.add((from_id, to_id))
    for node in nodes:
        if node is core:
            continue
        key = (node.get("parent_id", core["id"]), node["id"])
        if key not in edge_keys and len(edges) < 48:
            edges.append({"from": key[0], "to": key[1], "label": ""})
            edge_keys.add(key)

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
    visual_scenes = _normalize_visual_scenes(raw.get("visual_scenes"), source_ids, nodes)
    return {
        "schema_version": 5,
        "layout": layout if layout in _LAYOUTS else "mindmap",
        "map_type": map_type,
        "groups": groups,
        "nodes": nodes,
        "edges": edges,
        "learning_path": learning_path,
        "visual_scenes": visual_scenes,
    }


def _deep_dive_map_type(source_node: dict) -> str:
    semantic = f"{source_node.get('label', '')} {source_node.get('group', '')} {source_node.get('kind', '')}"
    if re.search(r"时间脉络|发展脉络|历史|演变|演化|阶段变化", semantic):
        return "timeline_map"
    if re.search(r"关键关系|变量关系|对应关系|相互关系|关联关系|联系", semantic):
        return "relationship_map"
    if re.search(r"成立机制|作用机制|因果|机制|作用|原理", semantic):
        return "causal_map"
    if re.search(r"推理路径|过程|步骤|执行|算法|流程", semantic):
        return "process_flow"
    if re.search(r"边界|范围|对比|区别|异同", semantic):
        return "comparison_map"
    if re.search(r"案例|应用|验证|实验", semantic):
        return "lab_map"
    if re.search(r"误区|错误|误判|陷阱", semantic):
        return "decision_map"
    if re.search(r"术语|关键词|词汇|名词", semantic):
        return "system_map"
    return "concept_tree"


_DEEP_DIVE_BLUEPRINTS: dict[str, list[tuple[str, str, str, str]]] = {
    "relationship_map": [
        ("关系两端", "foundation", "主体", "definition"), ("方向与强度", "principle", "方向", "formula"),
        ("成立条件", "principle", "条件", "stack"), ("变化联动", "process", "联动", "comparison"),
        ("反例边界", "pitfall", "例外", "warning"), ("证据检验", "example", "证据", "input_output"),
        ("迁移判断", "process", "迁移", "sequence"),
    ],
    "causal_map": [
        ("必要前提", "foundation", "输入", "formula"), ("触发信号", "foundation", "识别", "definition"),
        ("核心规则", "principle", "作用", "formula"), ("中间转化", "process", "转化", "comparison"),
        ("可见结果", "example", "输出", "input_output"), ("反事实检验", "example", "验证", "comparison"),
        ("失效诊断", "pitfall", "诊断", "warning"),
    ],
    "process_flow": [
        ("起点输入", "foundation", "准备", "input_output"), ("前置条件", "foundation", "准备", "definition"),
        ("第一动作", "process", "执行", "sequence"), ("状态记录", "process", "追踪", "stack"),
        ("分支判断", "principle", "判断", "comparison"), ("结果输出", "example", "结果", "input_output"),
        ("逆向复核", "pitfall", "校验", "warning"),
    ],
    "comparison_map": [
        ("准确界定", "foundation", "定义", "definition"), ("范围之内", "example", "正例", "input_output"),
        ("范围之外", "pitfall", "反例", "warning"), ("判定条件", "principle", "边界", "formula"),
        ("相邻概念", "principle", "辨析", "comparison"), ("临界变化", "process", "临界", "comparison"),
        ("快速判定", "process", "检查", "sequence"),
    ],
    "lab_map": [
        ("案例设定", "foundation", "情境", "definition"), ("输入条件", "foundation", "输入", "input_output"),
        ("执行动作", "process", "过程", "sequence"), ("关键观察", "principle", "观察", "comparison"),
        ("结果解释", "example", "输出", "input_output"), ("单变量变式", "process", "迁移", "comparison"),
        ("结论边界", "pitfall", "复盘", "warning"),
    ],
    "decision_map": [
        ("错误起点", "pitfall", "风险", "warning"), ("遗漏条件", "foundation", "遗漏", "definition"),
        ("错误分支", "pitfall", "分岔", "comparison"), ("后续影响", "pitfall", "后果", "warning"),
        ("发现信号", "process", "发现", "sequence"), ("纠正动作", "process", "纠正", "stack"),
        ("结果复核", "example", "确认", "input_output"),
    ],
    "timeline_map": [
        ("起源状态", "foundation", "开端", "definition"), ("早期阶段", "foundation", "萌芽", "sequence"),
        ("关键转折", "principle", "转折", "comparison"), ("演变过程", "process", "发展", "sequence"),
        ("阶段里程碑", "example", "里程碑", "input_output"), ("当前状态", "example", "现状", "definition"),
        ("回望与启示", "pitfall", "回望", "warning"),
    ],
    "system_map": [
        ("正式名称", "foundation", "名称", "definition"), ("一句释义", "foundation", "含义", "definition"),
        ("核心属性", "principle", "属性", "stack"), ("相近说法", "example", "别名", "comparison"),
        ("题目信号", "process", "识别", "sequence"), ("易混术语", "pitfall", "辨析", "warning"),
        ("自主复述", "example", "复述", "input_output"),
    ],
    "concept_tree": [
        ("准确释义", "foundation", "定义", "definition"), ("组成要素", "foundation", "结构", "stack"),
        ("适用边界", "principle", "边界", "formula"), ("相近概念", "principle", "辨析", "comparison"),
        ("识别信号", "process", "应用", "sequence"), ("具体例证", "example", "案例", "input_output"),
        ("自检问题", "pitfall", "检查", "warning"),
    ],
}

_DEEP_DIVE_SEMANTIC_ROLES: dict[str, list[str]] = {
    "relationship_map": ["subject", "object", "direction", "condition", "covariation", "exception", "evidence"],
    "causal_map": ["premise", "trigger", "mechanism", "transformation", "result", "verification", "failure"],
    "process_flow": ["start", "input", "execution", "state_change", "decision", "output", "review"],
    "comparison_map": ["definition", "inside", "outside", "criterion", "neighbor", "boundary_case", "quick_check"],
    "lab_map": ["setup", "input", "execution", "observation", "result", "variation", "boundary"],
    "decision_map": ["error_origin", "missing_condition", "wrong_branch", "consequence", "warning_signal", "correction", "result_check"],
    "timeline_map": ["origin", "early_phase", "turning_point", "evolution", "milestone", "current_state", "retrospect"],
    "system_map": ["formal_name", "meaning", "attributes", "alias", "recognition_signal", "confusable", "restatement"],
    "concept_tree": ["definition", "components", "boundary", "near_concept", "recognition_signal", "example", "self_check"],
}

_SEMANTIC_ROLE_PATTERNS: dict[str, tuple[str, ...]] = {
    "premise": ("前提", "基础", "必要", "先决"), "trigger": ("触发", "信号", "启动", "识别"),
    "mechanism": ("机制", "规则", "原理", "作用"), "transformation": ("转化", "变化", "过程", "路径", "展开", "回溯"),
    "result": ("结果", "输出", "结论", "可见"), "verification": ("验证", "检验", "反向", "对比", "校验"),
    "failure": ("失效", "错误", "风险", "负数", "不足", "缺少"), "subject": ("主体", "自变量", "起点对象"),
    "object": ("对象", "因变量", "关联对象"), "direction": ("方向", "强度", "正向", "反向"),
    "condition": ("条件", "前提", "约束"), "covariation": ("联动", "共同变化", "同步", "响应"),
    "exception": ("例外", "冲突", "反例", "边界"), "evidence": ("证据", "验证", "数据", "案例"),
    "start": ("起点", "开始", "目标"), "input": ("输入", "已知", "条件"), "execution": ("执行", "动作", "规则"),
    "state_change": ("状态", "变化", "记录", "追踪"), "decision": ("判断", "分支", "终止", "检查"),
    "output": ("输出", "结果", "答案"), "review": ("复核", "回看", "校验", "逆向"),
    "setup": ("案例", "设定", "情境", "准备"), "observation": ("观察", "变化", "记录", "现象"),
    "variation": ("变式", "变量", "迁移", "改变"), "boundary": ("边界", "限制", "失效", "不能"),
    "origin": ("起源", "开端", "初始", "最初"), "early_phase": ("早期", "萌芽", "第一阶段", "形成"),
    "turning_point": ("转折", "转向", "突破", "关键变化"), "evolution": ("演变", "发展", "推进", "扩展"),
    "milestone": ("里程碑", "节点", "阶段成果", "重要事件"), "current_state": ("当前", "现状", "如今", "最终状态"),
    "retrospect": ("回望", "启示", "复盘", "历史意义"),
}


def _align_deep_dive_semantic_roles(map_data: dict, map_type: str) -> dict:
    expected = _DEEP_DIVE_SEMANTIC_ROLES.get(map_type, _DEEP_DIVE_SEMANTIC_ROLES["concept_tree"])
    nodes = sorted(
        (node for node in map_data.get("nodes", []) if node.get("role") != "core"),
        key=lambda node: node.get("order", 99),
    )
    used: set[str] = set()
    unresolved: list[dict] = []
    for node in nodes:
        role = _normalize_semantic_role(node.get("semantic_role"))
        if role in expected and role not in used:
            node["semantic_role"] = role
            used.add(role)
        else:
            node.pop("semantic_role", None)
            unresolved.append(node)
    for node in list(unresolved):
        semantic_text = f"{node.get('label', '')} {node.get('group', '')} {node.get('detail', '')[:80]}"
        matched = next((
            role for role in expected if role not in used
            and any(pattern in semantic_text for pattern in _SEMANTIC_ROLE_PATTERNS.get(role, ()))
        ), None)
        if matched:
            node["semantic_role"] = matched
            used.add(matched)
            unresolved.remove(node)
    remaining = [role for role in expected if role not in used]
    for node, role in zip(unresolved, remaining):
        node["semantic_role"] = role
    return map_data


def _deep_dive_role_text(label: str, focus: str, fragment: str, index: int) -> tuple[str, str, str]:
    detail_stems = {
        "关系两端": f"先指出{focus}连接的两个具体对象，再说明它们各自在关系中的职责。",
        "方向与强度": f"追踪{focus}从哪一端影响另一端，并判断是同步、反向还是有条件地变化。",
        "成立条件": f"列出让{focus}成立的必要条件；缺少任意一项时，结论都要重新检查。",
        "变化联动": f"固定其他条件，只改变一个量，观察{focus}两端如何连续响应。",
        "反例边界": f"构造一个看似符合但实际破坏关键条件的反例，用它标出{focus}的边界。",
        "证据检验": f"使用题目中的已知量、定义或可观察结果，为{focus}建立可核对的证据链。",
        "必要前提": f"确认{focus}启动前必须已经成立的状态，避免从缺失条件直接跳到结果。",
        "触发信号": f"在题干或现象中找到能证明{focus}已经开始作用的明确信号。",
        "核心规则": f"把{focus}写成条件、作用和结果三段，指出真正产生变化的那条规则。",
        "中间转化": f"描述{focus}发生后第一个被改变的状态，以及它怎样传递到下一状态。",
        "可见结果": f"把内部变化重新连接到原问题，说明最终能观察或计算到什么结果。",
        "反事实检验": f"撤掉一个关键条件或反转输入，检查{focus}的结果是否随之消失或改变。",
        "起点输入": f"明确进入{focus}前手里有哪些输入、目标和当前状态。",
        "前置条件": f"逐项核对执行{focus}前必须满足的约束，避免带着非法状态进入下一步。",
        "第一动作": f"指出{focus}真正执行的第一步，以及这一步读取和改变了什么。",
        "状态记录": f"每完成一步就记录一个关键状态，让{focus}的中间过程可以被复查。",
        "分支判断": f"找到{focus}中决定继续、停止或转向的判断条件。",
        "结果输出": f"说明{focus}结束时输出什么，并把它代回原问题验证。",
    }
    detail = detail_stems.get(label, f"从“{label}”这个角度拆开{focus}，说明它在当前问题中的具体作用。")
    if fragment:
        detail = f"{detail} 对话依据：{fragment}"
    examples = [
        f"定义核对：不用原句复述{focus}，并指出一个不能省略的关键词。",
        f"删项实验：移除一个条件，观察{focus}的结论在哪一步失效。",
        f"变量对照：只改变一个输入，记录{focus}前后两次结果的差别。",
        f"过程跟踪：用箭头写出{focus}的三个连续状态，不允许跳步。",
        f"反例挑战：给出一个表面相似但不满足{focus}的情境，并解释排除理由。",
        f"证据定位：从题干中圈出支持{focus}的两条信息，再给出结论。",
        f"迁移练习：换一个新情境，先判断能否使用{focus}，再说明理由。",
    ]
    mistakes = [
        "把名称记住了，却没有说清定义中的限制条件。",
        "看到相似表述就直接套用，没有核对适用范围。",
        "只写开始和结果，遗漏真正产生变化的中间规则。",
        "同时改变多个条件，导致无法判断究竟是哪一项起作用。",
        "用单个正例代替证明，忽略了反例和边界情况。",
        "结论方向写反，或把相关性误当成因果关系。",
        "得到结果后没有代回原问题，错误在最后一步未被发现。",
    ]
    return _clean(detail, 300), examples[index % len(examples)], mistakes[index % len(mistakes)]


def _timeline_deep_dive_role_text(source_node: dict, parent_map: dict, answer: str) -> dict[str, tuple[str, str, str]]:
    """Build a subject-specific chronicle when the model is unavailable.

    Timeline fallbacks must describe the parent topic's evolution rather than
    treating the clicked "发展脉络" atom as the subject itself.
    """
    parent_nodes = [node for node in parent_map.get("nodes", []) if isinstance(node, dict)]
    core = next((node for node in parent_nodes if node.get("role") == "core"), parent_nodes[0] if parent_nodes else {})
    fragments = _source_fragments(answer)

    def matching(*patterns: str) -> dict:
        return next((
            node for node in parent_nodes
            if any(re.search(pattern, f"{node.get('label', '')} {node.get('group', '')}") for pattern in patterns)
        ), {})

    def node_text(node: dict, field: str, fallback: str) -> str:
        return _clean(node.get(field), 240) or fallback

    subject = _clean(core.get("label"), 36) or _clean(source_node.get("label"), 36) or "当前主题"
    subject_detail = node_text(core, "detail", fragments[0])
    boundary = matching(r"概念边界", r"关键术语", r"定义", r"基础")
    mechanism = matching(r"成立机制", r"关键关系", r"原理", r"机制")
    route = matching(r"推理路径", r"过程", r"步骤", r"流程")
    application = matching(r"应用验证", r"案例", r"实验", r"练习")
    pitfall = matching(r"常见误判", r"错误", r"误区", r"陷阱")

    boundary_name = _clean(boundary.get("label"), 28) or "基础定义与适用边界"
    mechanism_name = _clean(mechanism.get("label"), 28) or "内部关系与成立条件"
    route_name = _clean(route.get("label"), 28) or "可复查的推理路径"
    application_name = _clean(application.get("label"), 28) or "真实问题中的应用验证"

    return {
        "origin": (
            f"“{subject}”的脉络从它最初要解决的问题开始：{subject_detail}",
            f"先写下学习“{subject}”之前无法解释的现象或无法完成的任务，作为整条脉络的起点。",
            "把起源写成最终定义，导致后面的形成过程和关键变化全部消失。",
        ),
        "early_phase": (
            f"早期阶段先建立“{boundary_name}”，统一名称、定义和适用范围，形成后续讨论可以共同使用的基础。",
            node_text(boundary, "example", f"用一个属于“{subject}”的正例和一个只差关键条件的反例划清早期边界。"),
            node_text(boundary, "mistake", "只记名称而没有划清边界，会让相似概念在后续阶段混在一起。"),
        ),
        "turning_point": (
            f"关键转折发生在理解从“记住结论”推进到解释“{mechanism_name}”：学习者开始说清条件怎样触发变化。",
            node_text(mechanism, "example", f"撤掉“{subject}”中的一个必要条件，观察原结论在哪一步不再成立。"),
            node_text(mechanism, "mistake", "只看到前后两个状态，却没有指出真正产生转折的条件或规则。"),
        ),
        "evolution": (
            f"持续演变由“{route_name}”展开：条件被读取、规则被应用、中间状态被记录，理解逐步变成可复查的方法。",
            node_text(route, "example", f"把“{subject}”的一次完整推理写成三个连续状态，并为每次变化标出依据。"),
            node_text(route, "mistake", "从输入直接跳到答案，会掩盖方法在演变过程中真正改变了什么。"),
        ),
        "milestone": (
            f"当“{application_name}”能够独立完成时，“{subject}”便从听懂进入会用：知识可以迁移到新的条件和问题中。",
            node_text(application, "example", f"更换一个输入或情境，重新判断“{subject}”是否仍适用，并用结果验证。"),
            node_text(application, "mistake", "用同一道示例重复原步骤，不能证明已经跨过迁移应用的里程碑。"),
        ),
        "current_state": (
            f"当前对“{subject}”的稳定认识，是把定义、成立条件、推理路径和应用验证合并为一个可解释、可操作、可检查的整体。",
            node_text(core, "example", f"用一句定义、一条成立条件和一个验证动作，完整说明今天如何使用“{subject}”。"),
            node_text(core, "mistake", "只保留最终结论，会丢失支撑当前认识的条件、路径和证据。"),
        ),
        "retrospect": (
            f"回望整条脉络，最有价值的启示来自错误如何被发现和修正：{node_text(pitfall, 'mistake', '每次结论都要回到定义、条件和证据重新核对。')}",
            node_text(pitfall, "example", f"选择“{subject}”中最容易误判的一步，分别写出错误路径和修正后的路径。"),
            "把回望当成重复总结，而没有指出认知变化、错误来源和下一次可复用的检查动作。",
        ),
    }


def _fallback_deep_dive(source_node: dict, parent_map: dict, answer: str) -> dict:
    map_type = _deep_dive_map_type(source_node)
    blueprint = _DEEP_DIVE_BLUEPRINTS[map_type]
    fragments = _source_fragments(answer)
    source_id = _clean(source_node.get("id"), 40) or "node"
    prefix = f"deep-{re.sub(r'[^A-Za-z0-9_-]', '', source_id)[:24] or 'node'}"
    root_id = f"{prefix}-root"
    focus = f"“{_clean(source_node.get('label'), 24) or '当前知识点'}”"
    timeline_text = _timeline_deep_dive_role_text(source_node, parent_map, answer) if map_type == "timeline_map" else {}
    root_detail = _clean(source_node.get("detail"), 300) or fragments[0]
    nodes = [{
        "id": root_id, "label": _clean(source_node.get("label"), 24) or "当前知识点", "role": "core",
        "kind": "core", "group": "深读主题", "order": 1, "detail": root_detail,
        "example": f"先用一句话说明{focus}解决什么问题。",
        "mistake": "只看图形位置，不核对节点之间真实的逻辑关系。",
        "visual": {"kind": "definition", "headline": f"从{focus}进入专题深读"},
    }]
    for index, (label, kind, group, visual_kind) in enumerate(blueprint):
        semantic_role = _DEEP_DIVE_SEMANTIC_ROLES[map_type][index]
        detail, example, mistake = timeline_text.get(semantic_role) or _deep_dive_role_text(
            label, focus, fragments[min(index + 1, len(fragments) - 1)], index,
        )
        visual: dict = {"kind": visual_kind, "headline": detail[:72]}
        if visual_kind in {"sequence", "stack"}:
            visual["items"] = ["定位信息", "执行判断", "核对结果"]
        elif visual_kind == "formula":
            visual["formula"] = "必要条件 + 作用规则 → 可验证结果"
        elif visual_kind == "comparison":
            visual.update({"before": "保持原条件", "after": "改变一个条件"})
        elif visual_kind == "input_output":
            visual.update({"input": "具体题目条件", "output": "可核对的判断"})
        nodes.append({
            "id": f"{prefix}-{index + 1}", "parent_id": root_id, "label": label, "role": "branch",
            "kind": kind, "group": group, "semantic_role": semantic_role,
            "order": index + 2, "detail": detail,
            "example": example, "mistake": mistake, "visual": visual,
        })
    edges = []
    children = nodes[1:]
    if map_type == "process_flow":
        for index, node in enumerate(children):
            edges.append({"from": root_id if index == 0 else children[index - 1]["id"], "to": node["id"], "label": "开始" if index == 0 else "下一步"})
    else:
        edge_labels = ["界定", "拆解", "限定", "追踪", "反证", "验证", "迁移"]
        edges = [{"from": root_id, "to": node["id"], "label": edge_labels[index]} for index, node in enumerate(children)]
    return {
        "schema_version": 11, "layout": "flow" if map_type in {"process_flow", "causal_map", "timeline_map"} else "mindmap",
        "map_type": map_type, "groups": list(dict.fromkeys(node["group"] for node in children)),
        "nodes": nodes, "edges": edges, "learning_path": [node["id"] for node in nodes], "visual_scenes": [],
    }


def _similar_text(left: str, right: str) -> float:
    normalize = lambda value: re.sub(r"[^\w\u4e00-\u9fff]", "", (value or "").lower())
    a, b = normalize(left), normalize(right)
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def _deduplicate_deep_dive_nodes(map_data: dict, source_node: dict, parent_map: dict, answer: str) -> dict:
    fragments = _source_fragments(answer)
    focus = f"“{_clean(source_node.get('label'), 24) or '当前知识点'}”"
    timeline_fallback = None
    if map_data.get("map_type") == "timeline_map":
        # A timeline's replacement copy must preserve chronology semantics;
        # generic relation copy would recreate the visual/content mismatch.
        timeline_fallback = _fallback_deep_dive(source_node, parent_map, answer)
        timeline_fallback = {
            node.get("semantic_role"): node for node in timeline_fallback.get("nodes", []) if node.get("semantic_role")
        }
    seen: dict[str, list[str]] = {"detail": [], "example": [], "mistake": []}
    for index, node in enumerate(map_data.get("nodes", [])):
        if node.get("role") == "core":
            continue
        timeline_node = timeline_fallback.get(node.get("semantic_role")) if timeline_fallback else None
        if timeline_node:
            fallback_detail = timeline_node["detail"]
            fallback_example = timeline_node["example"]
            fallback_mistake = timeline_node["mistake"]
        else:
            fallback_detail, fallback_example, fallback_mistake = _deep_dive_role_text(
                str(node.get("label") or f"角度{index}"), focus,
                fragments[min(index, len(fragments) - 1)], index,
            )
        for field, fallback in (("detail", fallback_detail), ("example", fallback_example), ("mistake", fallback_mistake)):
            value = _clean(node.get(field), 300 if field == "detail" else 180)
            if not value or any(_similar_text(value, previous) >= 0.78 for previous in seen[field]):
                value = fallback
            node[field] = value
            seen[field].append(value)
    return map_data


def _ensure_deep_dive_node_count(map_data: dict, source_node: dict, parent_map: dict, answer: str) -> dict:
    """Supplement truncated model JSON so every deep map keeps seven study angles."""
    nodes = map_data.get("nodes") if isinstance(map_data.get("nodes"), list) else []
    if len(nodes) >= 8:
        return map_data
    fallback = _fallback_deep_dive(source_node, parent_map, answer)
    core = next((node for node in nodes if node.get("role") == "core"), nodes[0] if nodes else None)
    if not core:
        return fallback
    labels = {str(node.get("label") or "") for node in nodes}
    used_ids = {str(node.get("id") or "") for node in nodes}
    edges = map_data.setdefault("edges", [])
    path = map_data.setdefault("learning_path", [str(node.get("id")) for node in nodes])
    for candidate in fallback.get("nodes", [])[1:]:
        if len(nodes) >= 8:
            break
        if candidate.get("label") in labels:
            continue
        base_id = re.sub(r"[^A-Za-z0-9_-]", "", str(candidate.get("id") or "extra"))[:34] or "extra"
        candidate_id = base_id
        suffix = 2
        while candidate_id in used_ids:
            candidate_id = f"{base_id}-{suffix}"
            suffix += 1
        supplemented = {**candidate, "id": candidate_id, "parent_id": core["id"], "order": len(nodes) + 1}
        nodes.append(supplemented)
        labels.add(str(supplemented.get("label") or ""))
        used_ids.add(candidate_id)
        edges.append({"from": core["id"], "to": candidate_id, "label": "补充验证"})
        path.append(candidate_id)
    map_data["nodes"] = nodes
    map_data["groups"] = list(dict.fromkeys(
        [*map_data.get("groups", []), *[node.get("group") for node in nodes if node.get("group")]]
    ))[:8]
    return map_data


def generate_knowledge_map_deep_dive(
    *,
    source_node: dict,
    parent_map: dict,
    question: str,
    answer: str,
    recent_context: list[dict],
) -> dict:
    """Generate one cached, role-specific map after a learner opens a knowledge atom."""
    expected_map_type = _deep_dive_map_type(source_node)
    connected_ids = {
        edge.get("to") if edge.get("from") == source_node.get("id") else edge.get("from")
        for edge in parent_map.get("edges", []) if isinstance(edge, dict)
        if edge.get("from") == source_node.get("id") or edge.get("to") == source_node.get("id")
    }
    neighbours = [
        node for node in parent_map.get("nodes", [])
        if isinstance(node, dict) and node.get("id") in connected_ids
    ][:5]
    fingerprint = knowledge_map_deep_dive_fingerprint(source_node, parent_map)
    prompt_context = {
        "source_node": source_node,
        "connected_nodes": neighbours,
        "expected_map_type": expected_map_type,
        "required_semantic_roles": _DEEP_DIVE_SEMANTIC_ROLES[expected_map_type],
    }
    try:
        response = chat_qwen_model("qwen-flash", [
            {
                "role": "system",
                "content": (
                    "你是 RHYME 的专题深读图 Agent。请只返回一个 JSON 对象，字段为 title、summary、layout、map_type、groups、nodes、edges、learning_path。"
                    "围绕用户点击的一个知识节点，生成 1 个核心节点加 7 个职责互不重复的深读节点。不要生成章节目录，也不要复述总图。"
                    "每个节点必须有 id、parent_id、label、role、kind、group、semantic_role、order、detail、example、mistake、visual。"
                    "detail 必须解释这个节点独有的知识；example 必须是不同教学用途的具体练习、反例、变量对照或验证；mistake 必须是不同错误。"
                    "禁止多个节点复用同一句例子、类比、错误提醒或近义改写。禁止所有节点都使用迷宫、钥匙、道路等同一个类比。"
                    "每个节点的 visual.kind 应按职责选择 definition、sequence、code、input_output、warning、formula、comparison、stack，整图至少使用 5 种。"
                    "公式、步骤、输入输出和对比必须来自给定对话的具体主题，不得只写条件、规则、结果等空占位词。"
                    f"map_type 必须是 {expected_map_type}；layout 在过程或机制图中用 flow，否则用 mindmap。"
                    f"除核心节点外，semantic_role 必须逐一使用且不得重复：{', '.join(_DEEP_DIVE_SEMANTIC_ROLES[expected_map_type])}。"
                    "semantic_role 决定节点在图中的真实位置，内容必须与该身份一致，不能把错误案例标成核心机制，也不能把验证节点标成结果。"
                    + (
                        "这是概念边界判定图。所有内容必须只判断被点击节点本身，不能把相邻章节或同课程的其他知识点误当成正例、反例。"
                        "definition 给出被点击概念的准确含义；inside 和 outside 必须是这个概念的真实正例与反例；"
                        "criterion 必须给出可作出是/否判断的必要条件；neighbor 必须是容易混淆但不同的概念；"
                        "boundary_case 必须保持其他条件不变、只改变一个条件并说明结论为何改变；quick_check 必须给出三个可执行判断步骤。"
                        if expected_map_type == "comparison_map" else ""
                    )
                    + "节点正文控制在 40 到 120 个汉字，例子与误区各控制在 20 到 80 个汉字。"
                ),
            },
            {
                "role": "user",
                "content": (
                    f"原始问题：{question[:4000]}\n\n原始讲解：{answer[:9000]}\n\n"
                    f"被点击节点与相邻关系：{json.dumps(prompt_context, ensure_ascii=False)}\n\n"
                    f"最近对话：\n{_context_text(recent_context)}"
                ),
            },
        ], temperature=0.28, max_tokens=2800, json_mode=True)
        raw = _parse_json(response.choices[0].message.content or "")
        map_data = normalize_edited_knowledge_map({**raw, "map_type": expected_map_type, "deep_maps": {}})
        map_data.pop("deep_maps", None)
        map_data["map_type"] = expected_map_type
        map_data["layout"] = "flow" if expected_map_type in {"process_flow", "causal_map", "timeline_map"} else "mindmap"
        map_data = _ensure_deep_dive_node_count(map_data, source_node, parent_map, answer)
        map_data = _align_deep_dive_semantic_roles(map_data, expected_map_type)
        map_data = _deduplicate_deep_dive_nodes(map_data, source_node, parent_map, answer)
        title = _clean(raw.get("title"), 96) or f"{_clean(source_node.get('label'), 32)} · 专题深读"
        summary = _clean(raw.get("summary"), 240) or "从定义、机制、验证和误区四个方向拆开这个知识点。"
        generation_source = "agent"
    except Exception as exc:
        logger.warning("专题深读图模型输出不可用，启用角色化保底图：%s", exc)
        map_data = _fallback_deep_dive(source_node, parent_map, answer)
        title = f"{_clean(source_node.get('label'), 32)} · 专题深读"
        summary = "已按不同学习职责拆解定义、关系、验证与误区；当前显示可直接学习的基础版本。"
        generation_source = "fallback"
    return {
        **map_data,
        "content_version": 4 if expected_map_type == "comparison_map" else 2,
        "source_node_id": _clean(source_node.get("id"), 48),
        "title": title,
        "summary": summary,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generation_source": generation_source,
        "source_fingerprint": fingerprint,
    }


def _normalize_deep_maps(value: object, parent_node_ids: set[str]) -> dict:
    """Keep lazily generated node deep-dives with the parent knowledge map."""
    if not isinstance(value, dict):
        return {}
    deep_maps: dict[str, dict] = {}
    for raw_source_id, candidate in list(value.items())[:10]:
        source_node_id = _clean(raw_source_id, 48)
        if not source_node_id or source_node_id not in parent_node_ids or not isinstance(candidate, dict):
            continue
        # Deep maps use the same safe editing format as their parent.  Nested
        # maps are intentionally not persisted yet, so one malformed payload
        # cannot recursively enlarge an artifact.
        safe_candidate = {**candidate, "deep_maps": {}}
        try:
            normalized = normalize_edited_knowledge_map(safe_candidate)
        except ValueError:
            continue
        normalized.pop("deep_maps", None)
        normalized["source_node_id"] = source_node_id
        normalized["title"] = _clean(candidate.get("title"), 96) or f"{source_node_id} · 深读图"
        normalized["summary"] = _clean(candidate.get("summary"), 240)
        generated_at = _clean(candidate.get("generated_at"), 48)
        if generated_at:
            normalized["generated_at"] = generated_at
        generation_source = _clean(candidate.get("generation_source"), 16).lower()
        if generation_source in {"agent", "fallback", "local"}:
            normalized["generation_source"] = generation_source
        source_fingerprint = _clean(candidate.get("source_fingerprint"), 40)
        if source_fingerprint:
            normalized["source_fingerprint"] = source_fingerprint
        content_version = candidate.get("content_version")
        if isinstance(content_version, int) and content_version > 0:
            normalized["content_version"] = min(content_version, 20)
        deep_maps[source_node_id] = normalized
    return deep_maps


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
    source_ids: dict[str, str] = {}
    parent_sources: dict[str, str] = {}
    for index, candidate in enumerate(raw_nodes[:24], start=1):
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
            x = max(70, min(1430, float(position.get("x"))))
            y = max(68, min(752, float(position.get("y"))))
            safe_position = {"x": round(x, 1), "y": round(y, 1)}
        except (TypeError, ValueError):
            safe_position = None
        node = {
            "id": node_id,
            "label": label,
            "role": safe_role,
            "kind": safe_kind,
            "group": _clean(candidate.get("group"), 20) or _default_group(safe_kind, safe_role),
            "order": _safe_order(candidate.get("order"), index, 24),
            "detail": detail,
            "example": _clean(candidate.get("example"), 180),
            "mistake": _clean(candidate.get("mistake"), 180),
            "visual": _normalize_visual(candidate.get("visual"), detail=detail, kind=safe_kind),
        }
        semantic_role = _normalize_semantic_role(candidate.get("semantic_role"))
        if semantic_role:
            node["semantic_role"] = semantic_role
        if safe_position:
            node["position"] = safe_position
        nodes.append(node)
        source_ids[supplied_id or node_id] = node_id
        parent_sources[node_id] = _clean(candidate.get("parent_id"), 48)
        used_ids.add(node_id)
        labels.add(label)
    if len(nodes) < 3:
        raise ValueError("知识图解至少需要保留三个节点")

    core = next((node for node in nodes if node["role"] == "core"), nodes[0])
    for node in nodes:
        if node is not core and node["role"] == "core":
            node["role"] = "branch"
    core["role"] = "core"
    non_core = sorted((node for node in nodes if node is not core), key=lambda node: node.get("order", 99))
    branch_nodes = [node for node in non_core if node["role"] == "branch"]
    for node in branch_nodes[6:]:
        node["role"] = "detail"
    branch_nodes = [node for node in non_core if node["role"] == "branch"]
    if len(branch_nodes) < min(4, len(non_core)):
        for node in non_core:
            if node["role"] == "detail":
                node["role"] = "branch"
                branch_nodes.append(node)
                if len(branch_nodes) >= min(4, len(non_core)):
                    break
    for node in nodes:
        parent_id = source_ids.get(parent_sources.get(node["id"], ""))
        if node is not core:
            if parent_id and parent_id != node["id"]:
                node["parent_id"] = parent_id
            elif node["role"] == "detail" and branch_nodes:
                earlier = [branch for branch in branch_nodes if branch.get("order", 99) <= node.get("order", 99)]
                node["parent_id"] = (earlier[-1] if earlier else branch_nodes[(node.get("order", 1) - 1) % len(branch_nodes)])["id"]
            else:
                node["parent_id"] = core["id"]

    edges: list[dict] = []
    edge_keys: set[tuple[str, str]] = set()
    raw_edges = raw.get("edges") if isinstance(raw.get("edges"), list) else []
    for candidate in raw_edges[:32]:
        if not isinstance(candidate, dict):
            continue
        from_id = _clean(candidate.get("from"), 48)
        to_id = _clean(candidate.get("to"), 48)
        if from_id not in used_ids or to_id not in used_ids or from_id == to_id or (from_id, to_id) in edge_keys:
            continue
        edges.append({"from": from_id, "to": to_id, "label": _clean(candidate.get("label"), 24)})
        edge_keys.add((from_id, to_id))
    for node in nodes:
        if node is core:
            continue
        key = (node.get("parent_id", core["id"]), node["id"])
        if key not in edge_keys and len(edges) < 48:
            edges.append({"from": key[0], "to": key[1], "label": "关联"})
            edge_keys.add(key)

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
    visual_scenes = _normalize_visual_scenes(raw.get("visual_scenes"), {node["id"]: node["id"] for node in nodes}, nodes)
    deep_maps = _normalize_deep_maps(raw.get("deep_maps"), used_ids)
    return {
        "schema_version": 5,
        "layout": layout if layout in _LAYOUTS else "mindmap",
        "map_type": map_type,
        "groups": groups,
        "nodes": nodes,
        "edges": edges,
        "learning_path": learning_path,
        "visual_scenes": visual_scenes,
        "deep_maps": deep_maps,
    }


def generate_knowledge_map(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
) -> dict:
    """Return a compact map payload safe for deterministic browser rendering.

    The language model owns the factual map.  The richer, full-screen visual
    scenes are then derived from that stable structure in the client/runtime.
    Asking one response to also write five presentation pages made valid JSON
    responses needlessly fragile, especially for longer tutoring answers.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 的知识图解 Agent。请根据真实对话内容生成一张适合大学生学习的中文知识图解。"
                "图解目标是帮助学生看懂概念关系和学习顺序，不是罗列整章目录。不要虚构课程事实。\n"
                "必须只返回一个 JSON 对象，字段严格为 title、summary、highlights、layout、map_type、groups、nodes、edges、learning_path。\n"
                "layout 只能是 mindmap（概念关系）或 flow（算法、代码、解题步骤）；map_type 只能为 concept_tree、process_flow、comparison_map、system_map、timeline_map、causal_map、relationship_map、decision_map、lab_map 之一。\n"
                "必须按知识结构选图形：概念边界或术语体系用 concept_tree；操作、证明或解题步骤用 process_flow；异同用 comparison_map；"
                "组成部分与协同关系用 system_map；历史演变用 timeline_map；机制与影响用 causal_map；多主体关联用 relationship_map；"
                "条件选择用 decision_map；输入—操作—结果验证用 lab_map。不要为了省事一律使用 concept_tree。\n"
                "nodes 必须有 8 到 9 个节点，推荐 8 个；每项字段为 id、parent_id、label、role、kind、group、order、detail、example、mistake、visual。"
                "role 只能为 core、branch、detail，且只能有一个 core。kind 只能为 core、foundation、principle、process、example、pitfall；"
                "group 使用核心概念、基础、原理、过程、案例、易错点中的合适中文分类。label 不超过 12 个汉字或等长文字，detail 不超过 72 字。\n"
                "这是第一张总览图：core 不写 parent_id；其余所有知识原子都直接以 core 为 parent_id，不能再生成第二层或第三层子节点。"
                "八个知识原子应尽量分别覆盖：概念边界、关键术语、成立机制、关键关系、推理路径、应用验证、常见误判、发展脉络。"
                "最后一个发展脉络用于解释主题从起源、转折到当前认识的演变；不要再生成与常见误判重复的自检动作。\n"
                "visual 是微型教学可视化对象：kind 只能为 definition、sequence、code、input_output、warning、formula、comparison、stack；"
                "可选字段为 headline、items（最多 3 项）、code、input、output、formula、before、after。每个节点都必须有 visual，且内容必须可直接帮助学生理解。\n"
                "视觉多样性是硬性要求：核心概念用 definition；基础可用 definition 或 formula；原理优先 formula 或 comparison；"
                "过程优先 sequence 或 stack；案例优先 input_output 或 code；易错点必须是 warning 或 comparison。"
                "同一张图至少出现 4 种不同 visual.kind，不能把所有节点写成同一种文字卡。formula 给出真实公式或关系式；"
                "sequence/stack 的 items 写真实步骤；input_output 写具体输入和输出；comparison 的 before/after 写真实对比。\n"
                "edges 每项为 from、to、label；from/to 使用 nodes 中的 id，保留 10 到 18 条有意义关系。核心节点必须连接每个知识原子；"
                "可额外保留少量原子之间真实的依赖、因果、验证或易混淆关系，但不要把整张图写成一条流水线。\n"
                "learning_path 是 4 到 10 个 nodes id，按最推荐的学习顺序排列。\n"
                "groups 是节点分类出现的顺序。highlights 是 2 到 4 条简短学习提示。"
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
    try:
        # Eight focused atoms are enough for the first full-screen map. Keeping
        # the payload compact lowers cloud latency without sacrificing the
        # deeper maps, which are generated only when a learner opens a branch.
        response = chat_qwen(messages, temperature=0.2, max_tokens=2800, json_mode=True)
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
    except Exception as exc:
        # A model response may be unavailable or truncated.  The tutor answer
        # is already in hand, so return a real, learnable map instead of
        # turning a recoverable formatting issue into a failed learner task.
        logger.warning("知识图解模型输出不可用，启用本地保底图解：%s", exc)
        return _fallback_knowledge_map(question, answer)
