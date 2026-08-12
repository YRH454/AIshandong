"""Qwen-powered learning document generator."""

import json
import re

from app.safety.content_filter import filter_content
from app.services.llm import chat_qwen, chat_qwen_model


DOCUMENT_TEMPLATES = {
    "quick_overview": {
        "name": "一页速览",
        "purpose": "在两分钟内抓住本轮内容的主线，适合刚学完或准备继续学习时快速定位重点",
        "length": "约 600—900 字，宁可删减，也不要把它写成缩短版讲义",
        "sections": "## 核心结论\n## 必会点\n## 一个关键例子\n## 30 秒自测\n## 接下来怎么学",
        "rules": "只保留最能改变理解的内容；自测题不提供答案；不要另起长篇原理、推导或术语表章节。",
        "max_tokens": 1800,
    },
    "system_guide": {
        "name": "系统讲义",
        "purpose": "把当前对话整理为可长期复用的完整学习讲义，兼顾理解、例子和复习",
        "length": "约 1400—2200 字；若原始材料不足，明确缺口而不是臆造细节",
        "sections": "## 学习目标\n## 知识地图\n## 概念拆解\n## 原理或推导\n## 示例\n## 易错点\n## 自测\n## 下一步建议",
        "rules": "示例必须服务于当前主题。自测题不提供答案；不要为了完整性虚构教材页码、出处或课程要求。",
        "max_tokens": 3600,
    },
    "problem_walkthrough": {
        "name": "题目精讲",
        "purpose": "把一道题或一个具体问题的思考路径拆清楚，帮助用户下次独立完成同类题",
        "length": "约 1000—1800 字；若当前对话没有明确题目，直接说明并按最接近的问题拆解",
        "sections": "## 题目在考什么\n## 关键条件\n## 先想什么\n## 分步推导\n## 易错路径\n## 规范答案\n## 同类方法\n## 变式检验",
        "rules": "分步推导必须说明每一步为什么成立。只有对话中存在明确结论时才能给规范答案；不要把泛泛概念讲解伪装成做题过程。",
        "max_tokens": 3200,
    },
    "concept_comparison": {
        "name": "概念对比",
        "purpose": "分辨易混概念、方法或条件，适合用户正在比较多个相近对象的对话",
        "length": "约 900—1500 字，核心是一个信息准确的 Markdown 对照表",
        "sections": "## 对比对象确认\n## 对照表\n## 何时使用\n## 边界与反例\n## 判断练习\n## 记忆方法",
        "rules": "对照表至少包含定义、关键差异、适用条件和易混点。若对话只有一个对象，选择最合理的相近对象前必须说明依据；没有可靠依据则改成单概念辨析，不编造比较对象。判断练习不提供答案。",
        "max_tokens": 2800,
    },
    "formula_handbook": {
        "name": "公式手册",
        "purpose": "整理本主题的公式、符号、使用条件和典型应用，方便查阅与考前复习",
        "length": "约 900—1700 字；只收录当前对话能够可靠支持的公式或规则",
        "sections": "## 使用前先看\n## 符号说明\n## 公式清单\n## 条件与限制\n## 推导或直觉\n## 典型应用\n## 易混公式\n## 最后检查",
        "rules": "每个公式都要说明变量、成立条件和常见误用。行内公式必须用 $...$，独立公式必须单独一行用 $$...$$；不要使用 \\(...\\) 或 \\[...\\]。没有公式时，诚实转为“规则手册”，不要杜撰公式。",
        "max_tokens": 3000,
    },
    "glossary": {
        "name": "术语表",
        "purpose": "将核心术语变成可快速回顾的词条，连接英文、定义、关联概念和易混点",
        "length": "约 900—1700 字，优先 6—12 个真正重要的术语，而不是凑数量",
        "sections": "## 核心术语表\n## 易混术语\n## 术语关系\n## 复习建议",
        "rules": "每个词条必须包含：中文术语、英文或常用写法（只有可靠时）、一句定义、关联概念、易混点或例子。用 Markdown 表格或二级标题保持可查阅性。不要编造英文译名或冷门术语。",
        "max_tokens": 3000,
    },
    "exam_cram": {
        "name": "考前速记",
        "purpose": "压缩为临考前可快速回看的高价值清单，突出条件、结论、陷阱和答题表达",
        "length": "约 600—1000 字，像一张可靠的考前复习纸，而不是一篇讲义",
        "sections": "## 高频结论\n## 条件与触发词\n## 易错判断\n## 规范答题句式\n## 最后 3 分钟清单",
        "rules": "句子要短、可扫读，优先保留当前对话明确出现的内容。没有考试语境也可以生成复习速记，但不要虚构题型、分值或考试范围。",
        "max_tokens": 2000,
    },
}


