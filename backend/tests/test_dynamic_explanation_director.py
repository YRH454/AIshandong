"""Regression coverage for cross-subject dynamic-explanation direction."""

from pathlib import Path
import json
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _scene(title: str, engine: str, visual_type: str, index: int) -> dict:
    return {
        "title": title,
        "narration": f"这是第 {index + 1} 幕的完整讲解，用于展示真实知识变化与前后关系。" * 2,
        "key_point": f"记住 {title} 的核心关系。",
        "visual_type": visual_type,
        "scene_engine": engine,
        "visual": {
            "headline": title,
            "items": [f"{title}要点A", f"{title}要点B", f"{title}要点C"],
            "before": "变化前",
            "after": "变化后",
            "example": "一个可以被检查的具体案例",
        },
        "simulation": None,
        "stage": None,
        "check": None,
        "suggested_seconds": 42,
    }


def _protocol(kind: str, title: str) -> dict:
    if kind == "concept-constellation":
        return {"kind": kind, "core": title, "core_detail": f"{title}的中心解释", "branches": [{"id": f"b{i}", "label": f"{title}分支{i}", "relation": "组成", "detail": f"分支{i}承担独立作用"} for i in range(1, 5)], "boundary_conditions": ["只在给定条件内成立"], "cross_links": [{"from": "b1", "to": "b3", "label": "共同约束"}]}
    if kind == "causal-chain":
        return {"kind": kind, "trigger": f"{title}触发", "steps": [{"id": f"s{i}", "label": f"{title}步骤{i}", "mechanism": f"机制{i}改变中间状态", "effect": f"产生结果{i}"} for i in range(1, 4)], "outcome": f"{title}结果", "blockers": ["关键条件缺失会中断链条"]}
    if kind == "timeline-river":
        return {"kind": kind, "events": [{"id": f"e{i}", "marker": f"时期{i}", "title": f"{title}事件{i}", "change": f"新增变化{i}", "impact": f"阶段影响{i}", "is_turning_point": i == 2} for i in range(1, 4)], "period_label": f"{title}演化", "retrospective": "回看各阶段的累积影响"}
    if kind == "comparison-studio":
        return {"kind": kind, "shared_condition": "保持相同输入条件", "dimensions": [{"label": f"维度{i}", "left": f"左侧表现{i}", "right": f"右侧表现{i}", "deciding_factor": f"条件{i}决定选择"} for i in range(1, 3)], "left_title": "方案甲", "right_title": "方案乙", "recommendation": "依据边界条件选择"}
    if kind == "system-network":
        return {"kind": kind, "nodes": [{"id": f"n{i}", "label": f"节点{i}", "role": "处理", "detail": f"节点{i}承担独立职责"} for i in range(1, 4)], "edges": [{"from": "n1", "to": "n2", "label": "传递", "direction": "forward"}, {"from": "n2", "to": "n3", "label": "转换", "direction": "forward"}], "inputs": ["原始输入"], "outputs": ["处理结果"], "feedback_loops": [{"from": "n3", "to": "n1", "label": "反馈修正"}]}
    if kind == "state-machine":
        return {"kind": kind, "states": [{"id": f"q{i}", "label": f"状态{i}", "description": f"状态{i}的可观察特征"} for i in range(1, 4)], "transitions": [{"from": "q1", "to": "q2", "trigger": "条件一满足", "effect": "进入处理中"}, {"from": "q2", "to": "q3", "trigger": "条件二满足", "effect": "完成转换"}], "initial_state": "q1", "terminal_states": ["q3"], "exception_paths": [{"from": "q2", "to": "q1", "trigger": "校验失败", "effect": "返回初始状态"}]}
    if kind == "case-lab":
        return {"kind": kind, "background": f"{title}发生在明确背景中", "evidence": [{"id": f"v{i}", "label": f"证据{i}", "detail": f"可核查事实{i}", "supports": "支持当前判断"} for i in range(1, 3)], "reasoning_steps": ["核对背景", "连接证据", "检查边界"], "conclusion": "结论由证据共同支持", "counterevidence": ["如果出现相反观察，结论需要收缩"]}
    return {"kind": kind, "parameter_label": "温度", "unit": "℃", "min": 0, "max": 100, "initial": 40, "thresholds": [{"value": 30, "label": "低区", "effect": "响应较弱"}, {"value": 60, "label": "高区", "effect": "响应增强"}], "response_points": [{"value": 10, "label": "起始", "result": "缓慢"}, {"value": 50, "label": "转折", "result": "快速"}, {"value": 90, "label": "饱和", "result": "趋稳"}], "stable_range": {"min": 65, "max": 85, "label": "稳定区间"}}


