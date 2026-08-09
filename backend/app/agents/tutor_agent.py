"""RHYME 学习 Agent — 千问对话、学习状态记忆与安全审核。"""

import json
import logging
import re
from app.services.llm import chat_qwen, chat_qwen_model, chat_qwen_stream
from app.services.profile_db import get_profile
from app.safety.content_filter import inject_safety_prompt

logger = logging.getLogger(__name__)

EMPTY_LEARNING_STATE = {
    "subject": "",
    "goal": "",
    "knowledge_points": [],
    "weak_points": [],
    "deadline": "",
    "level": "",
    "current_topic": "",
}


def normalize_learning_state(value: dict | None, previous: dict | None = None) -> dict:
    """把模型输出收敛为稳定、可持久化的学习状态结构。"""
    base = {**EMPTY_LEARNING_STATE, **(previous or {})}
    incoming = value if isinstance(value, dict) else {}
    for key in ("subject", "goal", "deadline", "level", "current_topic"):
        candidate = incoming.get(key)
        if isinstance(candidate, str) and candidate.strip():
            base[key] = candidate.strip()[:160]
    for key in ("knowledge_points", "weak_points"):
        candidate = incoming.get(key)
        if isinstance(candidate, str):
            candidate = [item.strip() for item in re.split(r"[,，、;；\n]", candidate) if item.strip()]
        if isinstance(candidate, list):
            merged = [str(item).strip() for item in candidate if str(item).strip()]
            base[key] = list(dict.fromkeys(merged))[:12]
    if base["current_topic"] and base["current_topic"] not in base["knowledge_points"]:
        base["knowledge_points"] = [*base["knowledge_points"], base["current_topic"]][-12:]
    return base


def _fallback_learning_state(question: str, previous: dict | None = None) -> dict:
    """模型提取异常时保留旧状态，并从明确措辞中提取最小信息。"""
    state = normalize_learning_state({}, previous)
    subject_rules = (
        (r"数据结构|递归|二叉树|链表|栈|队列", "数据结构"),
        (r"高数|微积分|极限|导数|积分", "高等数学"),
        (r"线性代数|矩阵|特征值", "线性代数"),
        (r"英语|长难句|阅读理解|单词", "英语"),
        (r"计算机网络|TCP|HTTP", "计算机网络"),
        (r"操作系统|进程|线程|死锁", "操作系统"),
    )
    for pattern, subject in subject_rules:
        if re.search(pattern, question, re.I):
            state["subject"] = subject
            break
    deadline = re.search(r"(明天|后天|下周|(?:\d+|[一二三四五六七八九十两]+)\s*(?:天|周|个月)后)", question)
    if deadline:
        state["deadline"] = deadline.group(1).replace(" ", "")
    if not state["goal"] and re.search(r"考试|考研|期末|复习|作业|面试", question):
        state["goal"] = question[:80]
    topic_rules = ("递归", "终止条件", "二叉树", "链表", "极限", "导数", "积分", "长难句", "TCP", "进程", "线程")
    topics = [topic for topic in topic_rules if topic.lower() in question.lower()]
    if topics:
        state["current_topic"] = topics[-1]
        state["knowledge_points"] = list(dict.fromkeys([*state["knowledge_points"], *topics]))[-12:]
    if re.search(r"不懂|不会|薄弱|总错|没学明白|困难", question):
        weak = state["current_topic"] or (topics[-1] if topics else question[:30])
        state["weak_points"] = list(dict.fromkeys([*state["weak_points"], weak]))[-12:]
    return state


def extract_learning_state(question: str, answer: str, previous: dict | None = None) -> dict:
    """使用千问把对话提取为可持续更新的学生学习状态。"""
    previous_state = normalize_learning_state({}, previous)
    messages = [
        {
            "role": "system",
            "content": (
                "你是 RHYME 的学习状态提取器。根据旧状态和最新一轮问答更新学生状态。"
                "只返回 JSON 对象，不要解释。字段必须包括：subject、goal、knowledge_points、"
                "weak_points、deadline、level、current_topic。knowledge_points 和 weak_points 必须是字符串数组。"
                "没有新证据时保留旧值；不要编造截止时间、水平或学习目标。"
            ),
        },
        {
            "role": "user",
            "content": (
                f"旧状态：{json.dumps(previous_state, ensure_ascii=False)}\n\n"
                f"学生最新输入：{question[:2000]}\n\n"
                f"导师回答摘要：{answer[:2500]}"
            ),
        },
    ]
    try:
        response = chat_qwen_model(
            "qwen-flash",
            messages,
            temperature=0.1,
            max_tokens=700,
            json_mode=True,
        )
        content = (response.choices[0].message.content or "").strip()
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.I)
        normalized = normalize_learning_state(json.loads(content), previous_state)
        return _fallback_learning_state(question, normalized)
    except Exception as exc:
        logger.warning("学习状态提取失败，使用规则回退: %s", exc)
        return _fallback_learning_state(question, previous_state)


