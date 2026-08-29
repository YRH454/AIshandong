"""个性化学习资源多智能体系统。

一个 Orchestrator 负责理解需求与拆解任务，七个 Specialist Agent 负责生成
不同形态的资源。所有 Agent 返回统一信封结构，前端可以边生成边展示。
"""
from __future__ import annotations

import json
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable

from app.services.llm import chat_deepseek, chat_qwen

logger = logging.getLogger(__name__)

AGENT_META: dict[str, dict[str, Any]] = {
    "course": {"label": "课程讲解", "icon": "book", "description": "结构化知识讲义", "minutes": 12},
    "mindmap": {"label": "知识导图", "icon": "tree", "description": "可视化知识结构", "minutes": 5},
    "exercise": {"label": "分层练习", "icon": "edit", "description": "题目、答案与解析", "minutes": 15},
    "flashcards": {"label": "记忆卡片", "icon": "cards", "description": "核心概念快速复习", "minutes": 8},
    "lab": {"label": "实操项目", "icon": "code", "description": "可动手完成的实践任务", "minutes": 45},
    "media": {"label": "微课脚本", "icon": "video", "description": "分镜、旁白与视频提示词", "minutes": 6},
    "reading": {"label": "拓展阅读", "icon": "glasses", "description": "递进阅读与检索建议", "minutes": 20},
}
DEFAULT_TYPES = list(AGENT_META)


def _offline() -> bool:
    return os.getenv("LLM_OFFLINE", "").lower() in {"1", "true", "yes", "on"}


# 双模型负载均衡:按调用计数轮流使用 DeepSeek / Qwen,失败自动切换。
# 既提升并发吞吐(7个agent并行时模型不互相排队),也体现多模型协同架构。
import threading as _threading
_model_counter = _threading.local()


def _model_pair():
    """返回 (主模型, 备用模型),按调用计数在 DeepSeek/Qwen 间轮流"""
    counter = getattr(_model_counter, "n", 0)
    _model_counter.n = counter + 1
    if counter % 2 == 0:
        return chat_deepseek, chat_qwen
    return chat_qwen, chat_deepseek


def _json_response(prompt: str, max_tokens: int = 2400) -> dict:
    primary, backup = _model_pair()
    last_error = None
    for client in (primary, backup):
        if client is None:
            continue
        try:
            response = client(
                [{"role": "system", "content": prompt}], temperature=0.3,
                max_tokens=max_tokens, json_mode=True,
            )
            text = response.choices[0].message.content.strip()
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.S)
            return json.loads(text)
        except Exception as e:
            last_error = e
            continue
    raise last_error or RuntimeError("所有模型调用失败")


