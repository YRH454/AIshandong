"""
5 层内容安全审核管道（参考 A3LearnMake + zhi-xin + AptAdapt）

Layer 1: 敏感词过滤 —— 政治/色情/暴力/考试作弊/论文代写
Layer 2: 幻觉检测 —— 不确定表述 + 绝对化断言 + 虚假引用
Layer 3: 知识库交叉验证 —— jieba 分词计算内容与知识库关键词重叠率
Layer 4: 结构完整性 —— 文档≥200字、题目≥3道且有答案
Layer 5: 审计日志 —— 每次 Agent 调用记录到 audit_logs 表

所有 Agent 输出必须经过 filter_content() 过滤后再返回给用户。
"""
import re
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


# ============================================================================
# Layer 1: 敏感词过滤
# ============================================================================

# 政治敏感词（教育场景核心关注）
POLITICAL_KEYWORDS = [
    '习近平', '习主席', '政治局', '中纪委', '六四', '天安门', '法轮功',
    '台独', '藏独', '疆独', '港独', '达赖', '热比娅',
    '上访', '信访', '维权', '抗议', '示威', '罢工',
]

# 色情/暴力（用组合词替代双字裸词，避免"暴力破解""恐怖分子"等正常教育内容被误伤）
NSFW_KEYWORDS = [
    '色情', ' porn', '裸体', '裸照', 'av ', '做爱', '性交',
    '杀人', '自杀', '炸弹', '枪击', '爆炸物',
    '暴力视频', '暴力袭击', '恐怖袭击', '恐怖主义', '极端恐怖',
]

# 教育/技术语境中的正常表达，命中这些上下文时视为合法（优先级高于敏感词）
SAFE_CONTEXT_PATTERNS = [
    r'暴力破解',
    r'网络暴力',
    r'家庭暴力',
    r'校园暴力',
    r'恐怖分子',
    r'反恐',
    r'暴力求解',
    r'暴力匹配',
    r'暴力法',
    r'恐怖片',
    r'恐吓?行为',
]

# 考试作弊/论文代写（教育场景特殊关注）
ACADEMIC_MISCONDUCT = [
    '代考', '替考', '代写', '代做', '论文代写', '作业代写',
    '考试答案', '作弊器', '泄题', '买答案', '卖答案',
    '代上课', '刷课', '代刷', '破解版', '盗版',
]

# 赌博/毒品/诈骗
ILLEGAL_KEYWORDS = [
    '赌博', '赌场', '赌球', '六合彩', '彩票预测',
    '毒品', '吸毒', '大麻', '冰毒', '海洛因',
    '诈骗', '传销', '洗钱', '高利贷', '网贷',
]

ALL_SENSITIVE = POLITICAL_KEYWORDS + NSFW_KEYWORDS + ACADEMIC_MISCONDUCT + ILLEGAL_KEYWORDS


def _check_sensitive(text: str) -> dict:
    """Layer 1: 敏感词检测（带上下文白名单，避免误伤正常教育内容）"""
    hits = []
    text_lower = text.lower()
    for kw in ALL_SENSITIVE:
        if kw.lower() in text_lower:
            hits.append(kw)
    if hits:
        # 命中安全上下文（如"暴力破解""恐怖分子"）的词从命中中剔除
        safe_hits = []
        for h in hits:
            if h in ("暴力", "恐怖") and any(
                re.search(p, text_lower) for p in SAFE_CONTEXT_PATTERNS
            ):
                continue
            safe_hits.append(h)
        hits = safe_hits
    return {
        "passed": len(hits) == 0,
        "hits": hits,
        "detail": f"命中 {len(hits)} 个敏感词" if hits else "未命中敏感词",
    }


# ============================================================================
# Layer 2: 幻觉检测
# ============================================================================

