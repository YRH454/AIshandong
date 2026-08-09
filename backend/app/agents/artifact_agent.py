"""Qwen-powered learning document generator."""

import json
import re

from app.safety.content_filter import filter_content
from app.services.llm import chat_qwen


PURPOSES = {
    "review": "用于课后复习：强调知识结构、理解检查和可回忆的要点",
    "preview": "用于课前预习：先给全局地图，再解释必要的前置概念",
    "exam": "用于考前冲刺：强调高频考点、判题线索、易错点和快速自测",
}
DEPTHS = {
    "concise": "精简，约 700—1000 字，只保留最必要内容",
    "standard": "标准，约 1200—1800 字，兼顾解释、例子与自测",
    "deep": "深入，约 2000—2800 字，补齐原理、推导、边界与迁移示例",
}
STYLES = {
    "plain": "通俗讲解，优先使用贴近学生经验的类比",
    "notes": "课堂笔记，层级清楚、便于快速扫描与二次编辑",
    "exam": "考试重点，突出条件、关键词、易错判断和答题步骤",
}


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
    purpose: str,
    depth: str,
    style: str,
    user_id: int,
) -> dict:
    purpose_text = PURPOSES.get(purpose, PURPOSES["review"])
    depth_text = DEPTHS.get(depth, DEPTHS["standard"])
    style_text = STYLES.get(style, STYLES["plain"])
    context_text = "\n".join(
        f"{item.get('role', 'user')}: {str(item.get('content', ''))[:1800]}"
        for item in recent_context[-4:]
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
                "content 必须自然包含：核心结论、知识结构、通俗讲解、例子或代码、易错点、自测问题、下一步建议。"
                "若某部分不适合当前学科，可以合并而不是生硬凑标题。自测题先不给答案。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"生成用途：{purpose_text}\n内容深度：{depth_text}\n表达风格：{style_text}\n\n"
                f"当前学习状态：{json.dumps(learning_state, ensure_ascii=False)}\n\n"
                f"本轮问题：{question[:5000]}\n\n本轮回答：{answer[:10000]}\n\n"
                f"必要的近期上下文：\n{context_text}"
            ),
        },
    ]
    response = chat_qwen(messages, temperature=0.35, max_tokens=5000, json_mode=True)
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