# A study pack is deliberately coordinated by one short planning pass before
# its individual documents are written.  These contracts keep the documents
# complementary instead of asking every template to re-explain the same topic.
STUDY_PACK_TEMPLATE_CONTRACTS = {
    "quick_overview": "只负责主线、关键结论和下一步，不展开完整原理，也不写术语索引或考前口令。",
    "system_guide": "负责完整的概念结构、原理和必要示例，不写成术语索引或考前速记。",
    "problem_walkthrough": "围绕统一例题或场景逐步推导，解释每一步为什么成立，不重复完整系统讲义。",
    "concept_comparison": "只负责最容易混淆对象的边界和判断方法，不重复系统讲义的整体结构。",
    "formula_handbook": "只收录公式或规则、符号、条件和误用，不重新展开完整原理。",
    "glossary": "只做可快速查询的核心词条、关联和易混点，不重新写成概念讲义。",
    "exam_cram": "只压缩高频结论、陷阱和答题句式，不重新解释完整原理。",
}


def _short_text(value: object, limit: int) -> str:
    return str(value or "").strip()[:limit]


def _string_list(value: object, limit: int, item_limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for item in value:
        text = _short_text(item, item_limit)
        if text and text not in items:
            items.append(text)
        if len(items) >= limit:
            break
    return items


def _fallback_study_pack_blueprint(
    question: str,
    answer: str,
    learning_state: dict,
    selected_templates: list[str],
) -> dict:
    """Return a safe minimal shared context when the fast planning call is unavailable."""
    topic = _short_text(learning_state.get("current_topic"), 60) or _short_text(question, 80) or "当前学习主题"
    answer_hint = _short_text(answer, 180)
    return {
        "learning_goal": f"围绕「{topic}」建立可理解、可复习、可迁移的学习资料。",
        "core_thread": "先确认核心概念与条件，再用同一问题场景连接理解、应用和复习。",
        "knowledge_points": [topic],
        "canonical_example": {
            "title": "当前对话中的关键问题",
            "brief": _short_text(question, 240) or answer_hint or "根据当前对话中的问题进行说明。",
        },
        "pitfalls": ["只使用当前对话能够支持的结论，不补写未知前提。"],
        "formulas_or_rules": [],
        "terms": [],
        "learning_route": [item for item in selected_templates if item in DOCUMENT_TEMPLATES],
    }


def _normalize_study_pack_blueprint(
    value: object,
    question: str,
    answer: str,
    learning_state: dict,
    selected_templates: list[str],
) -> dict:
    fallback = _fallback_study_pack_blueprint(question, answer, learning_state, selected_templates)
    raw = value if isinstance(value, dict) else {}
    raw_example = raw.get("canonical_example") if isinstance(raw.get("canonical_example"), dict) else {}
    example_title = _short_text(raw_example.get("title"), 80) or fallback["canonical_example"]["title"]
    example_brief = _short_text(raw_example.get("brief"), 320) or fallback["canonical_example"]["brief"]
    route = [item for item in _string_list(raw.get("learning_route"), 7, 40) if item in DOCUMENT_TEMPLATES]
    requested = [item for item in selected_templates if item in DOCUMENT_TEMPLATES]
    return {
        "learning_goal": _short_text(raw.get("learning_goal"), 180) or fallback["learning_goal"],
        "core_thread": _short_text(raw.get("core_thread"), 260) or fallback["core_thread"],
        "knowledge_points": _string_list(raw.get("knowledge_points"), 7, 72) or fallback["knowledge_points"],
        "canonical_example": {"title": example_title, "brief": example_brief},
        "pitfalls": _string_list(raw.get("pitfalls"), 6, 120) or fallback["pitfalls"],
        "formulas_or_rules": _string_list(raw.get("formulas_or_rules"), 8, 140),
        "terms": _string_list(raw.get("terms"), 10, 72),
        "learning_route": route or requested,
    }


def generate_study_pack_blueprint(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
    selected_templates: list[str],
) -> dict:
    """Create the compact shared brief that coordinates a document pack."""
    requested = [item for item in selected_templates if item in DOCUMENT_TEMPLATES]
    context_text = "\n".join(
        f"{item.get('role', 'user')}: {_short_text(item.get('content'), 900)}"
        for item in recent_context[-4:]
    )
    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 学习资料包的总策划。根据真实辅导对话，为多份互补的学习文档做一份极短、"
                "可靠的共同策划。只使用对话中可以支持的信息，不虚构教材、题目条件、公式或考试要求。"
                "必须只返回 JSON：learning_goal（短句）、core_thread（短句）、knowledge_points（3到7项）、"
                "canonical_example（含 title 和 brief）、pitfalls（0到6项）、formulas_or_rules（0到8项）、"
                "terms（0到10项）、learning_route（所选模板 ID 的有序数组）。"
                "策划服务于后续写作，不要写成讲义，也不要解释你的推理过程。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"所选文档模板：{json.dumps(requested, ensure_ascii=False)}\n"
                f"当前学习状态：{json.dumps(learning_state, ensure_ascii=False)}\n\n"
                f"本轮问题：{question[:3500]}\n\n本轮回答：{answer[:6000]}\n\n"
                f"必要的近期上下文：\n{context_text}"
            ),
        },
    ]
    try:
        response = chat_qwen_model(
            "qwen-flash",
            messages,
            temperature=0.2,
            max_tokens=1000,
            json_mode=True,
        )
        raw = response.choices[0].message.content or ""
        return _normalize_study_pack_blueprint(
            _parse_json(raw), question, answer, learning_state, requested,
        )
    except Exception:
        # The pack should still be useful if the quick planner is briefly down.
        return _fallback_study_pack_blueprint(question, answer, learning_state, requested)


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.S)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def generate_learning_document(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
    document_template: str = "system_guide",
    study_pack_blueprint: dict | None = None,
    study_pack_templates: list[str] | None = None,
    user_id: int,
) -> dict:
    template = DOCUMENT_TEMPLATES.get(document_template, DOCUMENT_TEMPLATES["system_guide"])
    context_text = "\n".join(
        f"{item.get('role', 'user')}: {str(item.get('content', ''))[:1800]}"
        for item in recent_context[-4:]
    )
    pack_context = ""
    if study_pack_blueprint:
        blueprint = _normalize_study_pack_blueprint(
            study_pack_blueprint,
            question,
            answer,
            learning_state,
            study_pack_templates or [document_template],
        )
        selected = [item for item in (study_pack_templates or []) if item in DOCUMENT_TEMPLATES]
        other_templates = [item for item in selected if item != document_template]
        other_names = [DOCUMENT_TEMPLATES[item]["name"] for item in other_templates]
        pack_context = (
            "\n\n你正在参与同一份学习资料包，请严格遵循下面的共同策划，避免和其他章节重复：\n"
            f"- 共同学习目标：{blueprint['learning_goal']}\n"
            f"- 共同主线：{blueprint['core_thread']}\n"
            f"- 共同知识点：{'；'.join(blueprint['knowledge_points'])}\n"
            f"- 贯穿例题或场景：{blueprint['canonical_example']['title']}：{blueprint['canonical_example']['brief']}\n"
            f"- 共同易错点：{'；'.join(blueprint['pitfalls']) or '无'}\n"
            f"- 共同公式或规则：{'；'.join(blueprint['formulas_or_rules']) or '无'}\n"
            f"- 共同术语：{'；'.join(blueprint['terms']) or '无'}\n"
            f"- 你这一章的唯一职责：{STUDY_PACK_TEMPLATE_CONTRACTS.get(document_template, '按模板完成互补内容。')}\n"
            f"- 其他章节会负责：{'、'.join(other_names) or '无'}。不要把它们的主要内容重复写进本章。"
        )

    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 的学习文档 Agent。你的任务不是重复聊天回答，而是把一次真实辅导对话整理成"
                "可独立阅读、可以长期复用的中文学习文档。只使用给定对话中可靠的事实；不虚构出处、页码、"
                "统计数据或用户未提供的课程要求。代码、公式和条件必须准确。\n"
                "必须返回 JSON 对象，字段严格为：title（不超过28字）、summary（不超过80字）、"
                "highlights（3到5条短句）、content（完整 Markdown）。\n"
                "请严格使用用户指定模板的章节顺序与层级；章节不适配时可以合并并说明原因，但不能拿通用讲义章节代替模板。"
                "所有例子、公式、条件和结论都必须可由给定对话支持。"
                "出现 LaTeX 公式时，行内使用 $...$，独立公式使用单独一行的 $$...$$，以便在资料库中稳定排版。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"文档模板：{template['name']}\n模板目标：{template['purpose']}\n"
                f"篇幅要求：{template['length']}\n必须使用的 Markdown 章节：\n{template['sections']}\n"
                f"模板专属要求：{template['rules']}\n\n"
                f"当前学习状态：{json.dumps(learning_state, ensure_ascii=False)}\n\n"
                f"本轮问题：{question[:5000]}\n\n本轮回答：{answer[:10000]}\n\n"
                f"必要的近期上下文：\n{context_text}{pack_context}"
            ),
        },
    ]
    response = chat_qwen(
        messages,
        temperature=0.35,
        max_tokens=template["max_tokens"],
        json_mode=True,
    )
    raw = response.choices[0].message.content or ""
    result = _parse_json(raw)
    content = str(result.get("content", "")).strip()
    if not content:
        raise ValueError("模型没有返回文档正文")
    filtered_content, _ = filter_content(
        content,
        user_id=user_id,
        agent_name="learning_document",
        content_type="document",
        user_input=question,
    )
    highlights = [str(item).strip()[:100] for item in result.get("highlights", []) if str(item).strip()]
    return {
        "title": str(result.get("title") or "学习文档").strip()[:80],
        "summary": str(result.get("summary") or "基于当前对话生成的结构化学习资料").strip()[:240],
        "highlights": highlights[:5] or ["核心结论与知识结构", "示例、易错点与自测问题"],
        "content": filtered_content,
    }