def _attach_protocol(scene: dict, kind: str) -> dict:
    scene["stage"] = {
        "kind": kind,
        "environment": scene["title"],
        "focal_question": scene["key_point"],
        "zones": [],
        "cues": [],
    }
    scene["scene_payload"] = _protocol(kind, scene["title"])
    return scene


def _attach_director_beats(scene: dict) -> dict:
    payload = scene.get("scene_payload") or {}
    targets: list[tuple[str, str]] = []
    for field in ("branches", "steps", "events", "dimensions", "nodes", "states", "evidence", "thresholds", "response_points"):
        for item in payload.get(field, []) if isinstance(payload.get(field), list) else []:
            if isinstance(item, dict):
                target_id = str(item.get("id") or "")
                label = str(item.get("label") or item.get("title") or item.get("marker") or target_id)
                if target_id:
                    targets.append((target_id, label))
    if not targets:
        targets = [(f"visual-{index + 1}", item) for index, item in enumerate(scene["visual"]["items"])]
    scene["director_beats"] = [
        {
            "id": f"director-{index + 1}",
            "label": label,
            "detail": f"观察{label}在本幕中的具体作用。",
            "narration": f"第 {index + 1} 个镜头聚焦{label}，它让当前关系出现可以追踪的变化。",
            "target": target_id,
            "action": "spawn" if index == 0 else "resolve" if index == 2 else "focus",
            "duration_ms": 2400 + index * 100,
            "pause_for_interaction": False,
            "tone": "conclusion" if index == 2 else "guide",
        }
        for index, (target_id, label) in enumerate((targets * 3)[:3])
    ]
    return scene


