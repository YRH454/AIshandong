"""Generate browser-safe, scene-based interactive learning presentations."""

from collections.abc import Callable
import json
import logging
import re

from app.services.llm import chat_qwen


logger = logging.getLogger(__name__)


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
_SCENE_ENGINES = {"process", "state", "comparison", "spatial", "timeline", "experiment", "story"}
_TEACHING_PHASES = {"question", "intuition", "mechanism", "verification", "boundary", "synthesis"}
_PATH_ROLES = {"main", "remediation", "advanced"}
_BRANCH_CONDITIONS = {"incorrect", "correct", "blocked", "boundary", "incomplete", "complete", "default"}
_STAGE_KINDS = {
    "service-flow",
    "number-transform",
    "instruction-cycle",
    "storage-hierarchy",
    "pipeline-overlap",
    "hazard-lab",
    "performance-lab",
    "process-lab",
    "concept-constellation",
    "causal-chain",
    "timeline-river",
    "comparison-studio",
    "system-network",
    "state-machine",
    "case-lab",
    "parameter-lab",
}
_BEAT_ACTIONS = {"spawn", "focus", "move", "change", "branch", "return", "resolve"}
_BEAT_TONES = {"guide", "emphasis", "question", "correction", "challenge", "conclusion"}
_FALLBACK_VISUAL_TYPES = ("concept", "journey", "stack", "code-trace", "contrast", "lab", "timeline", "network", "map", "recap")
_GENERAL_STAGE_KINDS = (
    "concept-constellation",
    "causal-chain",
    "timeline-river",
    "comparison-studio",
    "system-network",
    "state-machine",
    "case-lab",
    "parameter-lab",
)
_STAGE_ENGINE_COMPATIBILITY = {
    "process": {"causal-chain", "timeline-river", "system-network", "comparison-studio", "case-lab", "process-lab", "instruction-cycle", "pipeline-overlap", "service-flow"},
    "state": {"state-machine", "system-network", "parameter-lab", "comparison-studio", "storage-hierarchy", "hazard-lab", "number-transform", "instruction-cycle"},
    "comparison": {"comparison-studio", "case-lab", "causal-chain", "state-machine", "hazard-lab", "performance-lab"},
    "spatial": {"concept-constellation", "system-network", "comparison-studio", "case-lab", "storage-hierarchy", "service-flow"},
    "timeline": {"timeline-river", "causal-chain", "case-lab", "comparison-studio", "pipeline-overlap"},
    "experiment": {"parameter-lab", "case-lab", "comparison-studio", "state-machine", "performance-lab", "hazard-lab", "number-transform"},
    "story": {"case-lab", "concept-constellation", "timeline-river", "comparison-studio", "causal-chain"},
}
_GENERIC_VISUAL_LABELS = {
    "核心概念", "关键属性", "成立条件", "实际应用", "起因", "作用机制", "中间变化", "最终结果",
    "输入", "规则", "变化", "结果", "要点", "知识点", "过程", "阶段", "案例", "结论",
    "理解", "掌握", "继续学习", "深入理解", "方案a", "方案b", "关键条件", "选择依据",
}
_GENERIC_ATOM_SIGNATURES = {_text for _text in (re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", label.lower()) for label in _GENERIC_VISUAL_LABELS) if _text}
_RICH_SCENE_ATOM_TARGETS = {
    "concept-constellation": 4,
    "causal-chain": 5,
    "timeline-river": 4,
    "comparison-studio": 5,
    "system-network": 4,
    "state-machine": 4,
    "case-lab": 4,
    "parameter-lab": 4,
}
_MEANINGFUL_DIRECTOR_ACTIONS = {"move", "change", "branch", "return"}
_STAGE_MOTION_CORE_ACTIONS = {
    "concept-constellation": "branch",
    "causal-chain": "move",
    "timeline-river": "move",
    "comparison-studio": "change",
    "system-network": "move",
    "state-machine": "change",
    "case-lab": "branch",
    "parameter-lab": "change",
    "service-flow": "move",
    "number-transform": "change",
    "instruction-cycle": "move",
    "storage-hierarchy": "move",
    "pipeline-overlap": "move",
    "hazard-lab": "branch",
    "performance-lab": "change",
}
_STAGE_MOTION_SEQUENCES = {
    "concept-constellation": ("spawn", "focus", "branch", "return", "resolve"),
    "causal-chain": ("spawn", "focus", "move", "change", "resolve"),
    "timeline-river": ("spawn", "move", "change", "return", "resolve"),
    "comparison-studio": ("spawn", "focus", "change", "branch", "resolve"),
    "system-network": ("spawn", "move", "focus", "branch", "resolve"),
    "state-machine": ("spawn", "move", "change", "return", "resolve"),
    "case-lab": ("spawn", "focus", "branch", "change", "resolve"),
    "parameter-lab": ("spawn", "focus", "change", "move", "resolve"),
}

_SCENE_PAYLOAD_MINIMUMS = {
    "concept-constellation": ("core", "branches", "boundary_conditions", "cross_links"),
    "causal-chain": ("trigger", "steps", "outcome", "blockers"),
    "timeline-river": ("events", "period_label", "retrospective"),
    "comparison-studio": ("shared_condition", "dimensions", "left_title", "right_title", "recommendation"),
    "system-network": ("nodes", "edges", "inputs", "outputs", "feedback_loops"),
    "state-machine": ("states", "transitions", "initial_state", "terminal_states", "exception_paths"),
    "case-lab": ("background", "evidence", "reasoning_steps", "conclusion", "counterevidence"),
    "parameter-lab": ("parameter_label", "min", "max", "initial", "thresholds", "response_points", "stable_range"),
}
_SCENE_PAYLOAD_PROMPT = (
    "Every general stage must also contain scene_payload. scene_payload.kind must exactly equal stage.kind, and visual.items is only a short legacy summary, never the primary scene data. "
    "Use the matching protocol: concept-constellation => core, core_detail, branches[{id,label,relation,detail}], boundary_conditions[], cross_links[{from,to,label}]; "
    "causal-chain => trigger, steps[{id,label,mechanism,effect}], outcome, blockers[]; "
    "timeline-river => events[{id,marker,title,change,impact,is_turning_point}], period_label, retrospective; "
    "comparison-studio => shared_condition, dimensions[{label,left,right,deciding_factor}], left_title, right_title, recommendation; "
    "system-network => nodes[{id,label,role,detail}], edges[{from,to,label,direction}], inputs[], outputs[], feedback_loops[{from,to,label}]; "
    "state-machine => states[{id,label,description}], transitions[{from,to,trigger,effect}], initial_state, terminal_states[], exception_paths[{from,to,trigger,effect}]; "
    "case-lab => background, evidence[{id,label,detail,supports}], reasoning_steps[], conclusion, counterevidence[]; "
    "parameter-lab => parameter_label, unit, min, max, initial, thresholds[{value,label,effect}], response_points[{value,label,result}], stable_range{min,max,label}. "
    "A substantial scene must carry enough real material to be explored: normally use four constellation branches, three causal steps plus trigger and outcome, four timeline events, three comparison dimensions, four network nodes, four states, three case evidences, or three parameter thresholds and three response points. "
    "For a genuinely narrow topic, use fewer records only if every remaining fact is specific and necessary. Do not collapse these protocols into a generic node list. Use topic-specific facts, real relation labels, and distinct fact sets in neighboring scenes."
)

_CONTINUITY_PROMPT = (
    "Every scene must contain continuity with teaching_phase, receives, passes, and next_question. "
    "teaching_phase is question, intuition, mechanism, verification, boundary, or synthesis. "
    "receives names the exact conclusion or learner operation carried in from the previous scene; it is empty only for scene 1. "
    "passes names the concrete result this scene hands forward. next_question is the question unlocked by that result. "
    "The chain must be causal and topic-specific, not generic phrases such as 'continue learning'."
)

_VISUAL_ARC_PROMPT = (
    "Choose one visual teaching arc before drafting scenes and make every scene earn a different visual job. "
    "For a concept system, move from core structure to relationship network, boundary contrast, applied case, then synthesis. "
    "For a causal mechanism, move from observable phenomenon to trigger, transmission chain, failure or exception, then prediction. "
    "For chronological change, move from background to stages, turning point, consequence, then retrospective. "
    "For comparison or problem solving, move from a shared condition to deciding dimensions, a wrong path or boundary, a worked case, then a selection rule. "
    "For state or parameter topics, move from initial state to transition or response, threshold, exception, then stable conclusion. "
    "Do not force a fixed scene count: choose the smallest complete arc. Across a lesson of four or more scenes, never repeat the same stage kind plus scene_engine plus visual_type, "
    "and use a stage kind no more than twice. Each scene must visibly do one of: locate, connect, trace, compare, test, diagnose, decide, or synthesize."
)

_CONTENT_COMPOSITION_PROMPT = (
    "Before emitting JSON, silently make a scene composition plan. For every scene decide: (1) the single learning job it performs; (2) the knowledge relation that makes that job visible; "
    "(3) the stage kind whose interaction naturally reveals that relation; (4) four to seven concrete, topic-specific knowledge atoms; and (5) the visible action that changes during the director beats. "
    "The atoms must be named objects, conditions, events, variables, evidence, states, rules, or outcomes from the tutor answer—not headings such as 'key point', 'process', 'step', or 'result'. "
    "A scene that only relabels the same facts in a different diagram is invalid. Neighboring scenes must introduce a new relation, a new question, or a new set of atoms. "
    "Director beats must contain at least three different action types and include a real move, change, branch, or return when the scene describes transfer, comparison, a state, a case, or a parameter. "
    "Keep visual.items as a short reading index; scene_payload is the rich source of truth. Do not output this plan separately."
)

_BRANCHING_PROMPT = (
    "When the topic benefits from adaptation, include at most two optional branch scenes. A substantial lesson with six or more scenes and at least one check or meaningful interaction should normally include one decision point, one remediation scene, and one advanced scene; the total scene count already includes those branches. "
    "A five-scene lesson may use one remediation branch when a common misconception is central. Very short or purely definitional lessons may remain linear. Every scene has path_role: main, remediation, or advanced. "
    "A branch point contains branching with default_next_position, routes, and optional rejoin_position. "
    "Each route contains condition, target_position, label, and reason. condition is incorrect, correct, blocked, boundary, incomplete, complete, or default. "
    "Positions are 1-based scene positions. A remediation scene repairs one named misconception; an advanced scene applies the mastered idea to a harder case. "
    "Place the decision point before its branch scenes. Both branches must rejoin a later main scene, all targets must move forward, and no branch may create a loop. Reserve one of the presentation's two checks for the remediation scene when that branch exists. "
    "Do not add branches merely to decorate the route; use them only where an answer or interaction provides a meaningful diagnostic signal."
)

_BRANCH_BRIEF_PROMPT = (
    "Every remediation or advanced scene must contain branch_brief with trigger, diagnosis, teaching_move, success_evidence, and strategy. "
    "For remediation, diagnosis names one exact misconception revealed by the learner, teaching_move uses a counterexample, guided rebuild, boundary test, or error trace, and success_evidence is a short observable check that proves the gap is repaired. "
    "For advanced, diagnosis names the concept already mastered, teaching_move introduces a harder transfer case, parameter change, or application decision, and success_evidence states what the learner must explain, predict, or produce. "
    "strategy must be contrast-and-correct, guided-rebuild, boundary-test, transfer-challenge, parameter-challenge, or case-application. "
    "A branch must not repeat its source scene's stage kind, visual grammar, title structure, or knowledge atoms. Remediation should usually use error-lab, contrast, case-lab, state-machine, or causal-chain; advanced should usually use parameter-lab, case-lab, system-network, comparison-studio, or another application-centered structure."
)

_BRANCH_STRATEGIES = {
    "contrast-and-correct",
    "guided-rebuild",
    "boundary-test",
    "transfer-challenge",
    "parameter-challenge",
    "case-application",
}


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


def _text_signature(value: object) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", str(value or "").lower())


def _text_similarity(left: object, right: object) -> float:
    a = _text_signature(left)
    b = _text_signature(right)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if min(len(a), len(b)) < 6:
        return 0.8 if a in b or b in a else 0.0
    grams_a = {a[index:index + 2] for index in range(len(a) - 1)}
    grams_b = {b[index:index + 2] for index in range(len(b) - 1)}
    union = grams_a | grams_b
    return len(grams_a & grams_b) / len(union) if union else 0.0


def _scene_terms(scene: dict) -> set[str]:
    values = list(scene.get("visual", {}).get("items") or [])
    values.extend(zone.get("label") for zone in (scene.get("stage") or {}).get("zones", []) if isinstance(zone, dict))
    payload = scene.get("scene_payload") if isinstance(scene.get("scene_payload"), dict) else {}
    for field in ("branches", "steps", "events", "dimensions", "nodes", "states", "evidence", "thresholds", "response_points"):
        for item in payload.get(field, []) if isinstance(payload.get(field), list) else []:
            if isinstance(item, dict):
                values.extend(item.get(key) for key in ("label", "title", "left", "right", "trigger", "effect", "result") if item.get(key))
    return {_text_signature(value) for value in values if len(_text_signature(value)) >= 2}


def _payload_atoms(scene: dict) -> list[str]:
    """Return the topic-bearing objects in a scene payload, not its structural labels."""
    payload = scene.get("scene_payload") if isinstance(scene.get("scene_payload"), dict) else {}
    kind = str(payload.get("kind") or "")
    values: list[object] = []

    def add_records(name: str, *fields: str) -> None:
        for item in payload.get(name, []) if isinstance(payload.get(name), list) else []:
            if isinstance(item, dict):
                values.extend(item.get(field) for field in fields if item.get(field))

    if kind == "concept-constellation":
        values.extend((payload.get("core"), *payload.get("boundary_conditions", [])))
        add_records("branches", "label", "detail")
    elif kind == "causal-chain":
        values.extend((payload.get("trigger"), payload.get("outcome"), *payload.get("blockers", [])))
        add_records("steps", "label", "mechanism", "effect")
    elif kind == "timeline-river":
        values.extend((payload.get("period_label"), payload.get("retrospective")))
        add_records("events", "title", "change", "impact")
    elif kind == "comparison-studio":
        values.extend((payload.get("left_title"), payload.get("right_title"), payload.get("shared_condition"), payload.get("recommendation")))
        add_records("dimensions", "left", "right", "deciding_factor")
    elif kind == "system-network":
        values.extend((*payload.get("inputs", []), *payload.get("outputs", [])))
        add_records("nodes", "label", "detail")
    elif kind == "state-machine":
        add_records("states", "label", "description")
        add_records("transitions", "trigger", "effect")
        add_records("exception_paths", "trigger", "effect")
    elif kind == "case-lab":
        values.extend((payload.get("background"), payload.get("conclusion"), *payload.get("counterevidence", [])))
        add_records("evidence", "label", "detail", "supports")
    elif kind == "parameter-lab":
        values.extend((payload.get("parameter_label"),))
        add_records("thresholds", "label", "effect")
        add_records("response_points", "label", "result")

    atoms: list[str] = []
    seen: set[str] = set()
    for value in values:
        label = _clean(value, 190)
        signature = _text_signature(label)
        if len(signature) < 2 or signature in seen:
            continue
        seen.add(signature)
        atoms.append(label)
    return atoms


def _audit_dynamic_explanation_content(presentation: dict, *, enforce_director_beats: bool = False) -> dict:
    scenes = presentation.get("scenes") if isinstance(presentation.get("scenes"), list) else []
    scene_by_id = {str(scene.get("id") or ""): scene for scene in scenes if isinstance(scene, dict)}
    issues: list[dict] = []
    scene_scores: list[int] = []
    previous_terms: list[set[str]] = []
    previous_scene: dict | None = None
    stage_occurrences: dict[str, int] = {}
    grammar_occurrences: dict[tuple[str, str, str], int] = {}

    for index, scene in enumerate(scenes):
        codes: list[str] = []
        messages: list[str] = []
        penalty = 0
        narration = str(scene.get("narration") or "")
        items = [str(item).strip() for item in scene.get("visual", {}).get("items", []) if str(item).strip()]
        unique_items = {_text_signature(item) for item in items if _text_signature(item)}
        generic_items = [item for item in unique_items if item in _GENERIC_VISUAL_LABELS]
        stage_kind = str((scene.get("stage") or {}).get("kind") or "")
        engine = str(scene.get("scene_engine") or "story")
        payload = scene.get("scene_payload") if isinstance(scene.get("scene_payload"), dict) else None
        continuity = scene.get("continuity") if isinstance(scene.get("continuity"), dict) else {}
        path_role = str(scene.get("path_role") or "main")
        branching = scene.get("branching") if isinstance(scene.get("branching"), dict) else {}
        branch_brief = scene.get("branch_brief") if isinstance(scene.get("branch_brief"), dict) else {}
        director_beats = scene.get("director_beats") if isinstance(scene.get("director_beats"), list) else []
        grammar = (stage_kind, engine, str(scene.get("visual_type") or ""))

        if len(narration) < 60:
            codes.append("thin_narration")
            messages.append("讲解文字过短，缺少形成直觉所需的解释。")
            penalty += 18
        if len(unique_items) < 3:
            codes.append("sparse_visual")
            messages.append("画面中的具体知识要素不足三个。")
            penalty += 20
        if len(generic_items) >= 2:
            codes.append("generic_labels")
            messages.append("画面使用了过多通用占位词，没有落到本主题。")
            penalty += 18
        if stage_kind and stage_kind not in _STAGE_ENGINE_COMPATIBILITY.get(engine, set()):
            codes.append("stage_mismatch")
            messages.append("场景结构与当前知识关系不匹配。")
            penalty += 18
        if enforce_director_beats:
            model_director_beats = [beat for beat in director_beats if isinstance(beat, dict) and beat.get("source") == "model"]
            if len(director_beats) < 3 or len(model_director_beats) < 3:
                codes.append("director_beats_missing")
                messages.append("本幕缺少可逐步执行的导演节拍，无法把讲解逐句绑定到画面对象。")
                penalty += 22
            else:
                beat_ids = [str(beat.get("id") or "") for beat in director_beats]
                narration_signatures = [_text_signature(beat.get("narration")) for beat in director_beats]
                targets = [str(beat.get("target") or "") for beat in director_beats]
                if len(set(beat_ids)) != len(beat_ids) or len(set(narration_signatures)) < max(2, len(director_beats) - 1):
                    codes.append("director_beats_repeat")
                    messages.append("导演节拍存在重复，不能形成逐步推进的讲解。")
                    penalty += 16
                if any(beat.get("target_repaired") for beat in director_beats) or not all(targets) or len(set(targets)) < min(2, len(targets)):
                    codes.append("director_target_invalid")
                    messages.append("导演节拍没有稳定指向画面中的具体对象或状态。")
                    penalty += 18
                actions = {str(beat.get("action") or "") for beat in director_beats}
                if len(actions) < 3 or not actions & _MEANINGFUL_DIRECTOR_ACTIONS:
                    codes.append("director_motion_thin")
                    messages.append("导演节拍缺少真实的传递、变化、分支或回退动作，画面会退化成逐页讲解。")
                    penalty += 18
                if sum(1 for beat in director_beats if beat.get("pause_for_interaction")) > 1:
                    codes.append("director_interaction_overloaded")
                    messages.append("同一幕设置了过多停顿，播放节奏会被打断。")
                    penalty += 12
        if continuity.get("teaching_phase") not in _TEACHING_PHASES or not continuity.get("passes"):
            codes.append("continuity_missing")
            messages.append("本幕没有声明教学阶段或向下一幕传递的结果。")
            penalty += 16
        if index > 0 and not continuity.get("receives"):
            codes.append("continuity_broken")
            messages.append("本幕没有接住上一幕的结论或操作结果。")
            penalty += 18
        if index < len(scenes) - 1 and not continuity.get("next_question"):
            codes.append("next_question_missing")
            messages.append("本幕没有提出由当前结论自然引出的下一问。")
            penalty += 14
        if path_role not in _PATH_ROLES:
            codes.append("invalid_path_role")
            messages.append("本幕没有合法的主线、纠错或进阶角色。")
            penalty += 18
        if path_role in {"remediation", "advanced"}:
            required_branch_fields = ("trigger", "diagnosis", "teaching_move", "success_evidence", "strategy")
            if branch_brief.get("source") == "fallback" or any(not branch_brief.get(field) for field in required_branch_fields):
                codes.append("branch_brief_missing")
                messages.append("支线缺少针对当前学习表现的教学处方。")
                penalty += 24
            if branch_brief.get("strategy") not in _BRANCH_STRATEGIES:
                codes.append("branch_strategy_invalid")
                messages.append("支线没有选择可执行的纠错或迁移策略。")
                penalty += 16
            source_scene = scene_by_id.get(str(continuity.get("source_scene_id") or ""))
            if source_scene:
                source_kind = str((source_scene.get("stage") or {}).get("kind") or "")
                if source_kind and source_kind == stage_kind:
                    codes.append("branch_grammar_repeat")
                    messages.append("支线与分支点仍在使用相同的场景结构，视觉和教学动作没有真正切换。")
                    penalty += 22
                if _text_similarity(scene.get("title"), source_scene.get("title")) >= 0.62:
                    codes.append("branch_title_repeat")
                    messages.append("支线标题与分支点过于接近，没有清楚表达新的教学任务。")
                    penalty += 16
            if path_role == "remediation" and not scene.get("check"):
                codes.append("remediation_check_missing")
                messages.append("纠错支线缺少一次能够确认误区已修复的微型验证。")
                penalty += 18
            if path_role == "advanced" and stage_kind not in {
                "parameter-lab", "case-lab", "system-network", "comparison-studio", "performance-lab", "timeline-river",
            }:
                codes.append("advanced_transfer_missing")
                messages.append("进阶支线还没有进入案例、参数或系统级迁移应用。")
                penalty += 18
        for route in branching.get("routes", []) if isinstance(branching.get("routes"), list) else []:
            target_id = str(route.get("target_scene_id") or "") if isinstance(route, dict) else ""
            target_index = next((position for position, item in enumerate(scenes) if item.get("id") == target_id), -1)
            if target_index <= index:
                codes.append("branch_loop")
                messages.append("分支目标没有向后推进，可能形成循环。")
                penalty += 24
                break
        if stage_kind in _GENERAL_STAGE_KINDS:
            if not payload or payload.get("kind") != stage_kind:
                codes.append("payload_kind_mismatch")
                messages.append("本幕缺少与场景类型一致的专属知识协议。")
                penalty += 22
            else:
                missing_fields = list(payload.get("missing_fields") or [])
                if payload.get("source") == "repaired" or missing_fields:
                    codes.append("payload_incomplete")
                    messages.append("专属场景数据缺少字段：" + "、".join(missing_fields or ["scene_payload"]))
                    penalty += 18
                structural_issue = None
                if stage_kind == "concept-constellation" and len(payload.get("branches") or []) < 3:
                    structural_issue = "概念星图至少需要三个真实分支。"
                elif stage_kind == "causal-chain" and len(payload.get("steps") or []) < 2:
                    structural_issue = "因果链缺少足够的机制步骤。"
                elif stage_kind == "timeline-river" and len(payload.get("events") or []) < 3:
                    structural_issue = "时间河流至少需要三个阶段事件。"
                elif stage_kind == "comparison-studio" and len(payload.get("dimensions") or []) < 2:
                    structural_issue = "对比工作室至少需要两个共同维度。"
                elif stage_kind == "system-network" and (len(payload.get("nodes") or []) < 3 or len(payload.get("edges") or []) < 2):
                    structural_issue = "系统网络需要真实节点与有方向的连接。"
                elif stage_kind == "state-machine" and (len(payload.get("states") or []) < 3 or len(payload.get("transitions") or []) < 2):
                    structural_issue = "状态机需要状态以及带触发条件的转换。"
                elif stage_kind == "case-lab" and (len(payload.get("evidence") or []) < 2 or not payload.get("counterevidence")):
                    structural_issue = "案例实验室需要多条证据和至少一个反证。"
                elif stage_kind == "parameter-lab" and (len(payload.get("thresholds") or []) < 2 or len(payload.get("response_points") or []) < 3):
                    structural_issue = "参数实验台需要多个阈值和响应点。"
                if structural_issue:
                    codes.append("payload_structure_thin")
                    messages.append(structural_issue)
                    penalty += 20

                payload_atoms = _payload_atoms(scene)
                atom_target = _RICH_SCENE_ATOM_TARGETS.get(stage_kind, 4)
                if len(payload_atoms) < atom_target:
                    codes.append("payload_atom_thin")
                    messages.append(f"本幕只有 {len(payload_atoms)} 个可探索的真实知识原子，至少需要 {atom_target} 个。")
                    penalty += 20
                generic_atoms = [atom for atom in payload_atoms if _text_signature(atom) in _GENERIC_ATOM_SIGNATURES]
                if len(generic_atoms) >= 2:
                    codes.append("payload_atoms_generic")
                    messages.append("专属场景数据仍使用了过多通用知识词，缺少主题本身的对象和条件。")
                    penalty += 18

        terms = _scene_terms(scene)
        for earlier_index, earlier in enumerate(scenes[:index]):
            title_similarity = _text_similarity(scene.get("title"), earlier.get("title"))
            point_similarity = _text_similarity(scene.get("key_point"), earlier.get("key_point"))
            narration_similarity = _text_similarity(narration, earlier.get("narration"))
            earlier_terms = previous_terms[earlier_index]
            overlap = len(terms & earlier_terms) / max(1, min(len(terms), len(earlier_terms)))
            if title_similarity >= 0.76 or point_similarity >= 0.78 or narration_similarity >= 0.72:
                codes.append("semantic_repeat")
                messages.append(f"与第 {earlier_index + 1} 幕的讲解内容过于接近。")
                penalty += 24
                break
            if len(terms) >= 3 and len(earlier_terms) >= 3 and overlap >= 0.75:
                codes.append("atom_repeat")
                messages.append(f"与第 {earlier_index + 1} 幕重复使用了几乎相同的知识节点。")
                penalty += 20
                break

        if previous_scene and stage_kind and stage_kind == str((previous_scene.get("stage") or {}).get("kind") or ""):
            codes.append("adjacent_grammar_repeat")
            messages.append("与上一幕连续使用了相同的视觉语法。")
            penalty += 18
        if len(scenes) >= 4 and stage_kind:
            if grammar_occurrences.get(grammar, 0) >= 1:
                codes.append("visual_grammar_repeat")
                messages.append("与前面场景重复使用相同的画面结构、知识行为和视觉类型。")
                penalty += 18
            if stage_occurrences.get(stage_kind, 0) >= 2:
                codes.append("stage_overused")
                messages.append("同一种场景结构使用超过两次，整套讲解缺少画面变化。")
                penalty += 20

        scene_score = max(0, 100 - penalty)
        scene_scores.append(scene_score)
        if codes:
            issues.append({
                "scene_id": scene.get("id") or f"scene-{index + 1}",
                "scene_index": index + 1,
                "title": scene.get("title") or f"第 {index + 1} 幕",
                "severity": min(100, penalty),
                "codes": codes,
                "messages": messages,
            })
        previous_terms.append(terms)
        previous_scene = scene
        if stage_kind:
            stage_occurrences[stage_kind] = stage_occurrences.get(stage_kind, 0) + 1
            grammar_occurrences[grammar] = grammar_occurrences.get(grammar, 0) + 1

    unique_stage_count = len({str((scene.get("stage") or {}).get("kind") or "") for scene in scenes if scene.get("stage")})
    diversity_target = min(4, max(2, (len(scenes) + 1) // 2))
    diversity_penalty = max(0, diversity_target - unique_stage_count) * 6
    score = max(0, round(sum(scene_scores) / max(1, len(scene_scores)) - diversity_penalty))
    severe = [item for item in issues if item["severity"] >= 18]
    status = "ready" if score >= 82 and not severe else "needs_refinement"
    branch_scene_count = sum(1 for scene in scenes if scene.get("path_role") in {"remediation", "advanced"})
    branch_point_count = sum(1 for scene in scenes if (scene.get("branching") or {}).get("routes"))
    return {
        "audit_version": 1,
        "status": status,
        "score": score,
        "scene_count": len(scenes),
        "passed_scene_count": len(scenes) - len(issues),
        "unique_stage_count": unique_stage_count,
        "unique_visual_grammar_count": len(grammar_occurrences),
        "branch_scene_count": branch_scene_count,
        "branch_point_count": branch_point_count,
        "issues": issues,
        "repair_scene_ids": [item["scene_id"] for item in sorted(severe, key=lambda item: item["severity"], reverse=True)[:2]],
        "repaired_scene_ids": [],
    }


def audit_dynamic_explanation(presentation: dict) -> dict:
    """Return a deterministic quality report without calling a model."""
    normalized = normalize_dynamic_explanation(presentation)
    return normalized["quality_report"]


def _report_progress(callback: Callable[[dict], None] | None, **update: object) -> None:
    if not callback:
        return
    try:
        callback(update)
    except Exception:
        logger.debug("dynamic explanation progress callback failed", exc_info=True)


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


def _clean_list(value: object, limit: int = 120, maximum: int = 8) -> list[str]:
    source = value if isinstance(value, list) else []
    return [_clean(item, limit) for item in source if _clean(item, limit)][:maximum]


def _number(value: object, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _payload_sources(scene: dict) -> tuple[list[dict], list[dict], list[str]]:
    actors = list((scene.get("simulation") or {}).get("actors") or [])
    beats = list((scene.get("simulation") or {}).get("beats") or [])
    labels = [actor.get("label") for actor in actors if actor.get("label")]
    if len(labels) < 3:
        labels = [zone.get("label") for zone in (scene.get("stage") or {}).get("zones", []) if zone.get("label")]
    if len(labels) < 3:
        labels = list(scene.get("visual", {}).get("items") or [])
    if len(labels) < 3:
        labels.extend([scene.get("key_point") or scene.get("title"), scene.get("title")])
    return actors, beats, [str(item) for item in labels if item][:7]


def _fallback_scene_payload(scene: dict, kind: str, source: str = "legacy") -> dict | None:
    if kind not in _GENERAL_STAGE_KINDS:
        return None
    actors, beats, labels = _payload_sources(scene)
    narration = scene.get("narration") or ""
    key_point = scene.get("key_point") or scene.get("title") or ""
    headline = scene.get("visual", {}).get("headline") or scene.get("title") or key_point
    details = [beat.get("detail") for beat in beats if beat.get("detail")]
    roles = {actor.get("label"): actor.get("role") for actor in actors}
    meta = {"source": source, "missing_fields": []}

    if kind == "concept-constellation":
        branches = [
            {"id": f"branch-{index + 1}", "label": label, "relation": roles.get(label) or "关联", "detail": details[index] if index < len(details) else key_point}
            for index, label in enumerate(labels[:6])
        ]
        links = [{"from": branches[index]["id"], "to": branches[index + 1]["id"], "label": "相互影响"} for index in range(max(0, len(branches) - 1))]
        return {"kind": kind, "core": headline, "core_detail": key_point, "branches": branches, "boundary_conditions": [key_point], "cross_links": links[:3], **meta}
    if kind == "causal-chain":
        steps = [
            {"id": f"step-{index + 1}", "label": label, "mechanism": details[index] if index < len(details) else narration[:160], "effect": labels[index + 1] if index + 1 < len(labels) else key_point}
            for index, label in enumerate(labels[:6])
        ]
        return {"kind": kind, "trigger": labels[0], "steps": steps, "outcome": labels[-1], "blockers": [f"缺少“{labels[0]}”时，传递链条会被打断"], **meta}
    if kind == "timeline-river":
        events = [
            {"id": f"event-{index + 1}", "marker": roles.get(label) or f"阶段 {index + 1}", "title": label, "change": details[index] if index < len(details) else key_point, "impact": key_point, "is_turning_point": index == max(1, len(labels) // 2)}
            for index, label in enumerate(labels[:6])
        ]
        return {"kind": kind, "events": events, "period_label": headline, "retrospective": key_point, **meta}
    if kind == "comparison-studio":
        midpoint = max(1, (len(labels) + 1) // 2)
        left = labels[:midpoint]
        right = labels[midpoint:] or labels[-midpoint:]
        dimensions = [
            {"label": f"维度 {index + 1}", "left": left[index % len(left)], "right": right[index % len(right)], "deciding_factor": details[index] if index < len(details) else key_point}
            for index in range(min(4, max(2, len(labels) // 2)))
        ]
        return {"kind": kind, "shared_condition": key_point, "dimensions": dimensions, "left_title": scene.get("visual", {}).get("before") or left[0], "right_title": scene.get("visual", {}).get("after") or right[0], "recommendation": key_point, **meta}
    if kind == "system-network":
        nodes = [{"id": f"node-{index + 1}", "label": label, "role": roles.get(label) or "节点", "detail": details[index] if index < len(details) else key_point} for index, label in enumerate(labels[:7])]
        edges = [{"from": nodes[index]["id"], "to": nodes[index + 1]["id"], "label": "传递", "direction": "forward"} for index in range(max(0, len(nodes) - 1))]
        loops = [{"from": nodes[-1]["id"], "to": nodes[0]["id"], "label": "反馈"}] if len(nodes) >= 3 else []
        return {"kind": kind, "nodes": nodes, "edges": edges, "inputs": [nodes[0]["label"]], "outputs": [nodes[-1]["label"]], "feedback_loops": loops, **meta}
    if kind == "state-machine":
        states = [{"id": f"state-{index + 1}", "label": label, "description": details[index] if index < len(details) else key_point} for index, label in enumerate(labels[:6])]
        transitions = [{"from": states[index]["id"], "to": states[index + 1]["id"], "trigger": roles.get(states[index]["label"]) or "条件满足", "effect": states[index + 1]["description"]} for index in range(max(0, len(states) - 1))]
        return {"kind": kind, "states": states, "transitions": transitions, "initial_state": states[0]["id"], "terminal_states": [states[-1]["id"]], "exception_paths": [], **meta}
    if kind == "case-lab":
        evidence = [{"id": f"evidence-{index + 1}", "label": label, "detail": details[index] if index < len(details) else narration[:180], "supports": key_point} for index, label in enumerate(labels[:6])]
        return {"kind": kind, "background": scene.get("visual", {}).get("example") or narration[:200], "evidence": evidence, "reasoning_steps": details[:5] or [key_point], "conclusion": key_point, "counterevidence": [], **meta}

    simulation = scene.get("simulation") or {}
    minimum = float(simulation.get("input_min") if simulation.get("input_min") is not None else 0)
    maximum = float(simulation.get("input_max") if simulation.get("input_max") is not None else 100)
    initial = float(simulation.get("initial_input") if simulation.get("initial_input") is not None else (minimum + maximum) / 2)
    span = maximum - minimum
    thresholds = [
        {"value": minimum + span * ratio, "label": label, "effect": details[index] if index < len(details) else key_point}
        for index, (ratio, label) in enumerate(((.25, "低区间"), (.5, "转折点"), (.75, "高区间")))
    ]
    response_points = [{"value": threshold["value"], "label": threshold["label"], "result": threshold["effect"]} for threshold in thresholds]
    return {"kind": kind, "parameter_label": simulation.get("input_label") or headline, "unit": "", "min": minimum, "max": maximum, "initial": initial, "thresholds": thresholds, "response_points": response_points, "stable_range": {"min": minimum + span * .35, "max": minimum + span * .65, "label": "相对稳定区间"}, **meta}


def _normalize_scene_payload(value: object, scene: dict, kind: str) -> dict | None:
    fallback = _fallback_scene_payload(scene, kind)
    if not fallback:
        return None
    if not isinstance(value, dict):
        return fallback

    raw_kind = _clean(value.get("kind"), 28).lower()
    missing = [field for field in _SCENE_PAYLOAD_MINIMUMS[kind] if value.get(field) in (None, "", [])]
    if raw_kind != kind:
        missing.insert(0, "kind")

    def records(name: str, fields: dict[str, int], maximum: int = 8) -> list[dict]:
        output: list[dict] = []
        source = value.get(name) if isinstance(value.get(name), list) else []
        for index, item in enumerate(source[:maximum]):
            if not isinstance(item, dict):
                continue
            record = {key: _clean(item.get(key), limit) for key, limit in fields.items()}
            record["id"] = record.get("id") or f"{name}-{index + 1}"
            if any(record.get(key) for key in fields if key != "id"):
                output.append(record)
        return output

    payload = dict(fallback)
    if kind == "concept-constellation":
        payload.update({
            "core": _clean(value.get("core"), 100) or fallback["core"],
            "core_detail": _clean(value.get("core_detail"), 180) or fallback["core_detail"],
            "branches": records("branches", {"id": 32, "label": 72, "relation": 44, "detail": 190}) or fallback["branches"],
            "boundary_conditions": _clean_list(value.get("boundary_conditions"), 140, 5) or fallback["boundary_conditions"],
            "cross_links": records("cross_links", {"id": 32, "from": 32, "to": 32, "label": 60}, 8),
        })
    elif kind == "causal-chain":
        payload.update({
            "trigger": _clean(value.get("trigger"), 100) or fallback["trigger"],
            "steps": records("steps", {"id": 32, "label": 72, "mechanism": 190, "effect": 160}) or fallback["steps"],
            "outcome": _clean(value.get("outcome"), 120) or fallback["outcome"],
            "blockers": _clean_list(value.get("blockers"), 150, 5) or fallback["blockers"],
        })
    elif kind == "timeline-river":
        events = records("events", {"id": 32, "marker": 40, "title": 72, "change": 180, "impact": 180}) or fallback["events"]
        source_events = value.get("events") if isinstance(value.get("events"), list) else []
        for index, event in enumerate(events):
            event["is_turning_point"] = bool(source_events[index].get("is_turning_point")) if index < len(source_events) and isinstance(source_events[index], dict) else False
        payload.update({"events": events, "period_label": _clean(value.get("period_label"), 90) or fallback["period_label"], "retrospective": _clean(value.get("retrospective"), 200) or fallback["retrospective"]})
    elif kind == "comparison-studio":
        payload.update({
            "shared_condition": _clean(value.get("shared_condition"), 160) or fallback["shared_condition"],
            "dimensions": records("dimensions", {"id": 32, "label": 64, "left": 140, "right": 140, "deciding_factor": 170}, 6) or fallback["dimensions"],
            "left_title": _clean(value.get("left_title"), 80) or fallback["left_title"],
            "right_title": _clean(value.get("right_title"), 80) or fallback["right_title"],
            "recommendation": _clean(value.get("recommendation"), 190) or fallback["recommendation"],
        })
    elif kind == "system-network":
        payload.update({
            "nodes": records("nodes", {"id": 32, "label": 72, "role": 44, "detail": 180}, 8) or fallback["nodes"],
            "edges": records("edges", {"id": 32, "from": 32, "to": 32, "label": 60, "direction": 24}, 12) or fallback["edges"],
            "inputs": _clean_list(value.get("inputs"), 90, 5) or fallback["inputs"],
            "outputs": _clean_list(value.get("outputs"), 90, 5) or fallback["outputs"],
            "feedback_loops": records("feedback_loops", {"id": 32, "from": 32, "to": 32, "label": 70}, 6),
        })
    elif kind == "state-machine":
        payload.update({
            "states": records("states", {"id": 32, "label": 72, "description": 190}, 7) or fallback["states"],
            "transitions": records("transitions", {"id": 32, "from": 32, "to": 32, "trigger": 100, "effect": 160}, 10) or fallback["transitions"],
            "initial_state": _clean(value.get("initial_state"), 32) or fallback["initial_state"],
            "terminal_states": _clean_list(value.get("terminal_states"), 32, 5) or fallback["terminal_states"],
            "exception_paths": records("exception_paths", {"id": 32, "from": 32, "to": 32, "trigger": 100, "effect": 160}, 6),
        })
    elif kind == "case-lab":
        payload.update({
            "background": _clean(value.get("background"), 220) or fallback["background"],
            "evidence": records("evidence", {"id": 32, "label": 72, "detail": 190, "supports": 120}, 7) or fallback["evidence"],
            "reasoning_steps": _clean_list(value.get("reasoning_steps"), 180, 6) or fallback["reasoning_steps"],
            "conclusion": _clean(value.get("conclusion"), 180) or fallback["conclusion"],
            "counterevidence": _clean_list(value.get("counterevidence"), 180, 5),
        })
    else:
        minimum = _number(value.get("min"), fallback["min"])
        maximum = _number(value.get("max"), fallback["max"])
        if maximum <= minimum:
            maximum = minimum + 100
            missing.append("range")
        initial = min(max(_number(value.get("initial"), fallback["initial"]), minimum), maximum)
        thresholds = records("thresholds", {"id": 32, "label": 70, "effect": 170}, 7)
        raw_thresholds = value.get("thresholds") if isinstance(value.get("thresholds"), list) else []
        for index, threshold in enumerate(thresholds):
            threshold["value"] = _number(raw_thresholds[index].get("value"), minimum) if index < len(raw_thresholds) and isinstance(raw_thresholds[index], dict) else minimum
        response_points = records("response_points", {"id": 32, "label": 70, "result": 170}, 9)
        raw_points = value.get("response_points") if isinstance(value.get("response_points"), list) else []
        for index, point in enumerate(response_points):
            point["value"] = _number(raw_points[index].get("value"), minimum) if index < len(raw_points) and isinstance(raw_points[index], dict) else minimum
        raw_stable = value.get("stable_range") if isinstance(value.get("stable_range"), dict) else {}
        payload.update({
            "parameter_label": _clean(value.get("parameter_label"), 72) or fallback["parameter_label"],
            "unit": _clean(value.get("unit"), 20), "min": minimum, "max": maximum, "initial": initial,
            "thresholds": thresholds or fallback["thresholds"], "response_points": response_points or fallback["response_points"],
            "stable_range": {"min": _number(raw_stable.get("min"), fallback["stable_range"]["min"]), "max": _number(raw_stable.get("max"), fallback["stable_range"]["max"]), "label": _clean(raw_stable.get("label"), 80) or fallback["stable_range"]["label"]},
        })
    payload["kind"] = kind
    payload["source"] = "model" if not missing else "repaired"
    payload["missing_fields"] = list(dict.fromkeys(missing))
    return payload


def _infer_scene_engine(visual_type: str) -> str:
    if visual_type in {"stack", "code-trace"}:
        return "state"
    if visual_type in {"sequence", "journey"}:
        return "process"
    if visual_type in {"compare", "contrast", "pitfall", "error-lab"}:
        return "comparison"
    if visual_type in {"network", "map", "recap", "concept"}:
        return "spatial"
    if visual_type == "timeline":
        return "timeline"
    if visual_type in {"example", "lab"}:
        return "experiment"
    return "story"


def _stage_candidates(scene_engine: str, visual_type: str) -> tuple[str, ...]:
    if scene_engine == "process":
        if visual_type == "timeline":
            return ("timeline-river", "causal-chain", "case-lab", "system-network", "comparison-studio")
        if visual_type in {"pitfall", "error-lab", "contrast"}:
            return ("comparison-studio", "case-lab", "causal-chain", "system-network", "timeline-river")
        return ("causal-chain", "system-network", "case-lab", "comparison-studio", "timeline-river")
    if scene_engine == "state":
        return ("state-machine", "system-network", "parameter-lab", "comparison-studio")
    if scene_engine == "comparison":
        return ("comparison-studio", "case-lab", "causal-chain", "state-machine")
    if scene_engine == "spatial":
        return ("system-network", "concept-constellation", "comparison-studio", "case-lab") if visual_type == "network" else ("concept-constellation", "system-network", "comparison-studio", "case-lab")
    if scene_engine == "timeline":
        return ("timeline-river", "causal-chain", "case-lab", "comparison-studio")
    if scene_engine == "experiment":
        return ("parameter-lab", "case-lab", "comparison-studio", "state-machine")
    return ("case-lab", "concept-constellation", "timeline-river", "comparison-studio")


def _fallback_stage(scene: dict, kind: str) -> dict:
    labels = list(scene.get("visual", {}).get("items") or [])
    actors = list((scene.get("simulation") or {}).get("actors") or [])
    zones: list[dict] = []
    for index, actor in enumerate(actors[:7]):
        zones.append({
            "id": actor.get("id") or f"zone-{index + 1}",
            "label": actor.get("label") or f"知识点 {index + 1}",
            "role": actor.get("role") or "",
            "x": None,
            "y": None,
        })
    if len(zones) < 3:
        zones = [
            {"id": f"zone-{index + 1}", "label": label, "role": "", "x": None, "y": None}
            for index, label in enumerate(labels[:7])
        ]
    interaction_kinds = {
        "concept-constellation",
        "causal-chain",
        "timeline-river",
        "comparison-studio",
        "system-network",
        "state-machine",
        "case-lab",
        "parameter-lab",
    }
    interaction_prompts = {
        "concept-constellation": "选择一个概念，观察它与核心主题的关系。",
        "causal-chain": "点击链条中的一步，检查原因如何传递到结果。",
        "timeline-river": "选择一个节点，查看这一阶段发生了什么变化。",
        "comparison-studio": "切换两侧焦点，找出真正决定差异的条件。",
        "system-network": "选择一个节点，追踪信息或作用如何流动。",
        "state-machine": "选择下一状态，观察触发条件与状态变化。",
        "case-lab": "打开一个证据或步骤，再判断案例结论。",
        "parameter-lab": "调整一个条件，观察结果如何随之改变。",
    }
    return {
        "kind": kind,
        "environment": scene.get("visual", {}).get("headline") or scene["title"],
        "focal_question": scene["key_point"],
        "chapter_label": scene["title"][:24],
        "interaction_prompt": interaction_prompts.get(kind, ""),
        "requires_interaction": kind in interaction_kinds,
        "zones": zones,
        "cues": [],
    }


def _assign_general_stages(scenes: list[dict]) -> None:
    used: dict[str, int] = {}
    previous_kind = ""
    for scene in scenes:
        stage = scene.get("stage")
        raw_kind = str((stage or {}).get("kind") or "")
        compatible = _STAGE_ENGINE_COMPATIBILITY.get(scene["scene_engine"], set())
        should_rebalance = (
            not stage
            or raw_kind not in _STAGE_KINDS
            or raw_kind == "process-lab"
            or raw_kind not in compatible
            or (raw_kind in _GENERAL_STAGE_KINDS and (raw_kind == previous_kind or used.get(raw_kind, 0) >= 2))
        )
        if stage and not should_rebalance:
            kind = raw_kind
            fallback = _fallback_stage(scene, kind)
            scene["stage"] = {
                **fallback,
                **stage,
                "chapter_label": stage.get("chapter_label") or fallback["chapter_label"],
                "interaction_prompt": stage.get("interaction_prompt") or fallback["interaction_prompt"],
                "requires_interaction": stage.get("requires_interaction") or fallback["requires_interaction"],
                "zones": stage.get("zones") or fallback["zones"],
            }
        else:
            candidates = _stage_candidates(scene["scene_engine"], scene["visual_type"])
            candidates = tuple(item for item in candidates if item in compatible and item in _GENERAL_STAGE_KINDS)
            if not candidates:
                candidates = tuple(item for item in _GENERAL_STAGE_KINDS if item in compatible)
            kind = next(
                (item for item in candidates if item != previous_kind and used.get(item, 0) < 2),
                next((item for item in candidates if used.get(item, 0) < 2), candidates[0]),
            )
            fallback = _fallback_stage(scene, kind)
            if stage:
                fallback.update({
                    "environment": stage.get("environment") or fallback["environment"],
                    "focal_question": stage.get("focal_question") or fallback["focal_question"],
                    "chapter_label": stage.get("chapter_label") or fallback["chapter_label"],
                })
            scene["stage"] = fallback
        used[kind] = used.get(kind, 0) + 1
        previous_kind = kind


def _fallback_teaching_phase(index: int, total: int) -> str:
    if total <= 3:
        return ("question", "mechanism", "synthesis")[min(index, 2)]
    if total == 4:
        return ("question", "intuition", "verification", "synthesis")[index]
    if total == 5:
        return ("question", "intuition", "mechanism", "verification", "synthesis")[index]
    if index == 0:
        return "question"
    if index == 1:
        return "intuition"
    if index == total - 1:
        return "synthesis"
    if index == total - 2:
        return "boundary"
    if index >= max(3, total - 3):
        return "verification"
    return "mechanism"


def _assign_continuity(scenes: list[dict]) -> None:
    total = len(scenes)
    for index, scene in enumerate(scenes):
        raw = scene.pop("_raw_continuity", None)
        source = raw if isinstance(raw, dict) else scene.get("continuity") if isinstance(scene.get("continuity"), dict) else {}
        previous = scenes[index - 1] if index > 0 else None
        following = scenes[index + 1] if index + 1 < total else None
        phase = _clean(source.get("teaching_phase"), 20).lower()
        if phase not in _TEACHING_PHASES:
            phase = _fallback_teaching_phase(index, total)
        previous_pass = (previous or {}).get("continuity", {}).get("passes") or (previous or {}).get("key_point") or ""
        next_question = ((following or {}).get("stage") or {}).get("focal_question") or (following or {}).get("key_point") or ""
        scene["continuity"] = {
            "teaching_phase": phase,
            "receives": "" if index == 0 else (_clean(source.get("receives"), 150) or _clean(previous_pass, 150)),
            "passes": _clean(source.get("passes"), 150) or scene.get("key_point") or "",
            "next_question": "" if index == total - 1 else (_clean(source.get("next_question"), 180) or _clean(next_question, 180)),
            "source_scene_id": previous.get("id") if previous else "",
        }


def _scene_position(value: object, total: int) -> int | None:
    if isinstance(value, str):
        match = re.search(r"(\d+)$", value.strip())
        if match:
            value = match.group(1)
    try:
        position = int(value)
    except (TypeError, ValueError):
        return None
    return position if 1 <= position <= total else None


def _assign_branching(scenes: list[dict]) -> None:
    total = len(scenes)
    for index, scene in enumerate(scenes):
        raw_role = scene.pop("_raw_path_role", None)
        role = _clean(raw_role if raw_role is not None else scene.get("path_role"), 20).lower()
        scene["path_role"] = role if role in _PATH_ROLES else "main"

    for index, scene in enumerate(scenes):
        raw = scene.pop("_raw_branching", None)
        source = raw if isinstance(raw, dict) else scene.get("branching") if isinstance(scene.get("branching"), dict) else {}
        default_position = _scene_position(source.get("default_next_position") or source.get("default_next_scene_id"), total)
        rejoin_position = _scene_position(source.get("rejoin_position") or source.get("rejoin_scene_id"), total)
        if default_position is None and index + 1 < total:
            default_position = index + 2
        if scene["path_role"] != "main" and rejoin_position and rejoin_position > index + 1:
            default_position = rejoin_position

        routes: list[dict] = []
        seen_conditions: set[str] = set()
        raw_routes = source.get("routes") if isinstance(source.get("routes"), list) else []
        for raw_route in raw_routes[:4]:
            if not isinstance(raw_route, dict):
                continue
            condition = _clean(raw_route.get("condition"), 20).lower()
            target_position = _scene_position(raw_route.get("target_position") or raw_route.get("target_scene_id"), total)
            if condition not in _BRANCH_CONDITIONS or condition in seen_conditions or target_position is None or target_position <= index + 1:
                continue
            target = scenes[target_position - 1]
            routes.append({
                "condition": condition,
                "target_scene_id": target["id"],
                "label": _clean(raw_route.get("label"), 72) or target.get("title") or "进入分支",
                "reason": _clean(raw_route.get("reason"), 160) or "根据当前学习表现调整讲解路径。",
            })
            seen_conditions.add(condition)

        scene["branching"] = {
            "default_next_scene_id": scenes[default_position - 1]["id"] if default_position and default_position > index + 1 else (scenes[index + 1]["id"] if index + 1 < total else ""),
            "routes": routes,
            "rejoin_scene_id": scenes[rejoin_position - 1]["id"] if rejoin_position and rejoin_position > index + 1 else "",
        }

    scene_by_id = {scene["id"]: scene for scene in scenes}
    for scene in scenes:
        for route in scene.get("branching", {}).get("routes", []):
            target = scene_by_id.get(route.get("target_scene_id"))
            if not target or target.get("path_role") == "main":
                continue
            target.setdefault("continuity", {})["source_scene_id"] = scene["id"]
            target["continuity"]["receives"] = scene.get("continuity", {}).get("passes") or scene.get("key_point") or ""


def _normalize_director_profile(value: object, scenes: list[dict], title: str) -> dict:
    raw = value if isinstance(value, dict) else {}
    phase_plan = [scene.get("continuity", {}).get("teaching_phase") for scene in scenes]
    return {
        "domain": _clean(raw.get("domain"), 48) or "通用学习主题",
        "thread_label": _clean(raw.get("thread_label"), 72) or title,
        "knowledge_structure": _clean(raw.get("knowledge_structure"), 100) or "混合知识结构",
        "teaching_arc": _clean(raw.get("teaching_arc"), 180) or "从核心问题出发，逐步看清结构、机制、案例与应用。",
        "scene_count_reason": _clean(raw.get("scene_count_reason"), 140) or f"当前主题使用 {len(scenes)} 幕完成讲解。",
        "phase_plan": phase_plan,
    }


def _normalize_simulation(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    subject = _clean(value.get("subject"), 100)
    code_lines = [_clean(item, 120) for item in value.get("code_lines", []) if _clean(item, 120)][:8]
    actors: list[dict] = []
    for index, raw_actor in enumerate(value.get("actors", [])[:8] if isinstance(value.get("actors"), list) else []):
        if not isinstance(raw_actor, dict):
            continue
        label = _clean(raw_actor.get("label"), 72)
        if not label:
            continue
        actors.append({
            "id": _clean(raw_actor.get("id"), 32) or f"actor-{index + 1}",
            "label": label,
            "role": _clean(raw_actor.get("role"), 40),
        })
    beats: list[dict] = []
    source_beats = value.get("beats") if isinstance(value.get("beats"), list) else []
    for index, raw_beat in enumerate(source_beats[:16]):
        if not isinstance(raw_beat, dict):
            continue
        label = _clean(raw_beat.get("label"), 90)
        detail = _clean(raw_beat.get("detail"), 190)
        if not label or not detail:
            continue
        action = _clean(raw_beat.get("action"), 16).lower()
        try:
            code_line = int(raw_beat.get("code_line")) if raw_beat.get("code_line") is not None else None
        except (TypeError, ValueError):
            code_line = None
        try:
            duration_ms = int(raw_beat.get("duration_ms")) if raw_beat.get("duration_ms") is not None else None
        except (TypeError, ValueError):
            duration_ms = None
        tone = _clean(raw_beat.get("tone"), 16).lower()
        beats.append({
            "id": _clean(raw_beat.get("id"), 32) or f"beat-{index + 1}",
            "label": label,
            "detail": detail,
            "narration": _clean(raw_beat.get("narration"), 180) or detail,
            "action": action if action in _BEAT_ACTIONS else "focus",
            "target": _clean(raw_beat.get("target"), 48),
            "from": _clean(raw_beat.get("from"), 48),
            "to": _clean(raw_beat.get("to"), 48),
            "value": _clean(raw_beat.get("value"), 64),
            "code_line": max(1, min(8, code_line)) if code_line else None,
            "duration_ms": max(1600, min(8000, duration_ms)) if duration_ms else None,
            "pause_for_interaction": bool(raw_beat.get("pause_for_interaction")),
            "tone": tone if tone in _BEAT_TONES else "guide",
        })
    if len(beats) < 2:
        return None
    experiment = value.get("experiment") if isinstance(value.get("experiment"), dict) else None
    normalized_experiment = None
    if experiment:
        label = _clean(experiment.get("label"), 70)
        description = _clean(experiment.get("description"), 160)
        effect = _clean(experiment.get("effect"), 160)
        if label and description and effect:
            normalized_experiment = {"label": label, "description": description, "effect": effect}
    try:
        initial_input = int(value.get("initial_input")) if value.get("initial_input") is not None else None
    except (TypeError, ValueError):
        initial_input = None
    try:
        input_min = int(value.get("input_min")) if value.get("input_min") is not None else None
        input_max = int(value.get("input_max")) if value.get("input_max") is not None else None
    except (TypeError, ValueError):
        input_min = input_max = None
    return {
        "subject": subject,
        "input_label": _clean(value.get("input_label"), 36),
        "initial_input": initial_input,
        "input_min": input_min,
        "input_max": input_max,
        "code_lines": code_lines,
        "actors": actors,
        "beats": beats,
        "experiment": normalized_experiment,
    }


def _director_target_catalog(scene: dict) -> list[dict]:
    """List the concrete objects a scene director may focus, in display order."""
    targets: list[dict] = []
    seen: set[str] = set()

    def add(identifier: object, label: object, detail: object = "") -> None:
        target_id = _clean(identifier, 48)
        target_label = _clean(label, 90)
        if not target_id or not target_label or target_id in seen:
            return
        seen.add(target_id)
        targets.append({"id": target_id, "label": target_label, "detail": _clean(detail, 190)})

    for zone in (scene.get("stage") or {}).get("zones", []) or []:
        if isinstance(zone, dict):
            add(zone.get("id"), zone.get("label"), zone.get("role"))
    for actor in (scene.get("simulation") or {}).get("actors", []) or []:
        if isinstance(actor, dict):
            add(actor.get("id"), actor.get("label"), actor.get("role"))

    payload = scene.get("scene_payload") if isinstance(scene.get("scene_payload"), dict) else {}
    if payload.get("core"):
        add("core", payload.get("core"), payload.get("core_detail"))
    for field in ("branches", "steps", "events", "dimensions", "nodes", "states", "evidence", "thresholds", "response_points"):
        for index, item in enumerate(payload.get(field, []) if isinstance(payload.get(field), list) else []):
            if not isinstance(item, dict):
                continue
            label = item.get("label") or item.get("title") or item.get("marker") or f"{field}-{index + 1}"
            detail = item.get("detail") or item.get("mechanism") or item.get("change") or item.get("description") or item.get("effect") or item.get("result")
            add(item.get("id") or f"{field}-{index + 1}", label, detail)
    for index, label in enumerate(scene.get("visual", {}).get("items", []) or []):
        add(f"visual-{index + 1}", label, scene.get("key_point"))
    if not targets:
        add("scene-core", scene.get("title"), scene.get("key_point"))
    return targets


def _resolve_director_target(value: object, catalog: list[dict], index: int) -> tuple[dict, bool]:
    requested = _clean(value, 90)
    requested_signature = _text_signature(requested)
    if requested:
        for target in catalog:
            if requested == target["id"] or requested_signature == _text_signature(target["label"]):
                return target, False
    return catalog[index % len(catalog)], bool(requested)


def _director_duration(narration: str) -> int:
    return max(1800, min(6400, 1100 + len(re.sub(r"\s+", "", narration)) * 115))


def _fallback_director_beats(scene: dict, catalog: list[dict]) -> list[dict]:
    """Keep historical presentations playable without pretending their beats came from the model."""
    narration_parts = [
        _clean(part, 220)
        for part in re.split(r"(?<=[。！？!?；;])", str(scene.get("narration") or ""))
        if _clean(part, 220)
    ]
    count = min(6, max(3, min(len(catalog), 5)))
    beats: list[dict] = []
    for index in range(count):
        target = catalog[index % len(catalog)]
        if index == 0:
            narration = f"先把注意力放在“{target['label']}”上，确认它在这一幕中的位置。"
        elif index == count - 1:
            narration = f"回到“{target['label']}”，这一幕的结论是：{scene.get('key_point') or target['detail'] or scene.get('title')}"
        else:
            narration = narration_parts[min(index - 1, len(narration_parts) - 1)] if narration_parts else target["detail"]
            narration = narration or f"接着观察“{target['label']}”如何影响后续关系。"
        beats.append({
            "id": f"fallback-beat-{index + 1}",
            "label": target["label"],
            "detail": target["detail"] or narration,
            "narration": narration,
            "action": "spawn" if index == 0 else "resolve" if index == count - 1 else "focus",
            "target": target["id"],
            "from": catalog[index - 1]["id"] if index else "",
            "to": target["id"],
            "value": "",
            "duration_ms": _director_duration(narration),
            "pause_for_interaction": False,
            "tone": "conclusion" if index == count - 1 else "guide",
            "source": "fallback",
            "target_repaired": False,
        })
    return beats


def _repair_director_actions(beats: list[dict], scene: dict) -> list[dict]:
    """Recover a stage-appropriate action arc without an extra model call.

    A model can name valid targets yet mark every shot as spawn/focus/resolve.
    That replays like a slide deck, even though the stage tells us whether the
    learner should see a transfer, a change, a branch, or a return. Only action
    labels are recovered here; the model's targets, narration, timing, and
    interaction pauses remain unchanged.
    """
    actions = {str(beat.get("action") or "") for beat in beats}
    if len(actions) >= 3 and actions & _MEANINGFUL_DIRECTOR_ACTIONS:
        for beat in beats:
            beat["action_repaired"] = False
        return beats

    stage_kind = str((scene.get("stage") or {}).get("kind") or "")
    core_action = _STAGE_MOTION_CORE_ACTIONS.get(stage_kind, "change")
    sequence = _STAGE_MOTION_SEQUENCES.get(
        stage_kind,
        ("spawn", "focus", core_action, "return", "resolve"),
    )
    if len(beats) == 3:
        recovered_actions = ("spawn", core_action, "resolve")
    elif len(beats) == 4:
        recovered_actions = ("spawn", "focus", core_action, "resolve")
    else:
        recovered_actions = tuple(sequence[min(index, len(sequence) - 1)] for index in range(len(beats)))

    for index, beat in enumerate(beats):
        recovered = recovered_actions[index]
        beat["action_repaired"] = beat.get("action") != recovered
        beat["action"] = recovered
    return beats


def _normalize_director_beats(value: object, scene: dict) -> list[dict]:
    """Normalize the scene-wide shot list used by every cinematic stage."""
    catalog = _director_target_catalog(scene)
    raw_beats = value if isinstance(value, list) else []
    beats: list[dict] = []
    pause_used = False
    for index, raw_beat in enumerate(raw_beats[:8]):
        if not isinstance(raw_beat, dict):
            continue
        target, target_repaired = _resolve_director_target(raw_beat.get("target"), catalog, index)
        narration = _clean(raw_beat.get("narration"), 220)
        detail = _clean(raw_beat.get("detail"), 190) or narration or target["detail"]
        label = _clean(raw_beat.get("label"), 90) or target["label"]
        action = _clean(raw_beat.get("action"), 16).lower()
        tone = _clean(raw_beat.get("tone"), 16).lower()
        try:
            duration_ms = int(raw_beat.get("duration_ms")) if raw_beat.get("duration_ms") is not None else None
        except (TypeError, ValueError):
            duration_ms = None
        requested_pause = bool(raw_beat.get("pause_for_interaction"))
        pause_for_interaction = requested_pause and not pause_used
        pause_used = pause_used or pause_for_interaction
        if not narration:
            narration = detail or f"聚焦“{label}”，观察它带来的具体变化。"
        beats.append({
            "id": _clean(raw_beat.get("id"), 32) or f"director-beat-{index + 1}",
            "label": label,
            "detail": detail or narration,
            "narration": narration,
            "action": action if action in _BEAT_ACTIONS else "focus",
            "target": target["id"],
            "from": _clean(raw_beat.get("from"), 48),
            "to": _clean(raw_beat.get("to"), 48) or target["id"],
            "value": _clean(raw_beat.get("value"), 64),
            "duration_ms": max(1600, min(8000, duration_ms)) if duration_ms else _director_duration(narration),
            "pause_for_interaction": pause_for_interaction,
            "tone": tone if tone in _BEAT_TONES else "guide",
            "source": "model",
            "target_repaired": target_repaired or not _clean(raw_beat.get("target"), 90),
            "action_repaired": False,
        })
    if len(beats) < 3:
        return _fallback_director_beats(scene, catalog)
    return _repair_director_actions(beats, scene)


def _normalize_stage(value: object) -> dict | None:
    if not isinstance(value, dict):
        return None
    kind = _clean(value.get("kind"), 28).lower()
    if kind not in _STAGE_KINDS:
        return None
    zones: list[dict] = []
    raw_zones = value.get("zones") if isinstance(value.get("zones"), list) else []
    for index, raw_zone in enumerate(raw_zones[:8]):
        if not isinstance(raw_zone, dict):
            continue
        label = _clean(raw_zone.get("label"), 64)
        if not label:
            continue
        try:
            x = float(raw_zone.get("x")) if raw_zone.get("x") is not None else None
            y = float(raw_zone.get("y")) if raw_zone.get("y") is not None else None
        except (TypeError, ValueError):
            x = y = None
        zones.append({
            "id": _clean(raw_zone.get("id"), 32) or f"zone-{index + 1}",
            "label": label,
            "role": _clean(raw_zone.get("role"), 44),
            "x": max(0, min(100, x)) if x is not None else None,
            "y": max(0, min(100, y)) if y is not None else None,
        })
    cues: list[dict] = []
    raw_cues = value.get("cues") if isinstance(value.get("cues"), list) else []
    for index, raw_cue in enumerate(raw_cues[:16]):
        if not isinstance(raw_cue, dict):
            continue
        caption = _clean(raw_cue.get("caption"), 120)
        if not caption:
            continue
        cues.append({
            "beat_id": _clean(raw_cue.get("beat_id"), 32) or f"beat-{index + 1}",
            "caption": caption,
            "focus": _clean(raw_cue.get("focus"), 48),
            "from": _clean(raw_cue.get("from"), 48),
            "to": _clean(raw_cue.get("to"), 48),
        })
    environment = _clean(value.get("environment"), 100)
    focal_question = _clean(value.get("focal_question"), 160)
    if not environment or not focal_question:
        return None
    return {
        "kind": kind,
        "environment": environment,
        "focal_question": focal_question,
        "chapter_label": _clean(value.get("chapter_label"), 32),
        "interaction_prompt": _clean(value.get("interaction_prompt"), 140),
        "requires_interaction": bool(value.get("requires_interaction")),
        "zones": zones,
        "cues": cues,
    }


def _assign_branch_briefs(scenes: list[dict]) -> None:
    scene_by_id = {str(scene.get("id") or ""): scene for scene in scenes}
    for scene in scenes:
        raw = scene.pop("_raw_branch_brief", None)
        if scene.get("path_role") not in {"remediation", "advanced"}:
            scene.pop("branch_brief", None)
            continue
        source = raw if isinstance(raw, dict) else scene.get("branch_brief") if isinstance(scene.get("branch_brief"), dict) else {}
        source_scene = scene_by_id.get(str((scene.get("continuity") or {}).get("source_scene_id") or ""), {})
        role = str(scene.get("path_role"))
        fallback_strategy = "guided-rebuild" if role == "remediation" else "transfer-challenge"
        brief = {
            "trigger": _clean(source.get("trigger"), 140)
                or _clean((source_scene.get("stage") or {}).get("interaction_prompt"), 140)
                or _clean(source_scene.get("key_point"), 140),
            "diagnosis": _clean(source.get("diagnosis"), 180)
                or (f"需要重新辨认“{_clean(source_scene.get('key_point'), 100)}”中的关键条件。" if role == "remediation" else f"已经掌握“{_clean(source_scene.get('key_point'), 100)}”，可以迁移到更复杂条件。"),
            "teaching_move": _clean(source.get("teaching_move"), 180)
                or _clean(scene.get("narration"), 180),
            "success_evidence": _clean(source.get("success_evidence"), 160)
                or _clean((scene.get("check") or {}).get("prompt"), 160)
                or _clean(scene.get("key_point"), 160),
            "strategy": _clean(source.get("strategy"), 28).lower() or fallback_strategy,
            "source": "model" if isinstance(raw, dict)
                and str(raw.get("source") or "") != "fallback"
                and all(_clean(raw.get(field), 180) for field in ("trigger", "diagnosis", "teaching_move", "success_evidence", "strategy"))
                else "fallback",
        }
        if brief["strategy"] not in _BRANCH_STRATEGIES:
            brief["strategy"] = fallback_strategy
            brief["source"] = "fallback"
        scene["branch_brief"] = brief


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
    scene_engine = _clean(value.get("scene_engine"), 20).lower()
    if scene_engine not in _SCENE_ENGINES:
        scene_engine = _infer_scene_engine(visual_type)
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
        "scene_engine": scene_engine,
        "visual": _normalize_visual(value.get("visual"), visual_type, key_point, narration),
        "simulation": _normalize_simulation(value.get("simulation")),
        "stage": _normalize_stage(value.get("stage")),
        "_raw_scene_payload": value.get("scene_payload"),
        "_scene_payload_declared": "scene_payload" in value,
        "_raw_director_beats": value.get("director_beats"),
        "_raw_continuity": value.get("continuity"),
        "_raw_path_role": value.get("path_role"),
        "_raw_branching": value.get("branching"),
        "_raw_branch_brief": value.get("branch_brief"),
        "check": check,
        "suggested_seconds": max(20, min(90, suggested_seconds)),
    }, check_count + (1 if check else 0)


def normalize_dynamic_explanation(
    raw: object,
    *,
    require_scene_payload: bool = False,
    require_director_beats: bool = False,
) -> dict:
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
    _assign_general_stages(scenes)
    for scene in scenes:
        kind = str((scene.get("stage") or {}).get("kind") or "")
        scene["scene_payload"] = _normalize_scene_payload(scene.pop("_raw_scene_payload", None), scene, kind)
        declared = bool(scene.pop("_scene_payload_declared", False))
        if require_scene_payload and kind in _GENERAL_STAGE_KINDS and not declared and scene.get("scene_payload"):
            scene["scene_payload"]["source"] = "repaired"
            scene["scene_payload"]["missing_fields"] = ["scene_payload"]
        scene["director_beats"] = _normalize_director_beats(scene.pop("_raw_director_beats", None), scene)
    _assign_continuity(scenes)
    _assign_branching(scenes)
    _assign_branch_briefs(scenes)
    result = {
        "schema_version": 14,
        "title": title,
        "summary": summary,
        "highlights": highlights or [scene["key_point"] for scene in scenes[:3]],
        "palette": palette if palette in _PALETTES else "sage",
        "director_profile": _normalize_director_profile(raw.get("director_profile"), scenes, title),
        "scenes": scenes,
    }
    result["quality_report"] = _audit_dynamic_explanation_content(result, enforce_director_beats=require_director_beats)
    return result


def regenerate_dynamic_explanation_scene(
    presentation: dict,
    scene_id: str,
    source_prompt: str,
    quality_issues: list[str] | None = None,
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
            "scene_engine": item["scene_engine"],
            "stage_kind": (item.get("stage") or {}).get("kind"),
            "visual_items": item.get("visual", {}).get("items", []),
            "scene_payload": item.get("scene_payload"),
            "director_beats": item.get("director_beats"),
            "continuity": item.get("continuity"),
            "path_role": item.get("path_role"),
            "branching": item.get("branching"),
            "branch_brief": item.get("branch_brief"),
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
                    "The JSON must contain title, narration, key_point, visual_type, scene_engine, visual, simulation, stage, scene_payload, director_beats, continuity, path_role, branching, branch_brief, check, suggested_seconds. "
                    "visual_type must be one of concept, journey, sequence, stack, compare, contrast, example, lab, pitfall, "
                    "error-lab, map, recap, code-trace, timeline, network. visual must contain headline, items (up to 5 short concrete labels), before, after, example. "
                    "scene_engine must be one of process, state, comparison, spatial, timeline, experiment, story. For a process or state scene, "
                    "simulation should contain subject, code_lines, actors, and 3-10 ordered beats. Each beat needs label, detail, narration, action, target, value, "
                    "duration_ms, pause_for_interaction, tone, and code_line when relevant. narration is one complete spoken sentence tied to the visible change in that beat; "
                    "duration_ms is 1600-8000; tone is guide, emphasis, question, correction, challenge, or conclusion. Set pause_for_interaction true on at most one beat, only when the learner must act before the explanation can continue. "
                    "action is spawn, focus, move, change, branch, return, or resolve. For other scenes simulation may be null. "
                    "Every scene must include director_beats: 3 to 8 ordered, browser-playable shots. Each beat needs id, label, detail, narration, target, action, duration_ms, pause_for_interaction, and tone. "
                    "target must exactly name a concrete object that this scene renders: a stage zone id, simulation actor id, scene_payload record id, or visual-N item id. "
                    "narration explains the visible state or relationship of that exact target, never repeats the scene-level paragraph. Use one interaction pause at most. "
                    "stage is optional. When the idea benefits from an immersive spatial demonstration, stage contains kind, environment, focal_question, chapter_label, interaction_prompt, requires_interaction, zones, and cues. "
                    "General kind is concept-constellation, causal-chain, timeline-river, comparison-studio, system-network, state-machine, case-lab, or parameter-lab. "
                    "Computer-architecture-specific kind may be service-flow, number-transform, instruction-cycle, storage-hierarchy, pipeline-overlap, hazard-lab, or performance-lab. "
                    "Use storage-hierarchy for register/cache/RAM/disk movement, pipeline-overlap for simultaneous pipeline execution, hazard-lab for stall/forward/flush decisions, "
                    "and performance-lab for adjustable performance trade-offs. zones name real locations or objects; when cues are present, their beat_id must reference a director_beats id and map to caption and optional focus/from/to. "
                    "narration should be 70-220 Chinese characters. Do not add invented course facts. A check is optional and, "
                    "if included, must have 2-4 options with the answer exactly matching one option. "
                    "Repair every supplied quality issue. Use at least four concrete topic-specific visual items when the subject supports them. "
                    "Do not reuse the title, key sentence, narration structure, or nearly identical visual item set of another scene. "
                    "The stage kind must match scene_engine and should differ from both neighboring scenes. "
                    + _SCENE_PAYLOAD_PROMPT + " " + _CONTINUITY_PROMPT + " " + _VISUAL_ARC_PROMPT + " " + _BRANCHING_PROMPT + " " + _BRANCH_BRIEF_PROMPT
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
                    f"Quality issues that must be repaired: {json.dumps(quality_issues or [], ensure_ascii=False)}\n"
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
    _assign_general_stages([scene])
    kind = str((scene.get("stage") or {}).get("kind") or "")
    declared = bool(scene.pop("_scene_payload_declared", False))
    scene["scene_payload"] = _normalize_scene_payload(scene.pop("_raw_scene_payload", None), scene, kind)
    if kind in _GENERAL_STAGE_KINDS and not declared and scene.get("scene_payload"):
        scene["scene_payload"]["source"] = "repaired"
        scene["scene_payload"]["missing_fields"] = ["scene_payload"]
    scene["director_beats"] = _normalize_director_beats(scene.pop("_raw_director_beats", None), scene)
    continuity_context = list(normalized["scenes"])
    continuity_context[scene_index] = scene
    _assign_continuity(continuity_context)
    _assign_branching(continuity_context)
    _assign_branch_briefs(continuity_context)
    return continuity_context[scene_index]


def generate_dynamic_explanation(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
    progress_callback: Callable[[dict], None] | None = None,
) -> dict:
    """Create a variable-length, browser-safe interactive presentation from a tutoring turn."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are RHYME's interactive learning presentation agent. Turn the supplied tutoring exchange into a "
                "Chinese learning presentation that a browser can render as a rich, interactive HTML learning stage. "
                "It is not a video script and it must not be a fixed six-scene template. Return exactly one JSON object "
                "with title, summary, palette, highlights, director_profile, and scenes. director_profile contains domain, thread_label, knowledge_structure, teaching_arc, scene_count_reason, and phase_plan.\n"
                "Before writing scenes, silently classify the knowledge structure: concept system, causal mechanism, chronological evolution, state transition, comparison, case reasoning, parameter experiment, or a purposeful mixture. "
                "Choose 3 to 10 scenes from the learning task. A short definition can use 3 or 4 focused scenes; most substantial lessons should use 5 to 9. A process, "
                "problem-solving method, examination topic, or difficult misconception may need 7 to 10 scenes. Explain the chosen count in scene_count_reason. Every scene "
                "must earn its place in the teaching arc.\n"
                "palette must be one of sage, cobalt, ember, plum, ink. Use one coherent palette for the whole presentation.\n"
                "Each scene must contain title, narration, key_point, visual_type, scene_engine, visual, simulation, stage, scene_payload, director_beats, continuity, path_role, branching, branch_brief, check, suggested_seconds. narration is "
                "a concise spoken explanation of 70 to 220 Chinese characters. key_point is one memorable sentence. "
                "suggested_seconds is 20 to 90.\n"
                "scene_engine must be one of process, state, comparison, spatial, timeline, experiment, story. This decides how knowledge behaves, "
                "not merely how it is decorated. Use process for ordered reasoning, state for variables/stacks/lifecycles, comparison for A/B or correct/wrong, "
                "spatial for connected structures, timeline for evolution, experiment for adjustable examples, and story only for conceptual narration.\n"
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
                "director_beats is mandatory for every scene, including concept maps, timelines, comparisons, cases, and parameter labs. It is the canonical scene-wide shot list: provide 3 to 8 ordered beats, each with id, label, detail, narration, target, action, duration_ms, pause_for_interaction, and tone. "
                "target must exactly match an object you render in stage.zones, simulation.actors, scene_payload records (for example branch ids, step ids, event ids, node ids, state ids, evidence ids), or a visual-N item id. "
                "The narration is one complete spoken sentence (roughly 18-70 Chinese characters) describing the visible state or relation of that target. Do not repeat the scene paragraph or narrate an object that is not on screen. "
                "action is spawn, focus, move, change, branch, return, or resolve; duration_ms is 1600-8000; tone is guide, emphasis, question, correction, challenge, or conclusion. "
                "Use pause_for_interaction true on at most one beat and only where a learner operation genuinely changes understanding.\n"
                "For the 1 to 3 most important process/state scenes, provide simulation as an internal timeline: subject; code_lines (up to 8 real rules, "
                "formula lines, or code lines); actors with id, label, role; and 4 to 10 beats. Each beat has id, label, detail, narration, action, target, optional from/to/value, "
                "duration_ms, pause_for_interaction, tone, and code_line. narration is one complete spoken sentence of roughly 18-70 Chinese characters and must explain the exact object or state changing in that beat. "
                "duration_ms is 1600-8000; tone is guide, emphasis, question, correction, challenge, or conclusion. Set pause_for_interaction true on at most one beat and only when the learner must act. "
                "action is spawn, focus, move, change, branch, return, or resolve. The beats must show observable state change, not restate the scene-level narration. "
                "For an adjustable numeric example, simulation may also include input_label, initial_input, input_min, input_max, and one experiment. "
                "Use null simulation for scenes that do not benefit from a real process.\n"
                "For every scene that can become a concrete full-screen demonstration, add stage. stage contains kind, environment, focal_question, chapter_label, interaction_prompt, requires_interaction, zones, and cues. "
                "For general subjects, choose concept-constellation for a core idea and its branches; causal-chain for cause-to-effect mechanisms; timeline-river for historical or developmental change; "
                "comparison-studio for meaningful A/B distinctions; system-network for connected structures and transfers; state-machine for lifecycle or condition transitions; case-lab for evidence-based examples; "
                "and parameter-lab for adjustable conditions or numeric sensitivity. Do not use one kind more than twice unless the topic genuinely has no alternative. "
                "For computer architecture only, use service-flow for requests moving through roles, number-transform for values changing representation, instruction-cycle for one instruction moving through CPU hardware, "
                "storage-hierarchy for data moving between registers, cache, RAM, and disk; pipeline-overlap for several instructions overlapping across pipeline stages; "
                "hazard-lab for choosing stall, forwarding, or flush; performance-lab for adjustable cache, prediction, and latency trade-offs; or process-lab for another physical process. "
                "For a seven-scene computer-architecture lesson, use those seven dedicated kinds in teaching order instead of repeating process-lab. "
                "zones contain id, label, role, and optional x/y percentages. When cues are present, their beat_id must reference a director_beats id and map to caption and optional focus/from/to. "
                "requires_interaction is true only when clicking, choosing, predicting, arranging, or adjusting makes the mechanism clearer; interaction_prompt tells the learner exactly what to do. "
                "Choose stage only when the scene can show concrete objects changing in space; never use it as decoration.\n"
                + _SCENE_PAYLOAD_PROMPT + "\n" + _CONTINUITY_PROMPT + "\n" + _VISUAL_ARC_PROMPT + "\n" + _BRANCHING_PROMPT + "\n" + _BRANCH_BRIEF_PROMPT + "\n"
                "You may add at most two checks, placed only after their prerequisite explanation. Each check contains prompt, options (2 to 4), "
                "answer exactly matching an option, and explanation. Do not invent course facts that are absent from the supplied answer."
            ),
        },
        {
            "role": "system",
            "content": (
                "Quality bar: create a coherent teaching arc, not a list of slides. Start from the learner's actual confusion, then make the "
                "mechanism visible, walk through a concrete case, surface a boundary or misconception when useful, and finish with a recallable connection. "
                "The presentation should feel varied and visually rich, but every scene must preserve one clear visual focus. Neighboring scenes must not use the same stage kind, visual grammar, and interaction together. "
                "From scene 2 onward, each focal_question must visibly grow out of the previous scene's key_point: treat the earlier conclusion as the next scene's input, not as discarded slide text. "
                "The thread_label must be a short subject-specific object, question, event, formula, organism, or case that can visibly continue from scene to scene; never use a generic label such as 'learning journey'."
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
    _report_progress(
        progress_callback,
        phase="drafting",
        label="正在生成完整讲解主线",
        message="智能导演正在判断知识结构并安排场景。",
        percent=12,
    )
    response = chat_qwen(messages, temperature=0.25, max_tokens=3800, json_mode=True)
    result = normalize_dynamic_explanation(
        _parse_json(response.choices[0].message.content or ""),
        require_scene_payload=True,
        require_director_beats=True,
    )
    _report_progress(
        progress_callback,
        phase="auditing",
        label="正在检查内容质量",
        message=f"已生成 {len(result['scenes'])} 幕，正在检查重复、密度和场景匹配。",
        percent=68,
        total_scenes=len(result["scenes"]),
        quality_score=result["quality_report"]["score"],
    )

    repaired_scene_ids: list[str] = []
    repair_ids = list(result["quality_report"].get("repair_scene_ids") or [])[:2]
    for repair_index, scene_id in enumerate(repair_ids):
        issue = next((item for item in result["quality_report"]["issues"] if item["scene_id"] == scene_id), None)
        scene_index = next((index for index, item in enumerate(result["scenes"]) if item["id"] == scene_id), None)
        if scene_index is None:
            continue
        scene_title = result["scenes"][scene_index]["title"]
        _report_progress(
            progress_callback,
            phase="repairing",
            label=f"正在优化第 {scene_index + 1} 幕",
            message=f"“{scene_title}”存在内容重复或场景不匹配，正在单独重做。",
            percent=74 + repair_index * 10,
            total_scenes=len(result["scenes"]),
            current_scene=scene_index + 1,
            current_scene_title=scene_title,
        )
        try:
            repaired = regenerate_dynamic_explanation_scene(
                result,
                scene_id,
                f"{question}\n\nTutor answer:\n{answer[:7000]}",
                quality_issues=list((issue or {}).get("messages") or []),
            )
            other_check_count = sum(1 for index, item in enumerate(result["scenes"]) if index != scene_index and item.get("check"))
            if other_check_count >= 2:
                repaired["check"] = None
            result["scenes"][scene_index] = repaired
            repaired_scene_ids.append(scene_id)
            result["quality_report"] = _audit_dynamic_explanation_content(result, enforce_director_beats=True)
        except Exception:
            logger.warning("动态讲解质量守门员无法重做场景：scene=%s", scene_id, exc_info=True)

    final_report = _audit_dynamic_explanation_content(result, enforce_director_beats=True)
    final_report["repaired_scene_ids"] = repaired_scene_ids
    if repaired_scene_ids and final_report["status"] == "ready":
        final_report["status"] = "refined"
    result["quality_report"] = final_report
    _report_progress(
        progress_callback,
        phase="finalizing",
        label="质量检查完成",
        message=(
            f"已自动优化 {len(repaired_scene_ids)} 幕，整套讲解正在保存。"
            if repaired_scene_ids
            else "场景内容和教学结构已通过检查，正在保存。"
        ),
        percent=94,
        total_scenes=len(result["scenes"]),
        quality_score=final_report["score"],
        repaired_scenes=len(repaired_scene_ids),
    )
    return {
        "title": result["title"],
        "summary": result["summary"],
        "highlights": result["highlights"],
        "explanation": result,
    }