# 不确定表述模式（不是幻觉，但需要降低置信度）
UNCERTAINTY_PATTERNS = [
    (r'据我所知', '不确定表述'),
    (r'据(说|传|称)', '不确定表述'),
    (r'可能.*大概', '双重不确定'),
    (r'(应该|也许|或许|大概|估计).*吧', '推测性表述'),
    (r'个人认为', '主观判断'),
    (r'(一般认为|普遍认为|主流观点)', '缺乏具体引用'),
]

# 绝对化断言模式（教育场景需警惕）
ABSOLUTE_PATTERNS = [
    (r'100%', '绝对化断言'),
    (r'绝对(正确|有效|不会|没有)', '绝对化断言'),
    (r'永远(不|都)', '绝对化断言'),
    (r'百分之百', '绝对化断言'),
    (r'保证.*通过', '保证性承诺（教育场景敏感）'),
    (r'包(过|会|懂|对)', '保证性承诺'),
    (r'一定(能|会|可以)', '确定性与教育场景不符'),
]

# 虚假引用模式
FAKE_REFERENCE_PATTERNS = [
    (r'\[\d+\]', '学术引用标记（应提供明确来源）'),
    (r'DOI:\s*10\.\d+/', 'DOI 引用（需确认真实性）'),
    (r'\([A-Z][a-z]+,\s*\d{4}\)', '疑似学术引用 (Author, Year)'),
]


def _check_hallucination(text: str) -> dict:
    """Layer 2: 幻觉/不确定表述检测"""
    warnings = []

    for pattern, desc in UNCERTAINTY_PATTERNS:
        if re.search(pattern, text):
            warnings.append({"pattern": pattern, "desc": desc})

    for pattern, desc in ABSOLUTE_PATTERNS:
        if re.search(pattern, text):
            warnings.append({"pattern": pattern, "desc": desc})

    for pattern, desc in FAKE_REFERENCE_PATTERNS:
        matches = re.findall(pattern, text)
        if matches:
            warnings.append({"pattern": pattern, "desc": f"{desc} ({len(matches)}处)"})

    severity = "high" if any("绝对化" in w["desc"] or "保证性" in w["desc"] for w in warnings) else "low"
    return {
        "passed": len(warnings) < 3 or severity != "high",
        "warnings": warnings,
        "severity": severity,
        "detail": f"检测到 {len(warnings)} 个可疑表述" if warnings else "未检测到幻觉信号",
    }


# ============================================================================
# Layer 3: 知识库交叉验证
# ============================================================================

def _check_kb_overlap(text: str, kb_chunks: list = None) -> dict:
    """Layer 3: 知识库关键词重叠率计算（jieba 分词 + Jaccard 相似度）

    当 RAG 系统不可用时（kb_chunks 为空），跳过此层。
    """
    if not kb_chunks:
        return {"passed": True, "overlap": 0.0, "detail": "（未提供知识库，跳过交叉验证）"}

    try:
        import jieba
        text_words = set(jieba.lcut(text))
        kb_words = set()
        for chunk in kb_chunks:
            content = chunk if isinstance(chunk, str) else chunk.get("content", "")
            kb_words.update(jieba.lcut(content))

        if not text_words or not kb_words:
            return {"passed": True, "overlap": 0.0, "detail": "分词结果为空"}

        intersection = text_words & kb_words
        union = text_words | kb_words
        overlap = len(intersection) / len(union) if union else 0.0

        return {
            "passed": overlap >= 0.05,  # 5% 关键词重叠率阈值
            "overlap": round(overlap, 3),
            "detail": f"关键词重叠率 {overlap:.1%}（{'充足' if overlap >= 0.1 else '偏低' if overlap >= 0.05 else '严重不足'}）",
        }
    except ImportError:
        # jieba 不可用时，使用简单的中文字符重叠
        text_chars = set(re.findall(r'[一-鿿]{2,}', text))
        kb_chars = set()
        for chunk in (kb_chunks or []):
            content = chunk if isinstance(chunk, str) else chunk.get("content", "")
            kb_chars.update(re.findall(r'[一-鿿]{2,}', content))

        if not text_chars or not kb_chars:
            return {"passed": True, "overlap": 0.0, "detail": "（jieba 不可用，使用字符级回退检查）"}

        intersection = text_chars & kb_chars
        union = text_chars | kb_chars
        overlap = len(intersection) / len(union) if union else 0.0
        return {
            "passed": overlap >= 0.03,
            "overlap": round(overlap, 3),
            "detail": f"字符重叠率 {overlap:.1%}（jieba 回退模式）",
        }