class DynamicExplanationDirectorTest(unittest.TestCase):
    def test_director_beats_keep_sentence_timing_voice_tone_and_interaction_gate(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [
            _scene("先观察输入", "process", "sequence", 0),
            _scene("再追踪变化", "state", "code-trace", 1),
            _scene("最后形成结论", "experiment", "lab", 2),
        ]
        scenes[0]["simulation"] = {
            "subject": "缓存访问",
            "code_lines": [],
            "actors": [
                {"id": "cpu", "label": "处理器", "role": "请求方"},
                {"id": "cache", "label": "缓存", "role": "检查点"},
            ],
            "beats": [
                {
                    "id": "request",
                    "label": "发出请求",
                    "detail": "处理器先把地址交给缓存。",
                    "narration": "先看处理器，它把目标地址交给缓存进行第一次检查。",
                    "action": "move",
                    "target": "cache",
                    "duration_ms": 2600,
                    "pause_for_interaction": False,
                    "tone": "guide",
                },
                {
                    "id": "predict",
                    "label": "预测命中",
                    "detail": "学习者判断缓存是否命中。",
                    "narration": "现在请你判断，这次访问能否直接在缓存中找到数据？",
                    "action": "branch",
                    "target": "cache",
                    "duration_ms": 3200,
                    "pause_for_interaction": True,
                    "tone": "question",
                },
            ],
        }

        result = normalize_dynamic_explanation({"title": "逐句导演", "summary": "声画同步。", "scenes": scenes})
        beats = result["scenes"][0]["simulation"]["beats"]

        self.assertEqual(beats[0]["narration"], "先看处理器，它把目标地址交给缓存进行第一次检查。")
        self.assertEqual(beats[0]["duration_ms"], 2600)
        self.assertEqual(beats[1]["tone"], "question")
        self.assertTrue(beats[1]["pause_for_interaction"])

    def test_every_scene_director_beat_binds_to_a_payload_object(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [
            _attach_director_beats(_attach_protocol(_scene("概念结构", "spatial", "concept", 0), "concept-constellation")),
            _attach_director_beats(_attach_protocol(_scene("因果过程", "process", "sequence", 1), "causal-chain")),
            _attach_director_beats(_attach_protocol(_scene("案例证据", "story", "example", 2), "case-lab")),
        ]
        result = normalize_dynamic_explanation(
            {"title": "全幕导演", "summary": "每一幕都有目标对象。", "scenes": scenes},
            require_director_beats=True,
        )

        for scene in result["scenes"]:
            beats = scene["director_beats"]
            self.assertGreaterEqual(len(beats), 3)
            self.assertTrue(all(beat["source"] == "model" for beat in beats))
            self.assertTrue(all(beat["target"] and not beat["target_repaired"] for beat in beats))
            self.assertEqual(len({beat["id"] for beat in beats}), len(beats))
        director_codes = [code for issue in result["quality_report"]["issues"] for code in issue["codes"] if code.startswith("director_")]
        self.assertEqual(director_codes, [])

    def test_legacy_scene_keeps_a_playable_director_fallback(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        result = normalize_dynamic_explanation({
            "title": "旧版兼容", "summary": "没有导演协议也可以播放。",
            "scenes": [_scene("旧场景一", "spatial", "concept", 0), _scene("旧场景二", "process", "sequence", 1), _scene("旧场景三", "story", "example", 2)],
        })

        for scene in result["scenes"]:
            beats = scene["director_beats"]
            self.assertGreaterEqual(len(beats), 3)
            self.assertTrue(all(beat["source"] == "fallback" for beat in beats))
            self.assertTrue(all(beat["narration"] and beat["target"] for beat in beats))

    def test_required_director_protocol_is_reported_when_a_new_scene_omits_it(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        result = normalize_dynamic_explanation({
            "title": "新资料质量门", "summary": "生成内容必须带镜头。",
            "scenes": [_scene("缺少镜头一", "spatial", "concept", 0), _scene("缺少镜头二", "process", "sequence", 1), _scene("缺少镜头三", "story", "example", 2)],
        }, require_director_beats=True)

        self.assertTrue(any("director_beats_missing" in issue["codes"] for issue in result["quality_report"]["issues"]))

    def test_history_arc_gets_varied_general_stages_and_profile(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        raw = {
            "title": "工业革命如何改变社会",
            "summary": "从条件、演化、机制和影响理解工业革命。",
            "palette": "ink",
            "director_profile": {
                "domain": "历史",
                "thread_label": "一台蒸汽机的影响路径",
                "teaching_arc": "条件形成 → 技术突破 → 生产变化 → 城市化 → 长期影响",
                "scene_count_reason": "五幕分别承担背景、过程、机制、案例和回望。",
            },
            "scenes": [
                _scene("条件开始聚集", "spatial", "concept", 0),
                _scene("技术沿时间突破", "timeline", "timeline", 1),
                _scene("生产方式发生连锁变化", "process", "sequence", 2),
                _scene("工厂与家庭生产对比", "comparison", "contrast", 3),
                _scene("城市化案例", "story", "example", 4),
            ],
        }

        result = normalize_dynamic_explanation(raw)
        kinds = [scene["stage"]["kind"] for scene in result["scenes"]]

        self.assertEqual(result["schema_version"], 14)
        self.assertEqual(result["director_profile"]["domain"], "历史")
        self.assertEqual(result["director_profile"]["thread_label"], "一台蒸汽机的影响路径")
        self.assertGreaterEqual(len(set(kinds)), 4)
        self.assertIn("timeline-river", kinds)
        self.assertIn("comparison-studio", kinds)
        self.assertTrue(all(scene["stage"]["interaction_prompt"] for scene in result["scenes"]))
        self.assertEqual(result["scenes"][0]["continuity"]["teaching_phase"], "question")
        self.assertEqual(result["scenes"][-1]["continuity"]["teaching_phase"], "synthesis")
        self.assertEqual(result["director_profile"]["phase_plan"], [scene["continuity"]["teaching_phase"] for scene in result["scenes"]])

    def test_continuity_connects_each_scene_to_the_next_question(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [
            _scene("先观察现象", "spatial", "concept", 0),
            _scene("再解释机制", "process", "sequence", 1),
            _scene("最后验证结论", "experiment", "lab", 2),
        ]
        scenes[0]["continuity"] = {
            "teaching_phase": "question",
            "receives": "",
            "passes": "现象显示两个变量同步变化",
            "next_question": "这种同步变化由什么机制产生？",
        }
        result = normalize_dynamic_explanation({"title": "连续导演", "summary": "让结论成为下一幕输入。", "scenes": scenes})

        self.assertEqual(result["scenes"][1]["continuity"]["receives"], "现象显示两个变量同步变化")
        self.assertEqual(result["scenes"][0]["continuity"]["next_question"], "这种同步变化由什么机制产生？")
        self.assertEqual(result["scenes"][1]["continuity"]["source_scene_id"], "scene-1")
        self.assertEqual(result["scenes"][2]["continuity"]["teaching_phase"], "synthesis")

    def test_repeated_process_scenes_are_rebalanced(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        raw = {
            "title": "光合作用",
            "summary": "追踪能量与物质如何连续变化。",
            "scenes": [_scene(f"过程 {index + 1}", "process", "sequence", index) for index in range(7)],
        }
        result = normalize_dynamic_explanation(raw)
        kinds = [scene["stage"]["kind"] for scene in result["scenes"]]

        self.assertGreaterEqual(len(set(kinds)), 4)
        self.assertLessEqual(max(kinds.count(kind) for kind in set(kinds)), 2)
        self.assertEqual(result["director_profile"]["domain"], "通用学习主题")

    def test_explicit_computer_architecture_stage_is_preserved(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [_scene(f"场景 {index + 1}", "process", "sequence", index) for index in range(3)]
        scenes[0]["stage"] = {
            "kind": "instruction-cycle",
            "environment": "CPU 硬件剖面",
            "focal_question": "一条指令如何完成？",
            "zones": [],
            "cues": [],
        }
        result = normalize_dynamic_explanation({"title": "CPU 指令执行", "summary": "观察指令流动。", "scenes": scenes})

        self.assertEqual(result["scenes"][0]["stage"]["kind"], "instruction-cycle")
        self.assertFalse(result["scenes"][0]["stage"]["requires_interaction"])

    def test_quality_guard_flags_repeated_scene_content(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        repeated = _scene("同一个机制", "process", "sequence", 0)
        scenes = [dict(repeated) for _ in range(4)]
        result = normalize_dynamic_explanation({"title": "重复演示", "summary": "检查重复内容。", "scenes": scenes})
        report = result["quality_report"]

        self.assertEqual(report["status"], "needs_refinement")
        self.assertLess(report["score"], 82)
        self.assertTrue(report["repair_scene_ids"])
        self.assertTrue(any("semantic_repeat" in issue["codes"] for issue in report["issues"]))

    def test_quality_guard_flags_reused_visual_grammar_even_when_topics_differ(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [
            _attach_protocol(_scene("生态系统的组成", "spatial", "concept", 0), "concept-constellation"),
            _attach_protocol(_scene("能量传递的机制", "process", "sequence", 1), "causal-chain"),
            _attach_protocol(_scene("种群关系的结构", "spatial", "concept", 2), "concept-constellation"),
            _attach_protocol(_scene("干预案例的证据", "story", "example", 3), "case-lab"),
        ]
        narrations = [
            "先定位生产者、消费者、分解者与环境条件，建立生态系统中不同成分的结构位置，明确谁提供能量、谁参与循环以及边界在哪里。",
            "再从太阳能输入开始，沿生产者固定、消费者摄取和分解者回收逐步追踪，解释每一环如何让能量和物质继续传递。",
            "随后转向种内竞争、捕食关系、共生关系和环境容量，观察这些关系如何组织种群，而不是重复前面的成分分类。",
            "最后核查一项栖息地干预中的观察证据、因果依据和反证条件，判断这项干预是否真的改善了系统稳定性。",
        ]
        for scene, narration in zip(scenes, narrations):
            scene["narration"] = narration

        result = normalize_dynamic_explanation({"title": "生态关系", "summary": "结构、机制、关系与案例。", "scenes": scenes})
        repeated_issue = next(issue for issue in result["quality_report"]["issues"] if issue["scene_id"] == "scene-3")

        self.assertIn("visual_grammar_repeat", repeated_issue["codes"])
        self.assertEqual(result["quality_report"]["unique_visual_grammar_count"], 3)

    def test_quality_guard_accepts_distinct_dense_scenes(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [
            _scene("概念结构", "spatial", "concept", 0),
            _scene("因果传递", "process", "sequence", 1),
            _scene("阶段演化", "timeline", "timeline", 2),
            _scene("条件对比", "comparison", "contrast", 3),
        ]
        narrations = [
            "先把系统拆成环境条件、能量来源、参与对象和反馈关系，建立一张能够继续追踪的概念结构图。这一步只回答结构问题，不提前讨论历史顺序或方案优劣。",
            "接着沿触发因素、传递介质、中间反应和最终影响逐步推进，明确每一步为何会导致下一步。学习者需要看见作用是怎样连续传递的，而不是只背最终结论。",
            "随后按照形成、加速、转折和稳定四个时期观察变化，辨认不同阶段真正新增或消失的特征。时间标记用于解释演化节奏，不承担静态概念分类任务。",
            "最后把两个方案放进相同条件中比较成本、收益、适用边界和失败风险，形成可执行的选择依据。比较必须控制共同变量，并清楚说明什么情况下应该选择哪一侧。",
        ]
        for index, scene in enumerate(scenes):
            scene["narration"] = narrations[index]
            scene["key_point"] = f"{scene['title']}承担第 {index + 1} 种独立教学任务。"
        result = normalize_dynamic_explanation({"title": "结构完整的演示", "summary": "四种关系各自承担不同任务。", "scenes": scenes})

        self.assertEqual(result["quality_report"]["status"], "ready")
        self.assertGreaterEqual(result["quality_report"]["score"], 82)

    def test_generation_reports_quality_gate_progress(self):
        from app.agents.dynamic_explanation_agent import generate_dynamic_explanation

        scenes = [
            _scene("结构观察", "spatial", "concept", 0),
            _scene("机制推进", "process", "sequence", 1),
            _scene("案例验证", "story", "example", 2),
        ]
        narrations = [
            "先识别系统中的对象、条件、连接和边界，把零散名词整理成能够继续推理的整体结构。这一幕专门建立概念位置，不提前解释后续过程。",
            "随后从触发条件开始，沿中间作用、状态变化和最终结果连续推进，让每一步都能回答为什么会产生下一步，而不是只呈现结论。过程中还要指出传递被打断时会发生什么，从而看清机制成立的必要条件。",
            "最后进入一个具体案例，逐条打开现象、证据、判断依据和结论，再用反例检查这套解释是否越过了适用范围。案例中的每条证据都必须指向明确判断，不能把相关性误写成因果关系。",
        ]
        for index, scene in enumerate(scenes):
            scene["narration"] = narrations[index]
            scene["key_point"] = f"第 {index + 1} 幕只承担“{scene['title']}”这一项任务。"
        _attach_protocol(scenes[0], "concept-constellation")
        _attach_protocol(scenes[1], "causal-chain")
        _attach_protocol(scenes[2], "case-lab")
        for scene in scenes:
            _attach_director_beats(scene)
        payload = {"title": "质量检查示例", "summary": "从结构到机制再到案例。", "scenes": scenes}
        response = SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload, ensure_ascii=False)))])
        progress: list[dict] = []

        with patch("app.agents.dynamic_explanation_agent.chat_qwen", return_value=response) as mocked_chat:
            result = generate_dynamic_explanation(
                question="请解释这个主题",
                answer="这里是一段足够完整的教师回答。",
                recent_context=[],
                learning_state={},
                progress_callback=progress.append,
            )

        self.assertEqual(result["explanation"]["quality_report"]["status"], "ready")
        self.assertEqual([item["phase"] for item in progress], ["drafting", "auditing", "finalizing"])
        self.assertIn("Choose one visual teaching arc", mocked_chat.call_args.args[0][0]["content"])

    def test_all_eight_scene_payload_protocols_are_preserved(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        kinds = [
            "concept-constellation", "causal-chain", "timeline-river", "comparison-studio",
            "system-network", "state-machine", "case-lab", "parameter-lab",
        ]
        engines = ["spatial", "process", "timeline", "comparison", "spatial", "state", "story", "experiment"]
        visual_types = ["concept", "sequence", "timeline", "contrast", "network", "stack", "example", "lab"]
        scenes = [_attach_protocol(_scene(f"协议场景 {index + 1}", engines[index], visual_types[index], index), kind) for index, kind in enumerate(kinds)]

        result = normalize_dynamic_explanation({"title": "八类协议", "summary": "验证专属结构。", "scenes": scenes})

        self.assertEqual([scene["scene_payload"]["kind"] for scene in result["scenes"]], kinds)
        self.assertEqual(result["scenes"][2]["scene_payload"]["events"][1]["marker"], "时期2")
        self.assertEqual(result["scenes"][4]["scene_payload"]["edges"][1]["to"], "n3")
        self.assertEqual(result["scenes"][5]["scene_payload"]["transitions"][0]["trigger"], "条件一满足")
        self.assertEqual(result["scenes"][7]["scene_payload"]["thresholds"][1]["value"], 60)

    def test_legacy_scene_gets_playable_payload_fallback(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [_scene(f"旧资料 {index + 1}", "process", "sequence", index) for index in range(3)]
        result = normalize_dynamic_explanation({"title": "旧动态讲解", "summary": "没有专属协议。", "scenes": scenes})

        self.assertTrue(all(scene["scene_payload"] for scene in result["scenes"]))
        self.assertTrue(all(scene["scene_payload"]["source"] == "legacy" for scene in result["scenes"]))

    def test_incomplete_payload_is_reported_by_quality_guard(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [_scene(f"检查场景 {index + 1}", "process", "sequence", index) for index in range(3)]
        _attach_protocol(scenes[0], "causal-chain")
        scenes[0]["scene_payload"] = {"kind": "causal-chain", "trigger": "只有起点"}
        result = normalize_dynamic_explanation({"title": "协议缺失检查", "summary": "检查字段。", "scenes": scenes})
        first_issue = next(item for item in result["quality_report"]["issues"] if item["scene_id"] == "scene-1")

        self.assertIn("payload_incomplete", first_issue["codes"])
        self.assertIn("steps", result["scenes"][0]["scene_payload"]["missing_fields"])

    def test_branch_routes_are_normalized_and_rejoin_the_main_path(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [_scene(f"分支场景 {index + 1}", "process", "sequence", index) for index in range(5)]
        scenes[1]["branching"] = {
            "default_next_position": 5,
            "routes": [
                {"condition": "incorrect", "target_position": 3, "label": "补齐基础", "reason": "回答暴露了概念缺口。"},
                {"condition": "correct", "target_position": 4, "label": "进入进阶", "reason": "核心概念已经掌握。"},
            ],
            "rejoin_position": 5,
        }
        scenes[2]["path_role"] = "remediation"
        scenes[2]["branching"] = {"rejoin_position": 5}
        scenes[2]["branch_brief"] = {
            "trigger": "学习者把必要条件误当成充分条件",
            "diagnosis": "没有区分条件成立与结论必然成立",
            "teaching_move": "把一个反例和一个正确例并排比较，再重新建立判断步骤",
            "success_evidence": "能够指出反例中缺失的充分条件",
            "strategy": "contrast-and-correct",
        }
        scenes[2]["check"] = {
            "prompt": "哪个案例真正满足充分条件？",
            "options": ["只满足必要条件", "同时满足全部条件"],
            "answer": "同时满足全部条件",
            "explanation": "充分条件必须能够保证结论成立。",
        }
        scenes[2]["scene_engine"] = "comparison"
        _attach_protocol(scenes[2], "comparison-studio")
        scenes[3]["path_role"] = "advanced"
        scenes[3]["branching"] = {"rejoin_position": 5}
        scenes[3]["branch_brief"] = {
            "trigger": "学习者已经正确识别核心条件",
            "diagnosis": "基础判断已经掌握，可以迁移到条件组合更复杂的案例",
            "teaching_move": "进入一个包含干扰证据的真实案例，要求选择决定结论的证据",
            "success_evidence": "能够解释证据如何共同支持最终判断",
            "strategy": "case-application",
        }
        scenes[3]["scene_engine"] = "story"
        _attach_protocol(scenes[3], "case-lab")

        result = normalize_dynamic_explanation({"title": "自适应路线", "summary": "根据学习表现切换路线。", "scenes": scenes})
        branch_point = result["scenes"][1]

        self.assertEqual(branch_point["branching"]["routes"][0]["target_scene_id"], "scene-3")
        self.assertEqual(branch_point["branching"]["routes"][1]["target_scene_id"], "scene-4")
        self.assertEqual(result["scenes"][2]["path_role"], "remediation")
        self.assertEqual(result["scenes"][3]["path_role"], "advanced")
        self.assertEqual(result["scenes"][2]["branching"]["default_next_scene_id"], "scene-5")
        self.assertEqual(result["scenes"][3]["branching"]["default_next_scene_id"], "scene-5")
        self.assertEqual(result["scenes"][2]["continuity"]["source_scene_id"], "scene-2")
        self.assertEqual(result["scenes"][3]["continuity"]["source_scene_id"], "scene-2")
        self.assertEqual(result["scenes"][2]["branch_brief"]["source"], "model")
        self.assertEqual(result["scenes"][2]["branch_brief"]["strategy"], "contrast-and-correct")
        self.assertEqual(result["scenes"][3]["branch_brief"]["strategy"], "case-application")
        self.assertEqual(result["quality_report"]["branch_scene_count"], 2)
        self.assertEqual(result["quality_report"]["branch_point_count"], 1)

    def test_backward_branch_target_is_removed_to_prevent_loops(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [_scene(f"防循环场景 {index + 1}", "process", "sequence", index) for index in range(4)]
        scenes[2]["branching"] = {
            "routes": [
                {"condition": "incorrect", "target_position": 2, "label": "错误回跳", "reason": "不应保留。"},
                {"condition": "correct", "target_position": 4, "label": "继续前进", "reason": "合法路线。"},
            ],
        }

        result = normalize_dynamic_explanation({"title": "防止循环", "summary": "路线只能向前。", "scenes": scenes})
        routes = result["scenes"][2]["branching"]["routes"]

        self.assertEqual(len(routes), 1)
        self.assertEqual(routes[0]["condition"], "correct")
        self.assertEqual(routes[0]["target_scene_id"], "scene-4")

    def test_branch_without_specific_teaching_brief_is_rejected(self):
        from app.agents.dynamic_explanation_agent import normalize_dynamic_explanation

        scenes = [_scene(f"教学处方场景 {index + 1}", "process", "sequence", index) for index in range(4)]
        scenes[0]["branching"] = {
            "routes": [{"condition": "incorrect", "target_position": 2, "label": "纠错", "reason": "需要补充。"}],
            "default_next_position": 3,
        }
        scenes[1]["path_role"] = "remediation"
        scenes[1]["branching"] = {"rejoin_position": 3}

        result = normalize_dynamic_explanation({"title": "缺少教学处方", "summary": "检查支线是否具体。", "scenes": scenes})
        issue = next(item for item in result["quality_report"]["issues"] if item["scene_id"] == "scene-2")

        self.assertEqual(result["scenes"][1]["branch_brief"]["source"], "fallback")
        self.assertIn("branch_brief_missing", issue["codes"])
        self.assertIn("remediation_check_missing", issue["codes"])
        self.assertEqual(normalize_dynamic_explanation(result)["scenes"][1]["branch_brief"]["source"], "fallback")


if __name__ == "__main__":
    unittest.main()
