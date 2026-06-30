"""
数据格式统一脚本 - 清理文字格式问题
1. 签诗explanation：移除年份引用(2026/丙午/火马/火气/火旺等)
2. 卦辞baihua：移除冗余"XX卦："前缀（卦名已在标题展示）
3. 卦辞text：移除卦名后多余空格 "乾。 元" → "乾。元"
4. 修复"小过卦 ："冒号前多余空格
5. 统一签诗level为简短形式
"""

import re

# ===== 1. 清理签诗数据 =====
with open('js/data/qianData.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 移除年份引用模式
year_patterns = [
    (r'2026年[^。；，]*?签[^。]*?[。；]', ''),  # "2026年逢此签..."
    (r'2026[^。；，]*?年[^。]*?[。；]', ''),     # "2026这个..."
    (r'丙午[^。]*?[。；]', ''),                   # "丙午年/丙午火旺..."
    (r'火马[^。]*?[。；]', ''),                   # "火马年..."
    (r'火气[^。]*?[。；]', ''),                   # "火气浮躁..."
    (r'火旺[^。]*?[。；]', ''),                   # "火旺..."
    (r'火过旺[^。]*?[。；]', ''),                 # "火过旺..."
    (r'上半年[^。]*?[。；]', ''),                  # "上半年压力极大..."
    (r'下半年[^。]*?[。；]', ''),                  # "下半年..."
    (r'秋季[^。]*?[。；]', ''),                    # "秋季金旺..."
    (r'金旺[^。]*?[。；]', ''),                    # "金旺克制..."
    (r'年底[^。]*?[。；]', ''),                    # "年底定有..."
    (r'今年[^。]*?[。；]', ''),                    # "今年可补..."
    (r'五十以后[^。]*?[。；]', ''),                # time-specific
    (r'2026', ''),                                 # bare year references
]

# Apply year removal - but we need to be careful not to break sentence structure
# Strategy: replace whole clauses containing year refs with empty, then clean up resulting gaps

# Better approach: process the content as structured data
import json

# Parse the JS file to extract the array
# Find the array content between [ and ]
arr_start = content.index('[')
arr_end = content.rindex(']')
arr_text = content[arr_start:arr_end+1]

# Since this is JS not JSON, we need a different approach
# Use regex to find each object and clean it

def clean_explanation(text):
    """Remove year-specific references from explanation text"""
    # Remove clauses containing year keywords
    # Pattern: find sentences/clauses with year refs and remove them
    
    # First, split into sentences
    sentences = re.split(r'[。；]', text)
    cleaned = []
    year_keywords = ['2026', '丙午', '火马', '火气', '火旺', '金旺', '上半年', '下半年', '秋季', '年底', '今年']
    
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # Check if sentence contains year keywords
        has_year = any(kw in s for kw in year_keywords)
        if has_year:
            # Try to extract the non-year part
            # Remove year-specific phrases
            s = re.sub(r'2026年[^，]*?', '', s)
            s = re.sub(r'2026[^，]*?年[^，]*?', '', s)
            s = re.sub(r'2026[^，]*?', '', s)
            s = re.sub(r'丙午[^，]*?(年|火)[^，]*?', '', s)
            s = re.sub(r'火马[^，]*?年[^，]*?', '', s)
            s = re.sub(r'火气[^，]*?', '', s)
            s = re.sub(r'火旺[^，]*?', '', s)
            s = re.sub(r'火过旺[^，]*?', '', s)
            s = re.sub(r'金旺[^，]*?', '', s)
            s = re.sub(r'上半年[^，]*?', '', s)
            s = re.sub(r'下半年[^，]*?', '', s)
            s = re.sub(r'秋季[^，]*?', '', s)
            s = re.sub(r'年底[^，]*?', '', s)
            s = re.sub(r'今年[^，]*?', '', s)
            s = s.strip()
        # Keep sentence if it still has meaningful content after cleaning
        if s and len(s) > 2:
            cleaned.append(s)
    
    result = '。'.join(cleaned)
    if result and not result.endswith('。'):
        result += '。'
    # Clean up double punctuation
    result = re.sub(r'。。+', '。', result)
    result = re.sub(r'，。', '。', result)
    result = re.sub(r'^。', '', result)
    return result

# Process each qian entry
# Find all explanation fields and clean them
def process_qian_data(content):
    """Process qianData.js content to clean explanations"""
    # Match explanation field values
    # Pattern: explanation: "..."
    # We need to find each explanation value and clean it
    
    result = content
    
    # Find all explanation: "..." patterns
    pattern = r'explanation: "(.*?)"'
    
    def replace_explanation(match):
        original = match.group(1)
        cleaned = clean_explanation(original)
        return f'explanation: "{cleaned}"'
    
    result = re.sub(pattern, replace_explanation, result, flags=re.DOTALL)
    
    # Also handle multiline explanations (with \n)
    # Pattern: explanation: "...\n..."
    # Already handled by re.DOTALL
    
    return result

cleaned_qian = process_qian_data(content)

with open('js/data/qianData.js', 'w', encoding='utf-8') as f:
    f.write(cleaned_qian)

print("qianData cleaned - year references removed from explanations")

# ===== 2. 清理卦象数据 =====
with open('js/data/gua64Data.js', 'r', encoding='utf-8') as f:
    content = f.read()

def clean_baihua_prefix(text):
    """Remove redundant 'XX卦：' prefix from baihua"""
    # Pattern: "乾卦：xxx" -> "xxx" (since 卦名 is already in the title)
    # Also handle "屯卦。xxx" pattern
    text = re.sub(r'^[^\s]{1,5}卦[：。]', '', text)
    text = re.sub(r'^小过卦 ：', '', text)  # fix extra space
    text = text.strip()
    return text

def clean_text_spacing(text):
    """Remove extra space after 卦名。 in text field"""
    # Pattern: "乾。 元，" -> "乾。元，"
    text = re.sub(r'^[^\s]{1,3}。\s+', lambda m: m.group(0).replace(' ', ''), text)
    return text

# Process baihua fields
# Find baihua: "..." patterns and strip prefix
def process_gua_data(content):
    result = content
    
    # Clean baihua prefixes - both gua-level and yao-level
    # Gua-level: baihua: "XX卦：..."
    pattern = r'baihua: "([^"]*?)"'
    
    def replace_baihua(match):
        original = match.group(1)
        cleaned = clean_baihua_prefix(original)
        return f'baihua: "{cleaned}"'
    
    result = re.sub(pattern, replace_baihua, result)
    
    # Also clean baihua in yaoci objects
    # These use "position": "初九", "baihua": "初九：xxx" pattern
    # Remove "初九：" prefix since position is already shown
    # Actually, yao-level baihua starts with "XX：" where XX is the position name
    # This is also redundant since we show the position already
    # Pattern in yaoci: "baihua": "初九：潜藏的龙..."
    
    # But these are inside JSON-like strings embedded in JS, harder to regex
    # Let's use a simpler approach: just process the whole content
    
    # Yao-level baihua pattern: "baihua": "初九：..." or "九二：..." etc
    yao_positions = ['初九', '初六', '九二', '六二', '九三', '六三', '九四', '六四', '九五', '六五', '上九', '上六']
    for pos in yao_positions:
        result = result.replace(f'"baihua": "{pos}：', '"baihua": "')
        result = result.replace(f'"baihua": "{pos}。', '"baihua": "')
    
    # Fix "小过卦 ：" (extra space before colon)
    result = result.replace('小过卦 ：', '小过卦：')
    
    # Clean text field spacing: "乾。 元" -> "乾。元"
    # Find text: "XX。 xxx" patterns and remove the space
    def replace_text_spacing(match):
        original = match.group(1)
        cleaned = clean_text_spacing(original)
        return f'text: "{cleaned}"'
    
    pattern = r'text: "([^"]*?)"'
    result = re.sub(pattern, replace_text_spacing, result)
    
    return result

cleaned_gua = process_gua_data(content)

with open('js/data/gua64Data.js', 'w', encoding='utf-8') as f:
    f.write(cleaned_gua)

print("gua64Data cleaned - baihua prefixes removed, text spacing fixed")

# ===== Verification =====
print("\n=== Verification ===")