# ============================================================================
# Layer 4: 结构完整性
# ============================================================================

def _check_structure(text: str, content_type: str = "text") -> dict:
    """Layer 4: 结构完整性检查

    Args:
        text: 生成内容
        content_type: text / document / quiz / code
    """
    issues = []
    char_count = len(text)

    if content_type in ("document", "quiz", "doc"):
        if char_count < 200:
            issues.append(f"文档过短（{char_count}字），建议≥200字")
        # 检查是否有标题结构
        if not re.search(r'#+\s|【.*】|\*\*.*\*\*', text):
            issues.append("缺少标题或分段结构")

    if content_type == "quiz":
        # 检查题目数量
        question_count = len(re.findall(r'(?:题目|问题|Question)\s*\d+', text)) + len(re.findall(r'\d+[.、)]\s*[^\n]{10,}', text[:500]))
        if question_count < 3:
            issues.append(f"题目数量不足（检测到{question_count}题），建议≥3题")
        # 检查是否有答案
        if not re.search(r'(?:答案|解析|Answer|Solution)', text):
            issues.append("缺少答案解析")

    if content_type == "code":
        if not re.search(r'```\w*\n.*\n```', text, re.DOTALL):
            # 放宽检查：至少要有代码块或明显的代码行
            if not re.search(r'(def |class |function |import |from |const |let |var )', text):
                issues.append("代码示例中未检测到有效代码")

    # 通用检查：过短或过长
    if char_count < 50:
        issues.append("内容过短，可能不完整")
    if char_count > 12000:
        issues.append(f"内容过长（{char_count}字），建议精简")

    return {
        "passed": len(issues) <= 1,
        "issues": issues,
        "char_count": char_count,
        "detail": f"结构{'完整' if len(issues) <= 1 else '需改进'}（{char_count}字，{len(issues)}个问题）",
    }


# ============================================================================
# Layer 5: 审计日志
# ============================================================================

@dataclass
class ContentAuditResult:
    passed: bool
    score: int  # 0-100
    layers: dict = field(default_factory=dict)
    summary: str = ""
    timestamp: str = ""


