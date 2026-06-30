"""
签数据格式深度清理脚本
策略：对含年份引用的句子，整句移除而非碎片删除，保证语义连贯
同时移除过于"预测性"的语句（求财大旺、婚姻美满等）
保留有文化解读价值的语句

可通过命令行参数或环境变量指定路径：
  python extract_qian.py <input_md_file> [output_js_file]
  环境变量: ICHING_QIAN_INPUT, ICHING_OUTPUT_DIR
"""
import re
import os
import sys

# 优先使用命令行参数，其次环境变量
if len(sys.argv) >= 2:
    INPUT_FILE = sys.argv[1]
else:
    INPUT_FILE = os.environ.get("ICHING_QIAN_INPUT", "")

if len(sys.argv) >= 3:
    OUTPUT_FILE = sys.argv[2]
else:
    output_dir = os.environ.get("ICHING_OUTPUT_DIR", os.path.dirname(__file__))
    OUTPUT_FILE = os.path.join(output_dir, "js", "data", "qianData.js")

if not INPUT_FILE or not os.path.isfile(INPUT_FILE):
    print(f"错误：找不到签诗源文件 '{INPUT_FILE}'")
    print("用法: python extract_qian.py <input_md_file> [output_js_file]")
    print("或设置环境变量 ICHING_QIAN_INPUT")
    sys.exit(1)

with open(INPUT_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

qian_list = []

# 需要整句移除的关键词（年份引用+过于占卜化的表述）
REMOVE_SENTENCE_KEYWORDS = [
    '2026', '丙午', '火马', '火气', '火旺', '火过旺', '金旺',
    '上半年', '下半年', '秋季', '年底', '今年',
    '求财大旺', '求财利', '求财无', '求财有', '求财多', '求财中', '求财平',
    '婚姻美满', '婚姻合', '婚姻不合', '婚姻阻', '婚姻成', '婚姻好',
    '病者得愈', '六甲', '家宅', '自身', '交易', '寻人', '行人', '移徙',
    '公讼', '失物', '运势', '大运', '财利', '财务危机',
    '高回报投资', '异性缘', '社交场合',
]

def clean_explanation(text):
    """移除含特定关键词的整句，保持剩余语句连贯"""
    # Split by sentence boundaries (。；)
    # Keep the punctuation attached to each sentence
    parts = re.findall(r'[^。；]+[。；]?|[^。；]+$', text)
    
    cleaned = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Check if this sentence should be removed
        should_remove = any(kw in part for kw in REMOVE_SENTENCE_KEYWORDS)
        if not should_remove:
            cleaned.append(part)
    
    result = ''.join(cleaned)
    # Clean trailing/leading punctuation issues
    result = re.sub(r'^[。；\s]+', '', result)
    result = re.sub(r'[。；]{2,}', '。', result)
    # Ensure ends with punctuation
    if result and not result.endswith(('。', '；', '！', '？')):
        result += '。'
    return result.strip()

sections = re.split(r'##\s*第(\d+)签[：:]', content)

i = 1
while i < len(sections) - 1:
    id_num = int(sections[i])
    body = sections[i + 1]

    header_match = re.match(r'\s*(.+?)\s*[（(\s]\s*([\u4e00-\u9fff]+)\s*[）)\s]', body)
    sign_name = header_match.group(1).strip() if header_match else ""
    level_raw = header_match.group(2).strip() if header_match else ""

    level_map = {"上签": "上上", "上上签": "上上", "中签": "中平", "中平签": "中平", "下签": "下下", "下下签": "下下"}
    level = level_map.get(level_raw, level_raw)

    poem_match = re.search(r'诗曰[：:]\s*(.+?)(?:\n\n|\n(?:此|此卦|此签|苏秦|此乃))', body, re.DOTALL)
    poem = poem_match.group(1).strip() if poem_match else ""
    poem = re.sub(r'^诗曰[：:]\s*', '', poem)

    explain_match = re.search(r'诗曰[：:][^\n]+\n+(.+?)(?:\n\n\*\*|\n---|\n##)', body, re.DOTALL)
    explanation = ""
    if explain_match:
        raw_explain = explain_match.group(1).strip()
        lines = raw_explain.split('\n')
        clean_lines = []
        for line in lines:
            if re.match(r'\*\*[\u4e00-\u9fff]+\*\*[：:]', line):
                continue
            clean_lines.append(line)
        explanation = '\n'.join(clean_lines).strip()
        explanation = clean_explanation(explanation)

    qian_list.append({
        "id": id_num,
        "name": sign_name,
        "level": level,
        "poem": poem,
        "explanation": explanation,
    })
    i += 2

qian_list.sort(key=lambda x: x["id"])

print(f"Extracted {len(qian_list)} signs")

# 生成JS
js_lines = [
    '// 观音灵签100签数据',
    '// 来源：古籍民间文学，无版权问题',
    '// 年份及占卜性表述已清理，侧重文化解读',
    '',
    'const qianList = ['
]

for q in qian_list:
    poem_esc = q['poem'].replace('\\', '\\\\').replace('"', '\\"')
    explain_esc = q['explanation'].replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    name_esc = q['name'].replace('\\', '\\\\').replace('"', '\\"')
    
    js_lines.append(f'  {{')
    js_lines.append(f'    id: {q["id"]},')
    js_lines.append(f'    name: "{name_esc}",')
    js_lines.append(f'    level: "{q["level"]}",')
    js_lines.append(f'    poem: "{poem_esc}",')
    js_lines.append(f'    explanation: "{explain_esc}"')
    js_lines.append(f'  }},')

js_lines.append('];')
js_content = '\n'.join(js_lines)

with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
    f.write(js_content)

import os
print(f"Written: {os.path.getsize(OUTPUT_FILE)} bytes")

# Verify
year_count = sum(1 for q in qian_list if any(kw in q['explanation'] for kw in REMOVE_SENTENCE_KEYWORDS[:12]))
print(f"Year refs remaining: {year_count}/100")
empty_count = sum(1 for q in qian_list if not q['explanation'] or len(q['explanation']) < 5)
print(f"Empty/cleaned-out explanations: {empty_count}/100")

# Show samples
for q in qian_list[:5]:
    print(f"\n#{q['id']} {q['name']} ({q['level']})")
    print(f"  poem: {q['poem']}")
    print(f"  explanation: {q['explanation'][:100]}")
