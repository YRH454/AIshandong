"""
垃圾输入检测器 — 代码层粗筛（参考 a3-learning-platform 的 7 种检测类型）

从 profile_agent 迁移出来，独立为公共模块。所有用户输入经过此检测器预筛。
检测维度（7种）:
  1. pure_garbage       — 纯数字/符号，无中文
  2. keyboard_mash_short — 2-8 纯字母键盘乱敲
  3. keyboard_mash_long  — >8 纯字母，无英语单词，元音比异常
  4. high_entropy        — >20 字符无中文，无英语单词，高熵值
  5. keyboard_walk       — 键盘同行连续按键（≥5键）
  6. mixed_garbage       — 中文比例<50%且含大量符号/乱码
  7. repeat              — 与上一轮完全相同的输入
"""
import re
import math

# ============================================================================
# 键盘布局常量
# ============================================================================
_KEYBOARD_ROWS = [
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
    '1234567890',
]

_KEYBOARD_MASH_SHORT = {
    'asdf', 'qwer', 'zxcv', 'qwerty', 'asdfg', 'aaaa', 'bbbb',
    'abc', 'xyz', 'qaz', 'wsx', 'edc', 'rfv', 'tgb',
    'yhn', 'ujm', 'ik', 'ol', 'p', 'qwe', 'wer', 'ert', 'rty',
    'tyu', 'yui', 'uio', 'iop', 'sdf', 'dfg', 'fgh', 'ghj',
    'hjk', 'jkl', 'xcv', 'cvb', 'vbn', 'bnm',
    'test', 'aaa', 'bbb', 'ccc', 'xxx', '111', '222', '333', '666', '888', '999',
}

_COMMON_ENGLISH_WORDS = {
    'a', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'i', 'if',
    'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to',
    'up', 'us', 'we', 'the', 'and', 'for', 'are', 'but', 'not', 'you',
    'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have',
    'from', 'this', 'that', 'with', 'they', 'will', 'what', 'when', 'your',
    'learn', 'study', 'code', 'need', 'know', 'like', 'just', 'want',
    'think', 'course', 'python', 'data', 'help', 'time', 'good', 'work',
    'make', 'well', 'more', 'some', 'than', 'then', 'them', 'into',
    'also', 'very', 'much', 'such', 'only', 'over', 'back', 'after',
    'should', 'would', 'could', 'about', 'there', 'their', 'which',
    'how', 'why', 'get', 'see', 'use', 'put', 'say', 'try', 'ask',
    'new', 'any', 'too', 'way', 'may', 'own', 'run', 'did', 'let',
    'set', 'big', 'far', 'lot', 'old', 'yet', 'each', 'every', 'find',
    'give', 'keep', 'look', 'mean', 'move', 'part', 'same', 'show',
    'still', 'take', 'tell', 'turn', 'high', 'long', 'last', 'next',
    'life', 'live', 'love', 'made', 'many', 'must', 'name', 'once',
    'open', 'play', 'read', 'real', 'rest', 'said', 'seem', 'side',
    'stop', 'sure', 'true', 'used', 'wait', 'walk', 'year', 'case',
    'form', 'line', 'hand', 'head', 'home', 'body', 'city', 'page',
    'plan', 'rate', 'room', 'step', 'test', 'type', 'unit', 'view',
}

REASON_LABELS = {
    'pure_garbage': '纯数字/符号输入',
    'keyboard_mash_short': '疑似键盘乱敲',
    'keyboard_mash_long': '无意义字母串',
    'high_entropy': '高随机性乱码',
    'keyboard_walk': '键盘连续按键',
    'mixed_garbage': '中文混杂大量乱码/符号',
    'repeat': '与上次输入完全相同',
    'empty': '空输入',
    'too_short': '内容过短',
}


# ============================================================================
# 辅助检测函数
# ============================================================================
def _char_entropy(text: str) -> float:
    if not text: return 0.0
    freq = {}
    for c in text: freq[c] = freq.get(c, 0) + 1
    n = len(text)
    return -sum((v/n) * math.log2(v/n) for v in freq.values())