def log_audit(user_id: int, agent_name: str, input_text: str,
              output_text: str, result: ContentAuditResult):
    """Layer 5: 记录审计日志到数据库"""
    try:
        from app.database import execute
        execute(
            """INSERT INTO audit_logs
               (user_id, agent_name, input_preview, output_preview, passed, score, detail, created_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
            (
                user_id,
                agent_name,
                input_text[:300] if input_text else "",
                output_text[:500] if output_text else "",
                1 if result.passed else 0,
                result.score,
                json.dumps(result.layers, ensure_ascii=False),
            )
        )
    except Exception as e:
        logger.warning(f"审计日志记录失败: {e}")


# ============================================================================
# 主过滤函数
# ============================================================================

def filter_content(
    text: str,
    user_id: int = 0,
    agent_name: str = "unknown",
    content_type: str = "text",
    kb_chunks: list = None,
    user_input: str = "",
) -> tuple[str, ContentAuditResult]:
    """
    对 Agent 生成内容进行 5 层安全审核。

    Args:
        text: Agent 原始输出
        user_id: 用户 ID（用于审计日志）
        agent_name: 调用的 Agent 名称
        content_type: 内容类型 (text/document/quiz/code)
        kb_chunks: RAG 知识库片段（Layer 3 使用，可选）
        user_input: 触发生成的用户输入（审计日志使用）

    Returns:
        (filtered_text, audit_result)
    """
    # Guard
    if not text:
        return "", ContentAuditResult(passed=True, score=100, layers={}, summary="空内容")

    layers = {}

    # L1: 敏感词
    l1 = _check_sensitive(text)
    layers["sensitive"] = l1

    # L2: 幻觉检测
    l2 = _check_hallucination(text)
    layers["hallucination"] = l2

    # L3: 知识库交叉验证
    l3 = _check_kb_overlap(text, kb_chunks)
    layers["kb_overlap"] = l3

    # L4: 结构完整性
    l4 = _check_structure(text, content_type)
    layers["structure"] = l4

    # 计算综合评分
    scores = {
        "sensitive": 100 if l1["passed"] else 0,  # 敏感词一票否决
        "hallucination": 60 if l2["passed"] else 30,
        "kb_overlap": 80 if l3["passed"] else 40,
        "structure": 80 if l4["passed"] else 40,
    }
    total_score = sum(scores.values()) // len(scores)

    # 敏感词命中 → 整体不通过
    passed = l1["passed"]

    # 构建审核结果
    warnings_list = [w["desc"] for w in l2.get("warnings", [])]
    issues_list = l4.get("issues", [])
    summary_parts = []
    if not l1["passed"]:
        summary_parts.append(f"敏感词：{', '.join(l1['hits'][:3])}")
    if warnings_list:
        summary_parts.append(f"疑似幻觉：{'、'.join(warnings_list[:3])}")
    if issues_list:
        summary_parts.append(f"结构问题：{'、'.join(issues_list[:2])}")

    result = ContentAuditResult(
        passed=passed,
        score=total_score,
        layers=layers,
        summary="；".join(summary_parts) if summary_parts else "内容安全审核通过",
        timestamp=str(int(time.time())),
    )

    # L5: 记录审计日志（静默失败不影响主流程）
    if user_id:
        try:
            log_audit(user_id, agent_name, user_input, text, result)
        except Exception:
            pass

    # 如果敏感词命中，对文本做脱敏处理
    filtered_text = text
    if not l1["passed"]:
        for kw in l1["hits"]:
            filtered_text = filtered_text.replace(kw, '*' * len(kw))
        filtered_text = (
            "> ⚠️ **内容安全提示**: 以下内容经过安全审核，部分敏感词已脱敏处理。\n\n"
            + filtered_text
        )

    # 如果幻觉信号较多，追加提示
    if l2["severity"] == "high":
        filtered_text += (
            "\n\n> 💡 *以上部分内容可能包含不确定信息，建议核实后参考。*"
        )

    return filtered_text, result


# ============================================================================
# Prompt 注入工具
# ============================================================================

ANTI_HALLUCINATION_CLAUSE = """
【防幻觉与内容安全规则 —— 必须严格遵守】
1. 只陈述你确知的内容，不确定的信息必须明确标注"不确定"或"据推测"
2. 不得编造论文标题、书籍名称、URL、统计数据或任何人名
3. 推荐资源时，如果是真实存在的资源请标注来源，否则标注"示例"或"参考方向"
4. 涉及学术概念时必须严谨，混淆不清的概念要主动说明区别
5. 不得生成任何违反中国法律法规的内容
6. 不得对敏感政治话题发表观点
7. 如果学生提问超出课程范围且你无法确认，直接说"这个问题超出了我的知识范围"
8. 代码示例必须可运行（或标注"伪代码"），不得包含安全漏洞"""

ANTI_HALLUCINATION_SHORT = """
【防幻觉规则】不确定的信息标注"供参考"；不编造人名、书名、URL、数据；代码确保可运行"""


def inject_safety_prompt(system_prompt: str, short: bool = False) -> str:
    """向 Agent 系统提示词注入防幻觉规则"""
    clause = ANTI_HALLUCINATION_SHORT if short else ANTI_HALLUCINATION_CLAUSE
    return system_prompt + "\n" + clause
