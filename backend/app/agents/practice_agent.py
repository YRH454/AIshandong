"""Generate small, objectively gradable practice sets from a tutor answer."""

import json
import logging
import re

from app.services.llm import chat_qwen


logger = logging.getLogger(__name__)


_SUPPORTED_TYPES = {"single_choice", "true_false", "fill_blank", "code_task", "oral_response"}

_PRACTICE_MODES = {
    "standard": {
        "title": "当前主题练习测验",
        "summary": "用可自动批改的题目检查当前理解，并定位需要回看的知识点。",
        "count": 5,
        "minutes": 8,
        "instruction": "生成一套覆盖核心概念、条件判断与常见误区的基础练习。",
    },
    "similar": {
        "title": "同类题训练",
        "summary": "保持原问题的知识结构，更换数据和表述来巩固方法。",
        "count": 6,
        "minutes": 10,
        "instruction": "优先复用当前问题的解题结构与知识点，但必须更换数据、情境或表述，避免复述原题。",
    },
    "variants": {
        "title": "变式题训练",
        "summary": "通过改变条件、方向和边界，检查是否真的会迁移。",
        "count": 6,
        "minutes": 12,
        "instruction": "有意识地改变题目条件、问题方向、边界情况或干扰项，检验学习者能否把方法迁移到新情境。",
    },
    "special": {
        "title": "专项训练",
        "summary": "围绕一个薄弱知识点，从基础判断逐步练到应用。",
        "count": 8,
        "minutes": 15,
        "instruction": "围绕当前学习状态中的薄弱点或指定重点出题，按基础、理解、应用的顺序递进，并覆盖易错条件。",
    },
    "mock": {
        "title": "模拟试卷",
        "summary": "按限时与分值完成一轮小型模拟，再查看失分位置。",
        "count": 12,
        "minutes": 20,
        "instruction": "组织成一份小型模拟试卷，题目由易到难，覆盖概念、判断与应用；每题必须能稳定自动批改。",
    },
    "coding": {
        "title": "编程实验",
        "summary": "完成代码任务，在自己的运行环境中核对测试用例与逐步提示。",
        "count": 3,
        "minutes": 25,
        "instruction": "只生成 code_task（编程实验）题。每题必须给出 language、starter_code、2 到 4 个 tests（含 label、input、expected_output）和 2 到 3 条 hints。测试用例供学习者在本地或课程环境运行后勾选确认，不要声称网页会执行代码。",
    },
    "oral": {
        "title": "口述测验",
        "summary": "用自己的话讲清概念，再通过关键词与追问检查表达和理解。",
        "count": 4,
        "minutes": 10,
        "instruction": "只生成 oral_response（口述回答）题。每题必须给出 2 到 5 个 target_keywords、sample_answer 和 follow_up；问题要促使学习者解释原因、条件或过程，而不只是背定义。",
    },
}


def _mode_config(practice_mode: str) -> dict:
    return _PRACTICE_MODES.get(practice_mode, _PRACTICE_MODES["standard"])


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

    if question_type == "code_task":
        language = _clean_text(raw.get("language"), 32).lower() or "python"
        starter_code = str(raw.get("starter_code") or "").strip()[:2400]
        tests = raw.get("tests") if isinstance(raw.get("tests"), list) else []
        normalized_tests = []
        for test in tests[:4]:
            if not isinstance(test, dict):
                continue
            label = _clean_text(test.get("label"), 100)
            expected = _clean_text(test.get("expected_output"), 400)
            if label and expected:
                normalized_tests.append({
                    "label": label,
                    "input": _clean_text(test.get("input"), 400),
                    "expected_output": expected,
                })
        hints = [_clean_text(item, 300) for item in (raw.get("hints") or []) if _clean_text(item, 300)][:3]
        answer = _clean_text(raw.get("answer") or raw.get("sample_solution"), 2400)
        if not starter_code or not normalized_tests or not answer:
            return None
        return {
            "id": f"q{index}", "type": question_type, "prompt": prompt,
            "options": [], "answer": answer, "explanation": explanation,
            "knowledge_point": knowledge_point or "当前知识点", "language": language,
            "starter_code": starter_code, "tests": normalized_tests, "hints": hints,
        }

    if question_type == "oral_response":
        keywords = [_clean_text(item, 80) for item in (raw.get("target_keywords") or []) if _clean_text(item, 80)][:5]
        sample_answer = _clean_text(raw.get("sample_answer") or raw.get("answer"), 900)
        follow_up = _clean_text(raw.get("follow_up"), 300)
        if not keywords or not sample_answer:
            return None
        return {
            "id": f"q{index}", "type": question_type, "prompt": prompt,
            "options": [], "answer": sample_answer, "explanation": explanation,
            "knowledge_point": knowledge_point or "当前知识点", "target_keywords": keywords,
            "follow_up": follow_up,
        }

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