def build_learning_state_context(state: dict | None) -> str:
    normalized = normalize_learning_state({}, state)
    if not any(normalized.values()):
        return ""
    return (
        "\n\n【本次会话的学习状态】\n"
        f"{json.dumps(normalized, ensure_ascii=False)}\n"
        "请延续这些背景回答当前问题。不要机械复述状态；仅在确有帮助时体现。"
    )

# ==================== 4种回答模式 ====================

MODE_PROMPTS = {
    "text": """你是一位专业的AI辅导老师。请详细解答用户的学习问题。
要求：
- 用清晰的结构回答（标题、段落、列表）
- 包含必要的解释和具体例子
- 语言通俗易懂，避免堆砌术语
- 适当使用类比帮助理解
- Markdown格式输出""",

    "diagram": """你是一位擅长可视化教学的AI辅导老师。你的特殊能力是生成交互式HTML图解页面。

严格要求：
1. 先用2-3句话简要解释核心概念
2. 然后生成一个完整的HTML可视化页面，用 ```html 代码块包裹
3. HTML页面要求：
   - 完整的单文件HTML（<!DOCTYPE html>开头），CSS和JS全部内嵌在<style>和<script>标签中
   - 配色方案：主色#D4845A（暖橙），辅色#8E6EB4（紫）#4A7C6B（青绿）#5B8C7B（浅绿）#DEB040（金），背景#fdfbf9
   - 用SVG图形、CSS动画、或Canvas绘制精美的知识图解
   - 必须有交互效果（hover高亮、点击展开详情、动画过渡等）
   - 页面必须铺满容器！html和body设置 width:100%; min-height:800px; margin:0; padding:20px; box-sizing:border-box
   - 内容充实饱满，不要留大片空白
   - 自适应宽度
   - 所有文字用中文标注
   - 不要引用任何外部CDN或资源链接，一切自包含
   - 字体使用 system-ui, -apple-system, sans-serif
4. 适合的图解类型：
   - 流程图（带箭头的SVG节点连线）
   - 知识树/思维导图（层级展开的树形结构）
   - 时序图（从上到下的步骤流）
   - 对比图（左右两栏对比）
   - 架构图（分层模块 + 连线）
   - 循环图（环形流程）
5. 图解后面用1-2句话总结要点

示例结构：
核心概念的简要解释文字...

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><style>/* 内嵌CSS */</style></head>
<body>
  <!-- SVG/Canvas/HTML图解 -->
  <script>/* 交互逻辑 */</script>
</body>
</html>
```

总结要点...""",

    "video": """你是一位教学视频导演。请为用户的问题设计一个3-5分钟的教学视频脚本。

严格要求：
1. 包含完整的分镜脚本：开场引入、核心讲解（分步骤）、总结回顾
2. 每个段落标注时间轴，格式如 [00:00-00:30]
3. 每个分镜包含：画面描述 + 旁白文字
4. 脚本结尾必须包含一段英文视频生成Prompt，用以下格式：

===VIDEO_PROMPT===
A professional educational animation about [topic], featuring clean motion graphics with [specific visual elements], smooth transitions between concepts, modern flat design style, soft lighting, 4K quality, educational tone
===END_PROMPT===

这段英文Prompt将被用于AI视频生成工具，请尽量详细描述画面风格、视觉元素和氛围。""",

    "code": """你是一位专业的编程老师。请为用户的问题提供完整的代码示例。
要求：
- 代码要完整可运行，包含必要的import
- 每个关键步骤都有中文注释
- 包含运行说明和预期输出
- 如果涉及多个文件，分别标注文件名
- 先简要解释思路，再给代码
- Markdown格式，代码用 ```language 代码块""",

    "socratic": """你是苏格拉底式导师。核心原则：
1. **永远不直接给出答案** — 用提问引导学生自己发现答案
2. 每次只问 1 个问题，等学生回答后再追问下一个
3. 如果学生卡住，给出提示而非答案 — 提示也是用问句形式
4. 至少追问 3 轮后才给出总结
5. 无论学生回答对错，先肯定再追问："你的思路有道理。那么..."
6. 最后一轮结束时，给出[feynman]标记，提示学生可以切换到费曼模式
7. 语气要友好、鼓励，像在和一个聪明的学生对话""",

    "feynman": """你是费曼学习法的检验者。角色：你是一名"学弟"，正在向"老师"（学生）请教不懂的问题。

你的任务：
1. 用学弟的语气请"老师"讲解一个概念
2. 在"老师"讲解后，针对讲得不清楚的地方追问：
   - "我还是不太懂，什么叫..."
   - "你能用更简单的例子再解释一下吗？"
   - "这个地方为什么是这样的？"
3. 如果老师讲得好，说"啊，我明白了！原来是这样"
4. 至少 3 轮对话后，从你的回复末尾给出评分：
   [SCORE:XX分] （0-100分，评价老师讲得是否清晰易懂）
   [GOOD:讲解的亮点]
   [IMPROVE:需要加强的地方]
5. 友好、好奇，像一个真正想学习的学生""",
}