def _vowel_ratio(text: str) -> float:
    alpha = [c for c in text.lower() if c.isalpha()]
    if not alpha: return 0.0
    vowels = sum(1 for c in alpha if c in 'aeiou')
    return vowels / len(alpha)


def _has_english_words(text: str) -> bool:
    tokens = set(re.findall(r'[a-zA-Z]+', text.lower()))
    found = sum(1 for w in _COMMON_ENGLISH_WORDS if w in tokens)
    return found >= 2


def _has_coherent_chinese(text: str) -> bool:
    return bool(re.search(r'[一-鿿]{2,}', text))


def _chinese_ratio(text: str) -> float:
    if not text: return 0.0
    chinese = len(re.findall(r'[一-鿿]', text))
    return chinese / len(text)


def _has_keyboard_walk(text: str, min_len: int = 5) -> bool:
    lower = text.lower()
    for row in _KEYBOARD_ROWS:
        for i in range(len(row) - min_len + 1):
            seg = row[i:i + min_len]
            if seg in lower or seg[::-1] in lower:
                return True
    return False


# ============================================================================
# 主检测函数
# ============================================================================
def detect_garbage_input(text: str, prev_text: str = "") -> dict:
    """检测用户输入是否为垃圾/乱敲。返回 {"suspicious": bool, "reason": str}"""
    if not text or not text.strip():
        return {"suspicious": True, "reason": "空输入"}

    clean = text.strip()
    has_chinese = bool(re.search(r'[一-鿿]', clean))
    alpha_only = bool(re.match(r'^[a-zA-Z]+$', clean))

    # 1: 纯数字/符号
    if re.match(r'^[\d\W_]+$', clean) and not has_chinese:
        return {"suspicious": True, "reason": REASON_LABELS['pure_garbage']}

    # 2: 短键盘乱敲（2-8 纯字母）
    if alpha_only and 2 <= len(clean) <= 8:
        if clean.lower() in _KEYBOARD_MASH_SHORT:
            return {"suspicious": True, "reason": REASON_LABELS['keyboard_mash_short']}

    # 3: 长键盘乱敲（>8 纯字母，无英语单词）
    if alpha_only and len(clean) > 8:
        if not _has_english_words(clean):
            vr = _vowel_ratio(clean)
            if vr < 0.15 or vr > 0.65:
                return {"suspicious": True, "reason": REASON_LABELS['keyboard_mash_long']}
            entropy = _char_entropy(clean)
            if entropy > 4.3:
                return {"suspicious": True, "reason": REASON_LABELS['keyboard_mash_long']}
            if len(clean) > 15:
                return {"suspicious": True, "reason": REASON_LABELS['keyboard_mash_long']}

    # 4: 高熵长文本
    if len(clean) > 20 and not has_chinese:
        if not _has_english_words(clean):
            if _char_entropy(clean) > 3.8:
                return {"suspicious": True, "reason": REASON_LABELS['high_entropy']}

    # 5: 键盘漫步
    if len(clean) >= 5 and _has_keyboard_walk(clean):
        return {"suspicious": True, "reason": REASON_LABELS['keyboard_walk']}

    # 6: 中文混乱码
    if has_chinese:
        cr = _chinese_ratio(clean)
        if cr < 0.2 and len(clean) > 10:
            return {"suspicious": True, "reason": REASON_LABELS['mixed_garbage']}
        if cr < 0.5 and len(clean) > 10:
            unusual = len(re.findall(r'[^\x00-\x7f一-鿿＀-￯　-〿]', clean))
            if unusual >= 3:
                return {"suspicious": True, "reason": REASON_LABELS['mixed_garbage']}

    # 7: 重复上一轮
    if prev_text and clean == prev_text.strip():
        return {"suspicious": True, "reason": REASON_LABELS['repeat']}

    # 8: 极短输入（<2 个有意义的字）
    meaningful = re.sub(r'[\s\d\W]', '', clean)
    if len(meaningful) < 2 and len(clean) < 8:
        return {"suspicious": True, "reason": REASON_LABELS['too_short']}

    return {"suspicious": False, "reason": ""}