def _fallback_experimental_questions(
    practice_mode: str,
    question: str,
    answer: str,
    learning_state: dict,
) -> list[dict]:
    """Keep coding and oral practice usable when a model misses the strict JSON schema."""
    topic = _clean_text(
        learning_state.get("current_topic") or learning_state.get("knowledge_points", [""])[0] or question,
        70,
    ) or "当前主题"
    reference = _clean_text(answer, 420) or "请依据当前对话中的概念、条件与步骤完成说明。"
    if practice_mode == "coding":
        task_prompts = [
            f"用递归方式完成一个与“{topic}”相关的最小可验证函数。请补全终止条件，并保证每次调用都向终止条件靠近。",
            f"为“{topic}”写一个递归版本的辅助函数，并用一个边界输入验证它能正确停止。",
            f"把“{topic}”中的核心过程写成可读的递归代码，要求在代码中用注释说明终止条件与递归调用。",
        ]
        return [
            {
                "id": f"q{index}",
                "type": "code_task",
                "prompt": prompt,
                "options": [],
                "answer": "完成",
                "explanation": "请先在本地或课程环境中运行，再确认测试用例是否全部通过。",
                "knowledge_point": topic,
                "language": "python",
                "starter_code": "def solve(value):\n    # 写出终止条件\n    if ...:\n        return ...\n    # 让问题规模缩小\n    return solve(...)\n",
                "tests": [
                    {"label": "边界输入", "input": "最小有效输入", "expected_output": "函数直接返回，不继续递归"},
                    {"label": "普通输入", "input": "一个非边界有效输入", "expected_output": "结果正确且递归会收敛"},
                ],
                "hints": [
                    "先写出什么情况下问题已经足够小，可以直接返回。",
                    "检查递归调用的参数是否确实向终止条件靠近。",
                    "在本地运行边界输入和普通输入后再勾选确认。",
                ],
            }
            for index, prompt in enumerate(task_prompts, start=1)
        ]
    oral_prompts = [
        f"请不用背定义，用自己的话解释“{topic}”是什么，并说明它解决什么问题。",
        f"请说明“{topic}”成立或正确使用时最重要的条件是什么，为什么不能忽略它。",
        f"请用一个自己的例子讲清“{topic}”的过程，并说出最容易出错的一步。",
        f"请向一位刚接触“{topic}”的同学解释如何自检是否真正理解。",
    ]
    return [
        {
            "id": f"q{index}",
            "type": "oral_response",
            "prompt": prompt,
            "options": [],
            "answer": reference,
            "explanation": "回答中应能听出概念、条件或过程之间的关系，而不仅是重复一个定义。",
            "knowledge_point": topic,
            "target_keywords": [topic, "条件", "过程"],
            "follow_up": "如果条件发生变化，你的解释中哪一步需要调整？",
        }
        for index, prompt in enumerate(oral_prompts, start=1)
    ]