# ==================== 画像上下文 ====================

def build_profile_context(user_id: int) -> str:
    """从DB读取用户画像，构建上下文字符串"""
    profile = get_profile(user_id)
    if not profile or not profile.get("profile"):
        return ""

    data = profile["profile"]
    if not isinstance(data, dict):
        return ""

    dim_map = {
        "knowledge_base": "知识基础",
        "learning_style": "学习风格",
        "weak_points": "学习难点",
        "interests": "兴趣方向",
        "goals": "学习目标",
        "learning_pace": "学习节奏",
        "interaction_pref": "交互偏好",
    }

    lines = []
    has_data = False
    for key, label in dim_map.items():
        val = data.get(key, "")
        if isinstance(val, str) and val.strip():
            lines.append(f"- {label}：{val}")
            has_data = True

    if not has_data:
        return ""

    return "\n\n【当前学生画像】\n" + "\n".join(lines) + "\n\n请根据以上画像调整回答风格和深度。"


def _build_kb_context(query: str) -> str:
    """从 RAG 知识库检索相关内容，构建上下文字符串"""
    try:
        from app.services.rag_service import get_rag_service
        rag = get_rag_service()
        if not rag.is_ready:
            return ""
        chunks = rag.retrieve_texts(query, k=3)
        if not chunks:
            return ""
        kb_text = "\n".join(f"- {c[:300]}" for c in chunks)
        return f"\n\n【参考知识库（基于以下内容回答，不要编造不存在的信息）】\n{kb_text}"
    except Exception:
        return ""


# ==================== 追问相关性判断 ====================

def check_follow_up_relevance(new_question: str, prev_question: str, prev_answer: str) -> bool:
    """用轻量LLM调用判断新问题是否与上文相关。

    让模型输出 0/1/2 三档评分,解析首个数字,≥1 判相关;
    LLM 异常时回退到关键词共享判断,避免"一律拒绝追问"。
    """
    try:
        resp = chat_qwen([
            {"role": "system", "content": "判断用户的新问题是否与之前讨论的主题相关。仅回复一个数字：0=完全无关，1=部分相关，2=高度相关。不要解释。"},
            {"role": "user", "content": f"之前的问题：{prev_question}\n之前的回答主题：{prev_answer[:500]}\n\n新问题：{new_question}\n\n回复数字。"}
        ], temperature=0.1, max_tokens=5)
        result = resp.choices[0].message.content.strip()
        import re as _re
        m = _re.search(r'[012]', result)
        if m:
            return int(m.group(0)) >= 1
        # 未解析到数字：宽松回退(输出含"相关"且不含"无关")
        return "相关" in result and "无关" not in result
    except Exception:
        # 回退：关键词共享判断(共享名词/动词超过阈值视为相关)
        try:
            import jieba
            prev_words = set(jieba.lcut(prev_question))
            new_words = set(jieba.lcut(new_question))
            shared = len(prev_words & new_words)
            return shared >= 2 or bool(prev_question[:4] == new_question[:4])
        except Exception:
            return True


# ==================== 构建消息 ====================

def build_tutor_messages(
    question: str,
    mode: str = "text",
    user_id: int = 0,
    history: list = None,
    parent_qa: dict = None,
    learning_state: dict = None,
) -> list:
    """构建发送给LLM的消息列表（含画像 + RAG知识库上下文）"""
    # 基础 system prompt + 防幻觉规则注入
    system_prompt = inject_safety_prompt(
        MODE_PROMPTS.get(mode, MODE_PROMPTS["text"]),
        short=(mode in ("diagram", "code")),
    )

    # 注入画像上下文
    profile_ctx = build_profile_context(user_id)
    if profile_ctx:
        system_prompt += profile_ctx

    system_prompt += build_learning_state_context(learning_state)

    # 注入 RAG 知识库上下文
    kb_ctx = _build_kb_context(question)
    if kb_ctx:
        system_prompt += kb_ctx

    # 构建 user 消息
    if parent_qa:
        # 追问模式：注入上下文
        user_content = f"之前的问答：\n问：{parent_qa['question']}\n答：{parent_qa['answer'][:2000]}\n\n用户的追问：{question}"
    else:
        user_content = question

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    # 加入最近几轮对话历史（最多5轮）
    if history:
        recent = history[-10:]
        for msg in recent:
            messages.append({"role": msg["role"], "content": msg["content"][:1000]})

    messages.append({"role": "user", "content": user_content})

    return messages


def stream_tutor_answer(messages: list, mode: str = "text"):
    """流式生成辅导回答，图解模式给更多token"""
    max_tok = 16384 if mode == "diagram" else 8192
    return chat_qwen_stream(messages, temperature=0.5, max_tokens=max_tok)
