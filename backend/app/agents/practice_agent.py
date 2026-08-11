"""Generate small, objectively gradable practice sets from a tutor answer."""

import json
import re

from app.services.llm import chat_qwen


_SUPPORTED_TYPES = {"single_choice", "true_false", "fill_blank"}


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


def _clean_text(value: object, limit: int) -> str:
    return " ".join(str(value or "").strip().split())[:limit]


def _normalize_answer(value: object, options: list[str]) -> str:
    answer = _clean_text(value, 120)
    if answer.isdigit() and 1 <= int(answer) <= len(options):
        return options[int(answer) - 1]
    return answer


def _normalize_question(raw: object, index: int) -> dict | None:
    if not isinstance(raw, dict):
        return None
    question_type = str(raw.get("type") or "single_choice").strip()
    if question_type not in _SUPPORTED_TYPES:
        question_type = "single_choice"
    prompt = _clean_text(raw.get("prompt"), 700)
    explanation = _clean_text(raw.get("explanation"), 900)
    knowledge_point = _clean_text(raw.get("knowledge_point"), 100)
    if not prompt or not explanation:
        return None

    if question_type == "true_false":
        answer = _clean_text(raw.get("answer"), 40).lower()
        answer = "正确" if answer in {"正确", "对", "true", "t", "yes", "是"} else "错误"
        return {
            "id": f"q{index}",
            "type": question_type,
            "prompt": prompt,
            "options": ["正确", "错误"],
            "answer": answer,
            "explanation": explanation,
            "knowledge_point": knowledge_point or "当前知识点",
        }

    if question_type == "fill_blank":
        answers = raw.get("answers") or raw.get("answer")
        if not isinstance(answers, list):
            answers = [answers]
        normalized_answers = [_clean_text(item, 120) for item in answers]
        normalized_answers = list(dict.fromkeys(item for item in normalized_answers if item))
        if not normalized_answers:
            return None
        return {
            "id": f"q{index}",
            "type": question_type,
            "prompt": prompt,
            "options": [],
            "answer": normalized_answers[0],
            "accepted_answers": normalized_answers,
            "explanation": explanation,
            "knowledge_point": knowledge_point or "当前知识点",
        }

    raw_options = raw.get("options") or []
    options = [_clean_text(item, 180) for item in raw_options if _clean_text(item, 180)]
    options = list(dict.fromkeys(options))
    if len(options) < 2:
        return None
    answer = _normalize_answer(raw.get("answer"), options)
    if answer not in options:
        return None
    return {
        "id": f"q{index}",
        "type": "single_choice",
        "prompt": prompt,
        "options": options[:4],
        "answer": answer,
        "explanation": explanation,
        "knowledge_point": knowledge_point or "当前知识点",
    }


def generate_practice_set(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
    user_id: int,
    question_count: int = 5,
    focus_points: list[str] | None = None,
) -> dict:
    """Return a five-question practice set with answers retained only server-side."""
    context_text = "\n".join(
        f"{item.get('role', 'user')}: {str(item.get('content', ''))[:1200]}"
        for item in recent_context[-4:]
    )
    focus_text = "、".join(str(point).strip() for point in (focus_points or []) if str(point).strip())
    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 的练习测验 Agent。请严格基于给定对话，生成一套中文学习检验题，"
                "不要编造对话中不存在的课程要求或事实。只使用可自动、稳定批改的题型："
                "single_choice（单选）、true_false（判断）、fill_blank（短填空）。"
                "必须返回 JSON 对象，字段只能为 title、summary、knowledge_points、questions。"
                f"questions 必须刚好有 {question_count} 题，每题字段为 type、prompt、options、answer、"
                "accepted_answers（仅填空可选）、explanation、knowledge_point。"
                "single_choice 的 options 为 2-4 个完整选项，answer 必须是其中一个选项文本。"
                "true_false 的 answer 只能是“正确”或“错误”。填空题答案应简短、唯一或给出可接受同义表达。"
                "题目要覆盖核心理解、条件判断和易错点，难度由浅入深。解释必须指出为什么对或错。"
                + (f"本轮是专项补弱：5 题必须优先围绕这些薄弱点出题：{focus_text}。" if focus_text else "")
            ),
        },
        {
            "role": "user",
            "content": (
                f"当前学习状态：{json.dumps(learning_state, ensure_ascii=False)}\n\n"
                f"本轮问题：{question[:5000]}\n\n本轮回答：{answer[:10000]}\n\n"
                f"必要的近期上下文：\n{context_text}"
            ),
        },
    ]
    response = chat_qwen(messages, temperature=0.2, max_tokens=2200, json_mode=True)
    result = _parse_json(response.choices[0].message.content or "")
    normalized = [
        item
        for index, raw in enumerate(result.get("questions") or [], start=1)
        if (item := _normalize_question(raw, index))
    ]
    if len(normalized) < question_count:
        raise ValueError("生成的练习题不完整，请重新生成")
    questions = normalized[:question_count]
    knowledge_points = [_clean_text(item, 100) for item in result.get("knowledge_points") or []]
    knowledge_points.extend(item["knowledge_point"] for item in questions)
    knowledge_points = list(dict.fromkeys(item for item in knowledge_points if item))[:5]
    title = _clean_text(result.get("title"), 80) or "当前主题练习测验"
    summary = _clean_text(result.get("summary"), 240) or f"{question_count} 题练习，完成后查看逐题解析与薄弱点。"
    return {
        "title": title,
        "summary": summary,
        "highlights": [
            f"共 {question_count} 题，可逐题作答后统一提交",
            "包含单选、判断和短填空，答案在提交前不展示",
            "完成后生成错题解析与主题掌握建议",
        ],
        "knowledge_points": knowledge_points,
        "questions": questions,
    }