def _fallback_objective_questions(
    practice_mode: str,
    question: str,
    answer: str,
    learning_state: dict,
    question_count: int,
) -> list[dict]:
    """Return dependable objective checks when the model response is malformed.

    The normal path remains model-authored.  This fallback keeps a resource pack
    usable when one concurrent request returns incomplete JSON, which otherwise
    forces the learner to regenerate all six modes.
    """
    topic = _clean_text(
        learning_state.get("current_topic") or learning_state.get("knowledge_points", [""])[0] or question,
        70,
    ) or "当前主题"
    # Keep the local fallback useful even when a provider is unavailable. The
    # old four-question cycle made a 12-question mock repeat the same wording
    # three times, which looked like a rendering bug and weakened the review.
    templates = [
        {
            "type": "fill_blank",
            "prompt": f"填空：处理“{topic}”时，应先明确 ______ ，再按照过程逐步验证。",
            "options": [], "answer": "适用条件", "accepted_answers": ["适用条件", "条件", "边界条件"],
            "explanation": "先确认适用条件，才能判断方法是否能够正确使用。",
        },
        {
            "type": "single_choice",
            "prompt": f"关于“{topic}”，下列哪项最符合当前学习内容中的核心判断？",
            "options": ["先核对题目条件与核心过程", "直接套用记住的答案", "忽略边界情况", "只比较最后结果"],
            "answer": "先核对题目条件与核心过程",
            "explanation": "稳定理解需要先确认条件，再核对当前过程是否符合核心方法。",
        },
        {
            "type": "single_choice",
            "prompt": f"如果题目中的条件发生变化，处理“{topic}”时最合理的做法是什么？",
            "options": ["重新检查条件并调整推理", "沿用原题的每个数字", "跳过条件直接写结论", "只看题目最后一句"],
            "answer": "重新检查条件并调整推理",
            "explanation": "条件变化可能影响适用范围和步骤，不能机械复用原题答案。",
        },
        {
            "type": "true_false",
            "prompt": f"请判断：只记住“{topic}”的结论，而不检查适用条件，也能稳定解决相关问题。",
            "options": ["正确", "错误"], "answer": "错误",
            "explanation": "理解知识点还需要结合条件和过程验证，不能只记住结论。",
        },
        {
            "type": "fill_blank",
            "prompt": f"填空：解释“{topic}”时，除了结论，还要说明关键 ______ 和推导过程。",
            "options": [], "answer": "依据", "accepted_answers": ["依据", "理由", "条件"],
            "explanation": "把依据和过程说清楚，才能判断结论是否真的成立。",
        },
        {
            "type": "single_choice",
            "prompt": f"学习“{topic}”后，哪种方式最能检验自己是否真正理解？",
            "options": ["换一个情境独立说明步骤", "只重复课本定义", "只记住示例数字", "只看最后答案"],
            "answer": "换一个情境独立说明步骤",
            "explanation": "在新情境中复述条件、过程和结论，才能检验迁移能力。",
        },
        {
            "type": "single_choice",
            "prompt": f"在“{topic}”的实际应用中出现异常结果时，首先应该回看什么？",
            "options": ["输入条件和关键步骤", "显示颜色是否醒目", "答案的排版顺序", "是否跳过了总结"],
            "answer": "输入条件和关键步骤",
            "explanation": "异常通常先来自条件理解或步骤执行，应该沿过程定位原因。",
        },
        {
            "type": "true_false",
            "prompt": f"请判断：只要最终答案看起来合理，就可以省略“{topic}”的中间验证步骤。",
            "options": ["正确", "错误"], "answer": "错误",
            "explanation": "中间步骤用于检查条件、方法和单位，不能仅凭结果判断正确性。",
        },
        {
            "type": "fill_blank",
            "prompt": f"填空：面对“{topic}”的新题，完成计算后还应进行结果 ______ 。",
            "options": [], "answer": "检验", "accepted_answers": ["检验", "检查", "验证"],
            "explanation": "最后检验可以发现单位、方向或边界条件上的遗漏。",
        },
        {
            "type": "single_choice",
            "prompt": f"要把“{topic}”迁移到另一道题，下面哪项最重要？",
            "options": ["识别相同的关系和不同的条件", "把原题文字逐句复制", "只寻找相同的数字", "忽略题目背景"],
            "answer": "识别相同的关系和不同的条件",
            "explanation": "迁移依赖结构关系，同时要重新判断新条件是否满足方法要求。",
        },
        {
            "type": "single_choice",
            "prompt": f"下列哪种做法最容易造成“{topic}”的判断错误？",
            "options": ["把相近概念当成同一个概念", "先列出已知条件", "用反例检查结论", "写出每一步的依据"],
            "answer": "把相近概念当成同一个概念",
            "explanation": "相近概念的适用条件可能不同，混淆边界会让后续推理失效。",
        },
        {
            "type": "single_choice",
            "prompt": f"如果要向同学讲清“{topic}”，最完整的表达顺序是什么？",
            "options": ["先说对象和条件，再讲过程，最后给出结论", "先报结论，再补任何条件", "只展示公式不解释符号", "只讲一个例子不说适用范围"],
            "answer": "先说对象和条件，再讲过程，最后给出结论",
            "explanation": "对象、条件、过程和结论形成完整链条，听者才能判断方法是否适用。",
        },
    ]
    questions: list[dict] = []
    for index in range(question_count):
        template = templates[index % len(templates)].copy()
        template["id"] = f"q{index + 1}"
        template["knowledge_point"] = topic
        questions.append(template)
    return questions