def _text_response(prompt: str, max_tokens: int = 2600) -> str:
    primary, backup = _model_pair()
    last_error = None
    for client in (primary, backup):
        if client is None:
            continue
        try:
            response = client(
                [{"role": "system", "content": prompt}], temperature=0.45,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            last_error = e
            continue
    raise last_error or RuntimeError("所有模型调用失败")


def _profile_text(profile: dict | None) -> str:
    if not profile:
        return "暂无学生画像"
    lines = []
    for key, value in profile.items():
        if key.startswith("_") or value in (None, "", [], {}):
            continue
        if isinstance(value, dict):
            value = value.get("value", value.get("summary", value))
        lines.append(f"- {key}: {value}")
    return "\n".join(lines[:12]) or "暂无学生画像"


def _infer_topic(text: str) -> str:
    cleaned = re.sub(r"帮我|请|生成|准备|一套|学习资源|复习资料|教程|资源包|两天内|一周内|一个月内", " ", text)
    cleaned = re.sub(r"[，。！？、,.!?]", " ", cleaned)
    words = [part.strip() for part in cleaned.split() if part.strip()]
    return " ".join(words[:4])[:40] or "当前课程主题"


def _domain_pack(topic: str) -> dict:
    """为离线展示提供学科级知识骨架，避免输出泛化学习方法套话。"""
    packs = [
        (("事务", "隔离", "数据库"), {
            "name": "数据库事务与隔离级别",
            "concepts": [
                ("原子性与日志", "事务要么全部提交、要么全部回滚；数据库通过 WAL/Undo 记录恢复依据。"),
                ("并发异常", "脏读读取未提交数据；不可重复读关注同一行变化；幻读关注结果集行数变化。"),
                ("四种隔离级别", "Read Uncommitted、Read Committed、Repeatable Read、Serializable 依次增强隔离并降低并发。"),
                ("MVCC", "通过版本链和一致性视图让读操作尽量不阻塞写操作，不等同于完全没有锁。"),
            ],
            "compare": [
                ["Read Uncommitted", "可能", "可能", "可能", "最高"],
                ["Read Committed", "避免", "可能", "可能", "较高"],
                ["Repeatable Read", "避免", "避免", "标准上可能", "中等"],
                ["Serializable", "避免", "避免", "避免", "最低"],
            ],
            "misconceptions": ["Repeatable Read 并不意味着所有数据库实现完全相同", "MVCC 不能替代写写冲突时的锁", "隔离级别越高不代表业务一定越正确"],
            "project": "启动两个数据库会话，分别设置隔离级别，按时间线执行 UPDATE/SELECT/COMMIT，复现并解释脏读、不可重复读或幻读。",
        }),
        (("TCP", "HTTP", "计算机网络", "拥塞"), {
            "name": "TCP/IP 与 HTTP",
            "concepts": [
                ("分层与封装", "应用数据逐层添加首部，接收端反向解封装；分层降低系统耦合。"),
                ("可靠传输", "序号、确认、超时重传和滑动窗口共同解决丢包、乱序与流量控制。"),
                ("拥塞控制", "慢启动、拥塞避免、快速重传和快速恢复根据网络反馈调整发送速率。"),
                ("HTTP 语义", "HTTP 定义请求响应语义；HTTP/2 多路复用，HTTP/3 将传输基础切换为 QUIC。"),
            ],
            "compare": [["TCP", "传输层", "可靠字节流", "连接、重传、拥塞"], ["UDP", "传输层", "数据报", "低开销、应用自控"], ["HTTP", "应用层", "资源交互语义", "方法、状态码、缓存"]],
            "misconceptions": ["三次握手不是为了交换业务数据", "流量控制保护接收方，拥塞控制保护网络", "HTTP 无状态不等于 TCP 无连接"],
            "project": "使用浏览器开发者工具与抓包工具观察一次 HTTPS 请求，标注 DNS、握手、请求、响应和连接复用阶段。",
        }),
        (("机器学习", "反向传播", "神经网络", "人工智能"), {
            "name": "机器学习与反向传播",
            "concepts": [
                ("前向计算", "输入经过参数化函数得到预测，损失函数衡量预测与目标的差异。"),
                ("链式法则", "反向传播把输出误差沿计算图逐层传递，本质是高效复用局部导数。"),
                ("梯度下降", "参数沿损失增长最快方向的反方向更新；学习率决定每次更新幅度。"),
                ("泛化能力", "训练误差低不等于真实能力强，需要验证集、正则化与合理的数据划分。"),
            ],
            "compare": [["训练集", "拟合参数", "可参与梯度更新"], ["验证集", "选择模型与超参", "不可参与参数拟合"], ["测试集", "最终无偏评估", "只在最后使用"]],
            "misconceptions": ["反向传播不是一种优化器", "准确率不适合所有不平衡任务", "更深的网络不必然带来更好泛化"],
            "project": "只用 NumPy 实现两层神经网络，对一个参数做数值梯度检查，并比较解析梯度的相对误差。",
        }),
        (("Python", "数据分析", "pandas"), {
            "name": "Python 数据分析",
            "concepts": [
                ("数据载入与检查", "先检查字段类型、缺失、重复、异常范围和样本粒度，再开始分析。"),
                ("向量化处理", "优先使用 Series/DataFrame 的批量运算，避免在行级 Python 循环中做重复工作。"),
                ("分组聚合", "groupby 遵循 split-apply-combine，把业务维度转成可比较的指标。"),
                ("可视化表达", "图表必须服务一个结论，并明确单位、基准、异常点和不确定性。"),
            ],
            "compare": [["loc", "按标签选择", "支持布尔条件"], ["iloc", "按位置选择", "适合固定切片"], ["query", "表达式筛选", "复杂条件更易读"]],
            "misconceptions": ["缺失值不能一律填 0", "相关性不等于因果", "图表好看不能替代数据口径说明"],
            "project": "选择一份公开 CSV，完成数据质量报告、三个业务问题分析、一张核心图表和一页结论说明。",
        }),
    ]
    lowered = topic.lower()
    for keywords, pack in packs:
        if any(keyword.lower() in lowered for keyword in keywords):
            return pack
    return {
        "name": topic,
        "concepts": [("问题边界", f"明确 {topic} 解决的问题、输入输出与适用条件。"), ("核心机制", "沿着关键过程解释每一步为什么发生。"), ("评价方法", "用可观察指标判断方案是否有效。"), ("实践迁移", "在新情境中选择方法并解释决策。")],
        "compare": [["概念", "关注点", "判断依据"], ["基础层", "定义与边界", "能准确复述"], ["原理层", "过程与因果", "能解释为什么"], ["应用层", "选择与迁移", "能解决新问题"]],
        "misconceptions": ["只背结论而忽略适用条件", "把相关概念当成同一概念", "完成一次练习后不复盘错因"],
        "project": f"围绕 {topic} 选择一个真实小问题，完成方案、验证、证据记录和复盘。",
    }


def _offline_plan(user_input: str, selected_types: list[str], profile: dict | None) -> dict:
    inferred_topic = _infer_topic(user_input)
    topic = _domain_pack(inferred_topic)["name"]
    level = "入门"
    if any(word in user_input for word in ("进阶", "深入", "高阶", "考研", "期末")):
        level = "进阶"
    goal = "建立知识体系并能完成练习与实践"
    if "考试" in user_input or "期末" in user_input or "考研" in user_input:
        goal = "高效复习、定位薄弱点并提升应试表现"
    agents = []
    for key in selected_types:
        meta = AGENT_META[key]
        agents.append({
            "key": key,
            "label": meta["label"],
            "reason": meta["description"],
            "params": {"topic": topic, "title": topic, "topics": [topic], "level": level, "goal": goal},
        })
    return {
        "title": f"{topic} · 个性化学习资源包",
        "summary": f"围绕“{topic}”构建从理解、记忆到练习和实践的完整资源组合。",
        "strategy": "先用讲义和导图建立框架，再通过卡片与练习巩固，最后用实操完成迁移。",
        "estimated_seconds": max(8, len(agents) * 4),
        "needs": {
            "topic": topic, "major": "未指定", "goal": goal, "level": level,
            "weak_points": [], "duration": "按需学习", "learning_style": "图文与实践结合",
            "profile_used": bool(profile),
        },
        "agents": agents,
    }


def orchestrate(
    user_input: str,
    history: list | None = None,
    profile: dict | None = None,
    selected_types: list[str] | None = None,
) -> dict:
    """理解需求、结合画像并生成可确认的执行计划。"""
    types = [key for key in (selected_types or DEFAULT_TYPES) if key in AGENT_META]
    if not types:
        types = DEFAULT_TYPES.copy()
    if _offline():
        return _offline_plan(user_input, types, profile)

    history_text = "\n".join(
        f"{m.get('role')}: {m.get('content', '')}" for m in (history or [])[-6:]
    ) or "无"
    prompt = f"""你是高等教育个性化资源编排智能体。请理解学生的真实需求，并规划一组可直接学习的资源。

本轮需求：{user_input}
学生画像：
{_profile_text(profile)}
最近对话：
{history_text}
用户选择的资源类型：{types}

只返回 JSON。必须使用且仅使用上述资源类型，每种一次。格式：
{{
  "title": "资源包标题",
  "summary": "一句话概括",
  "strategy": "说明这些资源如何配合学习",
  "estimated_seconds": 30,
  "needs": {{
    "topic": "明确课程或知识主题", "major": "专业或未指定", "goal": "目标",
    "level": "入门/中级/进阶", "weak_points": [], "duration": "可用时间",
    "learning_style": "偏好", "profile_used": true
  }},
  "agents": [
    {{"key": "course", "label": "课程讲解", "reason": "选择理由",
      "params": {{"topic": "主题", "title": "标题", "topics": ["知识点"], "level": "层级", "goal": "目标"}}}}
  ]
}}
参数必须足以让专业智能体直接生成内容，不要询问用户补充信息；信息不足时做合理假设。"""
    try:
        plan = _json_response(prompt, 1800)
        by_key = {a.get("key"): a for a in plan.get("agents", []) if a.get("key") in types}
        fallback = _offline_plan(user_input, types, profile)
        plan["agents"] = [by_key.get(a["key"], a) for a in fallback["agents"]]
        plan.setdefault("needs", fallback["needs"])
        plan.setdefault("title", fallback["title"])
        plan.setdefault("summary", fallback["summary"])
        plan.setdefault("strategy", fallback["strategy"])
        plan.setdefault("estimated_seconds", fallback["estimated_seconds"])
        return plan
    except Exception as exc:
        logger.warning("资源编排失败，使用确定性计划: %s", exc)
        return _offline_plan(user_input, types, profile)


def _envelope(key: str, params: dict, content: Any, *, summary: str = "", objectives: list[str] | None = None) -> dict:
    topic = params.get("topic") or params.get("title") or "学习主题"
    return {
        "type": key,
        "label": AGENT_META[key]["label"],
        "title": f"{topic} · {AGENT_META[key]['label']}",
        "summary": summary or AGENT_META[key]["description"],
        "format": "json" if isinstance(content, (dict, list)) else ("mermaid" if key == "mindmap" else "markdown"),
        "estimated_minutes": AGENT_META[key]["minutes"],
        "learning_objectives": objectives or [f"理解{topic}的核心内容", f"能将{topic}用于实际问题"],
        "tags": [str(topic), params.get("level", "入门"), AGENT_META[key]["label"]],
        "content": content,
    }


def _offline_course(p: dict) -> str:
    t = p.get("topic", p.get("title", "学习主题"))
    pack = _domain_pack(t)
    concept_sections = "\n\n".join(
        f"### {index}. {name}\n\n{detail}\n\n**自检：** 请不看资料，用一句话说出它解决的问题。"
        for index, (name, detail) in enumerate(pack["concepts"], 1)
    )
    table = "\n".join("| " + " | ".join(row) + " |" for row in pack["compare"])
    column_count = len(pack["compare"][0])
    header = "| " + " | ".join(["比较项"] + [f"维度{i}" for i in range(1, column_count)]) + " |"
    divider = "|" + "---|" * column_count
    misconceptions = "\n".join(f"- ❌ {item}" for item in pack["misconceptions"])
    return f"""# {t}

## 学习目标

- 建立完整的概念框架
- 说清核心原理与关键联系
- 能用所学知识分析一个真实问题

## 1. 先建立整体认识

本资源聚焦 **{pack['name']}**。先用“问题—机制—权衡—验证”建立框架，再进入细节，避免把相近概念混在一起。

## 2. 核心概念精讲

{concept_sections}

## 3. 一张表完成关键辨析

{header}
{divider}
{table}

## 4. 高频误区

{misconceptions}

## 5. 真实任务

> {pack['project']}

完成后必须给出：操作或推理过程、关键证据、结果解释和一次改进建议。

## 小结

真正掌握 {pack['name']} 的标志不是“看懂”，而是能解释概念间的差异、预测条件变化后的结果，并用证据验证预测。

> 思考：如果需要把 {t} 教给一位零基础同学，你会按什么顺序讲？"""


def generate_course(p: dict) -> dict:
    topic = p.get("topic", p.get("title", "学习主题"))
    if _offline():
        content = _offline_course(p)
    else:
        content = _text_response(f"""你是课程设计专家。为{p.get('level', '入门')}学生撰写“{topic}”个性化讲义。
目标：{p.get('goal', '理解并应用')}；知识点：{p.get('topics', [topic])}。
用 Markdown 输出，包含学习目标、先修诊断、核心讲解、对比表、例子、常见误区、小结和迁移问题。内容具体，不说套话。""")
    return _envelope("course", p, content, summary="从核心概念到应用的结构化讲义")


def _offline_mindmap(p: dict) -> dict:
    """Build a domain-aware concept graph instead of a decorative generic tree."""
    topic = p.get("topic", "学习主题")
    pack = _domain_pack(topic)
    nodes: list[dict[str, Any]] = [{
        "id": "root",
        "title": pack["name"],
        "kind": "theme",
        "parent_id": None,
        "relation": "核心主题",
        "summary": f"从关键概念、辨析证据和实践任务三个视角建立 {pack['name']} 的完整认知框架。",
        "key_points": ["先理解问题边界", "再解释内部机制", "最后用证据完成迁移"],
        "check": f"你能否用一分钟说明 {pack['name']} 解决什么问题，以及如何判断自己真的掌握了它？",
    }]

    for index, (name, detail) in enumerate(pack["concepts"][:4], 1):
        concept_id = f"concept-{index}"
        nodes.append({
            "id": concept_id,
            "title": name,
            "kind": "concept" if index in (1, 4) else "mechanism",
            "parent_id": "root",
            "relation": "核心组成",
            "summary": detail,
            "key_points": [part.strip() for part in re.split(r"[；，。]", detail) if part.strip()][:3],
            "check": f"不看资料，用“条件—过程—结果”解释{name}。",
        })
        misconception = pack["misconceptions"][(index - 1) % len(pack["misconceptions"])]
        nodes.append({
            "id": f"boundary-{index}",
            "title": f"{name} · {'易错边界' if index <= len(pack['misconceptions']) else '验证证据'}",
            "kind": "warning" if index <= len(pack["misconceptions"]) else "evidence",
            "parent_id": concept_id,
            "relation": "需要警惕" if index <= len(pack["misconceptions"]) else "如何验证",
            "summary": misconception if index <= len(pack["misconceptions"]) else f"在真实案例中定位{name}的输入、过程与可观察结果，用记录而不是印象判断结论。",
            "key_points": ["先说适用条件", "再和相近概念比较", "用反例检查结论"],
            "check": f"请举一个会让“{misconception}”暴露出来的反例。",
        })

    nodes.extend([
        {
            "id": "compare",
            "title": "关键辨析",
            "kind": "comparison",
            "parent_id": "root",
            "relation": "横向比较",
            "summary": "相近概念不能只背名称，要在层次、目标、条件和代价上逐项比较。",
            "key_points": ["比较对象处于哪一层", "分别解决什么问题", "条件改变时结果如何变化"],
            "check": "任选两个相近概念，至少说出一个共同点和两个本质差异。",
        },
        {
            "id": "compare-evidence",
            "title": "判断证据",
            "kind": "evidence",
            "parent_id": "compare",
            "relation": "判断依据",
            "summary": "不要用感觉下结论；观察输入、操作时间线、输出和失败现象，才能完成可靠辨析。",
            "key_points": ["输入条件", "过程记录", "可观察输出", "异常与反例"],
            "check": "你的结论能否被另一位同学按同样步骤复现？",
        },
        {
            "id": "practice",
            "title": "实践迁移",
            "kind": "practice",
            "parent_id": "root",
            "relation": "用于验证",
            "summary": pack["project"],
            "key_points": ["先写预测", "只改变一个关键条件", "保存过程证据", "解释预期与实际差异"],
            "check": "如果改变一个关键条件，你能否先预测结果，再用实验验证？",
        },
        {
            "id": "practice-output",
            "title": "达标产物",
            "kind": "evidence",
            "parent_id": "practice",
            "relation": "产出证明",
            "summary": "一份可复现记录：问题、假设、步骤、关键证据、结果解释和改进建议。",
            "key_points": ["别人能重复", "结论有证据", "失败有解释", "改进可执行"],
            "check": "只看你的记录，别人能否在不询问你的情况下复现实验？",
        },
    ])
    return {
        "version": 2,
        "topic": pack["name"],
        "central_question": f"如何真正理解 {pack['name']}，并用可观察证据证明理解不是停留在记忆层面？",
        "thesis": "掌握不是记住节点名称，而是能解释节点间关系、预测条件变化后的结果，并完成一次可复现验证。",
        "nodes": nodes,
        "learning_route": [
            {"node_id": "root", "title": "先看全貌", "note": "明确主题解决的问题与学习终点"},
            {"node_id": "concept-1", "title": "抓住入口概念", "note": "从第一个核心概念进入机制"},
            {"node_id": "compare", "title": "完成关键辨析", "note": "用证据区分相近概念"},
            {"node_id": "practice", "title": "做一次验证", "note": "把理解转化为可提交成果"},
        ],
    }


def generate_mindmap(p: dict) -> dict:
    topic = p.get("topic", "学习主题")
    fallback = _offline_mindmap(p)
    if _offline():
        content = fallback
    else:
        try:
            content = _json_response(f"""你是课程知识架构师。围绕“{topic}”生成一张真正可学习、可交互的概念网络，只返回 JSON：
{{
  "version": 2,
  "topic": "准确主题",
  "central_question": "本图要回答的核心问题",
  "thesis": "贯穿全图的一句话结论",
  "nodes": [{{
    "id": "root",
    "title": "节点短标题",
    "kind": "theme|concept|mechanism|comparison|warning|practice|evidence",
    "parent_id": null,
    "relation": "与父节点的具体关系",
    "summary": "2-3句主题相关的准确解释",
    "key_points": ["关键点"],
    "check": "可作答的掌握自测"
  }}],
  "learning_route": [{{"node_id":"root","title":"学习步骤","note":"为什么先学它"}}]
}}
要求：1个根节点、4-6个一级分支、总计12-18个节点；每个非根节点必须有有效 parent_id；节点内容必须具体到“{topic}”，禁止使用“基础认知、核心原理、典型案例”等无内容套话；至少包含2个易错边界、1个比较节点、1个证据节点和1个实践节点；学习路线4步。""", 3600)
            if not isinstance(content, dict) or len(content.get("nodes", [])) < 8:
                raise ValueError("mindmap payload is incomplete")
        except Exception as exc:
            logger.warning("知识导图生成失败，使用确定性知识图谱: %s", exc)
            content = fallback
    return _envelope(
        "mindmap", p, content,
        summary="围绕核心问题组织概念、关系、证据与迁移任务",
        objectives=["能解释核心概念之间的关系", "能识别易错边界并用证据完成一次迁移验证"],
    )


def _offline_exercises(p: dict) -> dict:
    t = p.get("topic", "学习主题")
    pack = _domain_pack(t)
    concept_a, detail_a = pack["concepts"][0]
    concept_b, detail_b = pack["concepts"][1]
    return {"exercises": [
        {"id": "q1", "type": "choice", "difficulty": "基础", "tags": [concept_a], "question": f"关于“{concept_a}”，下面哪项描述最准确？", "options": [detail_a, pack["misconceptions"][0], "它只影响界面展示，不影响系统行为", "它在所有场景中都没有代价"], "answer": "A", "explanation": f"{detail_a}。其余选项忽略了概念边界或适用条件。"},
        {"id": "q2", "type": "choice", "difficulty": "辨析", "tags": [concept_b], "question": f"判断“{concept_b}”时，最关键的分析动作是什么？", "options": ["只记住名词", "明确现象、触发条件与可观察结果", "默认所有实现完全相同", "忽略边界情况"], "answer": "B", "explanation": f"{detail_b}。辨析题必须同时检查触发条件和结果。"},
        {"id": "q3", "type": "short_answer", "difficulty": "理解", "tags": [pack["name"]], "question": f"请用“问题—机制—权衡”三句话解释 {pack['name']}。", "options": [], "answer": "答案应指出它解决什么问题、内部如何工作，以及正确性/性能/复杂度之间的权衡。", "explanation": "结构化解释能检验理解是否停留在名词层面。"},
        {"id": "q4", "type": "case_analysis", "difficulty": "应用", "tags": [pack["name"]], "question": f"请为以下实践任务设计验证步骤：{pack['project']}", "options": [], "answer": "应包含假设、可控变量、操作顺序、预期结果、实际证据和偏差解释。", "explanation": "本题考查从概念理解到可验证实践的迁移。"},
    ]}


def generate_exercise(p: dict) -> dict:
    topic = p.get("topic", "学习主题")
    if _offline():
        data = _offline_exercises(p)
    else:
        try:
            data = _json_response(f"""围绕“{topic}”为{p.get('level', '入门')}学生生成 6 道分层练习。只返回 JSON：
{{"exercises":[{{"id":"q1","type":"choice|short_answer|case_analysis","difficulty":"基础|理解|应用","tags":["知识点"],"question":"题干","options":["选项文本"],"answer":"答案；选择题用A-D","explanation":"解析与错因提示"}}]}}
选择、简答、案例题都要有，题目必须与主题具体相关。""", 3000)
        except Exception:
            data = _offline_exercises(p)
    return _envelope("exercise", p, data, summary="由基础识记递进到案例迁移的练习")


def _offline_cards(p: dict) -> dict:
    t = p.get("topic", "学习主题")
    pack = _domain_pack(t)
    pairs = [(f"什么是{name}？", detail, name) for name, detail in pack["concepts"]]
    pairs += [("识别并修正这个误区", item, "高频误区") for item in pack["misconceptions"]]
    pairs.append(("本主题的实践挑战是什么？", pack["project"], "实践迁移"))
    return {"cards": [{"id": f"c{i+1}", "front": q, "back": a, "tag": tag} for i, (q, a, tag) in enumerate(pairs)]}


def generate_flashcards(p: dict) -> dict:
    topic = p.get("topic", "学习主题")
    if _offline():
        data = _offline_cards(p)
    else:
        try:
            data = _json_response(f"""为“{topic}”制作 10 张主动回忆卡。只返回 JSON：
{{"cards":[{{"id":"c1","front":"简短问题","back":"准确、简洁的答案","tag":"知识点"}}]}}
覆盖定义、原理、辨析、应用和易错点，避免只做名词解释。""", 2200)
        except Exception:
            data = _offline_cards(p)
    return _envelope("flashcards", p, data, summary="适合间隔复习与主动回忆的双面卡片")


def generate_lab(p: dict) -> dict:
    topic = p.get("topic", "学习主题")
    pack = _domain_pack(topic)
    if _offline():
        content = {
            "mission": pack["project"],
            "deliverable": "提交可复现的实验记录：假设、方案、过程证据、结果解释和复盘改进。",
            "steps": [
                {"id": "step1", "title": "提出假设", "minutes": 8, "instruction": "预测关键条件变化前后的结果，并写出判断依据。", "checks": ["写出可验证的预测", "标出关键变量"]},
                {"id": "step2", "title": "设计对照", "minutes": 10, "instruction": "画出操作时间线或处理流程，确保一次只改变一个条件。", "checks": ["设置对照组", "固定其他条件"]},
                {"id": "step3", "title": "完成实现", "minutes": 20, "instruction": "完成最小可验证版本，保留代码、命令、截图或数据记录。", "checks": ["运行主流程", "保存过程证据"]},
                {"id": "step4", "title": "测试验证", "minutes": 12, "instruction": "设计正常、边界和失败三个案例，对比预期与实际结果。", "checks": ["正常案例", "边界案例", "失败案例"]},
                {"id": "step5", "title": "复盘表达", "minutes": 10, "instruction": "引用证据解释结果，指出错误假设和下一步改进。", "checks": ["解释结果偏差", "提出改进方案"]},
            ],
            "rubric": [
                {"dimension": "正确性", "excellent": "能解释边界条件与失败原因"},
                {"dimension": "证据", "excellent": "有完整记录与可复现步骤"},
                {"dimension": "迁移", "excellent": "主动改变条件并验证新预测"},
                {"dimension": "表达", "excellent": "说明设计决策及其权衡"},
            ],
            "challenge": "改变一个关键条件，先预测结果，再用实验验证预测。",
        }
    else:
        try:
            content = _json_response(f"""为“{topic}”设计一个 30-60 分钟实操项目。只返回 JSON：
{{"mission":"真实任务情境","deliverable":"最终提交物","steps":[{{"id":"step1","title":"步骤标题","minutes":10,"instruction":"具体操作","checks":["检查项"]}}],"rubric":[{{"dimension":"正确性","excellent":"优秀标准"}}],"challenge":"拓展挑战"}}
步骤必须可执行、可验证、可记录证据；至少 5 步，每步 2-3 个检查项。""", 3000)
        except Exception:
            content = {
                "mission": pack["project"], "deliverable": "提交可复现的实验记录与复盘报告。",
                "steps": [
                    {"id": "step1", "title": "提出假设", "minutes": 10, "instruction": "写出可验证预测与关键变量。", "checks": ["预测明确", "变量明确"]},
                    {"id": "step2", "title": "执行验证", "minutes": 30, "instruction": "完成最小实现并保存过程证据。", "checks": ["主流程成功", "证据已保存"]},
                    {"id": "step3", "title": "复盘改进", "minutes": 10, "instruction": "解释偏差并提出改进。", "checks": ["解释偏差", "提出改进"]},
                ],
                "rubric": [{"dimension": "可复现性", "excellent": "他人可按记录重复得到结果"}],
                "challenge": "改变一个关键条件并验证新预测。",
            }
    return _envelope("lab", p, content, summary="用可提交成果验证知识迁移")


def _offline_media(p: dict) -> dict:
    t = p.get("topic", "学习主题")
    return {"duration": "3分30秒", "scenes": [
        {"time": "00:00-00:20", "visual": "从真实问题切入，标题浮现", "narration": f"为什么我们需要理解 {t}？先从一个真实问题开始。"},
        {"time": "00:20-01:10", "visual": "逐层展开知识结构图", "narration": "先看全貌：问题、组成、过程与结果构成四个关键层次。"},
        {"time": "01:10-02:20", "visual": "用一个案例演示关键过程", "narration": "把抽象概念放进案例，观察每一步为何发生。"},
        {"time": "02:20-03:05", "visual": "错误方案与正确方案对照", "narration": "最常见的误区是只记结论而忽略适用条件。"},
        {"time": "03:05-03:30", "visual": "三道自测问题依次出现", "narration": "现在暂停视频，用自己的话解释原理并完成一次迁移。"},
    ], "script": f"## {t} 微课脚本\n\n本视频采用问题驱动、结构可视化和案例对照的方式讲解核心内容。", "video_prompt": f"Modern educational motion graphics about {t}, clean university learning interface, warm orange and deep green palette, animated diagrams, clear Chinese typography, 16:9"}


def generate_media(p: dict) -> dict:
    topic = p.get("topic", "学习主题")
    if _offline():
        data = _offline_media(p)
    else:
        try:
            data = _json_response(f"""为“{topic}”设计 3-5 分钟微课。只返回 JSON：
{{"duration":"4分钟","scenes":[{{"time":"00:00-00:20","visual":"画面","narration":"旁白"}}],"script":"Markdown补充讲解","video_prompt":"英文多模态视频生成提示词"}}
要用问题钩子、可视化解释、案例、误区和结尾自测。""", 3000)
        except Exception:
            data = _offline_media(p)

    # 万相文生视频:脚本就绪后自动提交真实微课短视频生成(异步,轮询成功后写入 video_url)
    try:
        if not _offline():
            from app.services.llm import submit_wan_video
            video_prompt = data.get("video_prompt") if isinstance(data, dict) else ""
            if video_prompt:
                task_id = submit_wan_video(video_prompt, size="1280*720", duration=5)
                if task_id:
                    data["video_task_id"] = task_id
                    data["video_status"] = "PENDING"
                    data["video_prompt"] = video_prompt
                    owner_id = p.get("user_id")
                    if owner_id:
                        try:
                            from app.services.media_db import create_video_task
                            create_video_task(
                                int(owner_id), task_id, video_prompt,
                                "1280*720", 5,
                            )
                        except Exception:
                            # The package itself remains usable if the optional
                            # task ledger is temporarily unavailable; direct
                            # media polling still fails closed without a row.
                            logger.warning("视频任务归属记录写入失败: %s", task_id, exc_info=True)
    except Exception:
        pass

    return _envelope("media", p, data, summary="可直接拍摄或交给视频模型的完整分镜")


def generate_reading(p: dict) -> dict:
    topic = p.get("topic", "学习主题")
    if _offline():
        content = f"""# {topic} 拓展阅读路线

> 为避免虚构链接，离线演示模式提供可靠的检索策略与阅读任务；接入联网检索后可替换为真实来源卡片。

## 第一层：建立概念

- 优先查找高校公开课讲义、权威教材目录或官方技术文档。
- 检索式：`{topic} 基础 概念 教程 site:edu.cn`
- 阅读任务：写出定义、解决的问题和三个关键词。

## 第二层：理解原理

- 查找综述、经典教材章节和带推导的课程笔记。
- 检索式：`{topic} 原理 综述 lecture notes`
- 阅读任务：画出输入—过程—输出图，并标注假设条件。

## 第三层：案例与前沿

- 查找近三年的案例论文、工程实践或开放课程项目。
- 检索式：`{topic} case study application 2024 2025 2026`
- 阅读任务：比较两个方案的目标、方法、证据与局限。

## 来源核验清单

1. 作者与机构是否明确；2. 是否有发布日期与版本；3. 结论是否有证据；4. 能否被另一独立来源交叉验证。"""
    else:
        content = _text_response(f"为“{topic}”生成递进式拓展阅读路线。用 Markdown 输出入门、原理、案例、前沿四层；不要捏造网址或论文，无法确认时给检索式和来源核验方法。每层包含阅读目标与阅读任务。", 2200)
    return _envelope("reading", p, content, summary="从入门到前沿的递进阅读任务")


AGENT_RUNNERS: dict[str, Callable[[dict], dict]] = {
    "course": generate_course,
    "mindmap": generate_mindmap,
    "exercise": generate_exercise,
    "flashcards": generate_flashcards,
    "lab": generate_lab,
    "media": generate_media,
    "reading": generate_reading,
}


def _filter_agent_output(key: str, result: dict) -> dict:
    """对资源智能体输出做安全过滤（防幻觉 + 敏感内容）。

    JSON 型资源整体序列化过 L1 敏感词检测;文本型资源走完整 filter_content。
    """
    try:
        from app.safety.content_filter import filter_content, _check_sensitive
        content = result.get("content")
        content_type = {
            "course": "document", "reading": "document", "media": "text",
            "mindmap": "json", "exercise": "json", "flashcards": "json", "lab": "json",
        }.get(key, "text")

        if content_type == "json" and isinstance(content, dict):
            # JSON 型资源:序列化后做敏感词检测,命中则标记
            import json as _json
            check = _check_sensitive(_json.dumps(content, ensure_ascii=False))
            if not check["passed"]:
                result["content_filtered"] = True
                result["filter_hits"] = check["hits"]
        elif isinstance(content, str) and content.strip():
            filtered, audit = filter_content(
                content, user_id=0, agent_name=f"resource_{key}",
                content_type=content_type,
            )
            if filtered != content:
                result["content"] = filtered
                result["content_filtered"] = True
    except Exception:
        pass
    return result


def run_agent(agent_cfg: dict) -> tuple[str, dict]:
    key = agent_cfg.get("key", "")
    runner = AGENT_RUNNERS.get(key)
    if not runner:
        return key, {"type": key, "label": key, "error": f"未知资源智能体：{key}"}
    try:
        result = runner(agent_cfg.get("params", {}))
        result["agent_label"] = agent_cfg.get("label", AGENT_META[key]["label"])
        _filter_agent_output(key, result)
        return key, result
    except Exception as exc:
        logger.exception("资源智能体 %s 执行失败", key)
        return key, {"type": key, "label": AGENT_META[key]["label"], "error": str(exc)}


def run_agents(plan: dict) -> dict:
    agents = plan.get("agents", [])
    results: dict[str, dict] = {}
    if not agents:
        return results
    with ThreadPoolExecutor(max_workers=min(4, len(agents))) as executor:
        futures = [executor.submit(run_agent, cfg) for cfg in agents]
        for future in as_completed(futures):
            key, result = future.result()
            results[key] = result
    return results


def build_package_overview(plan: dict, results: dict) -> dict:
    successful = [key for key, value in results.items() if not value.get("error")]
    total_minutes = sum(int(results[key].get("estimated_minutes", 0)) for key in successful)
    return {
        "title": plan.get("title", "个性化学习资源包"),
        "summary": plan.get("summary", ""),
        "strategy": plan.get("strategy", ""),
        "resource_count": len(successful),
        "estimated_minutes": total_minutes,
        "recommended_order": [key for key in DEFAULT_TYPES if key in successful],
        "completion": round(len(successful) / max(1, len(plan.get("agents", []))) * 100),
    }