def generate_practice_set(
    *,
    question: str,
    answer: str,
    recent_context: list[dict],
    learning_state: dict,
    user_id: int,
    question_count: int = 5,
    focus_points: list[str] | None = None,
    practice_mode: str = "standard",
) -> dict:
    """Return a typed practice set with answers retained only server-side."""
    mode = _mode_config(practice_mode)
    question_count = int(mode["count"])
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
                "single_choice（单选）、true_false（判断）、fill_blank（短填空），或在指定时使用 code_task（编程实验）、oral_response（口述回答）。"
                "必须返回 JSON 对象，字段只能为 title、summary、knowledge_points、questions。"
                f"questions 必须刚好有 {question_count} 题，每题字段为 type、prompt、options、answer、"
                "accepted_answers（仅填空可选）、explanation、knowledge_point；code_task 可附 language、starter_code、tests、hints；oral_response 可附 target_keywords、sample_answer、follow_up。"
                "single_choice 的 options 为 2-4 个完整选项，answer 必须是其中一个选项文本。"
                "true_false 的 answer 只能是“正确”或“错误”。填空题答案应简短、唯一或给出可接受同义表达。"
                "题目要覆盖核心理解、条件判断和易错点，难度由浅入深。解释必须指出为什么对或错。"
                f"本次练习形式：{practice_mode}。具体要求：{mode['instruction']}"
                + (f"本轮是专项补弱：{question_count} 题必须优先围绕这些薄弱点出题：{focus_text}。" if focus_text else "")
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
    result: dict = {}
    try:
        response = chat_qwen(messages, temperature=0.2, max_tokens=1400, json_mode=True)
        result = _parse_json(response.choices[0].message.content or "")
    except Exception:
        # Keep the learning flow available when one provider request is slow,
        # temporarily unavailable, or returns malformed structured content.
        logger.warning("practice generation fell back to local objective questions", exc_info=True)
    normalized: list[dict] = []
    seen_prompts: set[str] = set()
    for index, raw in enumerate(result.get("questions") or [], start=1):
        item = _normalize_question(raw, index)
        if not item:
            continue
        fingerprint = re.sub(r"\s+", " ", str(item.get("prompt") or "")).strip().casefold()
        if fingerprint in seen_prompts:
            continue
        seen_prompts.add(fingerprint)
        normalized.append(item)
    if len(normalized) < question_count and practice_mode in {"coding", "oral"}:
        normalized = _fallback_experimental_questions(practice_mode, question, answer, learning_state)
    if len(normalized) < question_count:
        normalized = _fallback_objective_questions(
            practice_mode, question, answer, learning_state, question_count,
        )
    questions = normalized[:question_count]
    knowledge_points = [_clean_text(item, 100) for item in result.get("knowledge_points") or []]
    knowledge_points.extend(item["knowledge_point"] for item in questions)
    knowledge_points = list(dict.fromkeys(item for item in knowledge_points if item))[:5]
    title = _clean_text(result.get("title"), 80) or mode["title"]
    summary = _clean_text(result.get("summary"), 240) or mode["summary"]
    return {
        "title": title,
        "summary": summary,
        "highlights": [
            f"共 {question_count} 项，建议用时约 {mode['minutes']} 分钟",
            "答案与解析会在完成后展示",
            "完成后生成薄弱点与下一步练习建议",
        ],
        "knowledge_points": knowledge_points,
        "questions": questions,
        "practice_mode": practice_mode,
        "estimated_minutes": mode["minutes"],
    }
