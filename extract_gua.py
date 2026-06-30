"""从 OB/Clippings 目录提取64卦核心数据，生成 gua64Data.js
新增字段：白话文解释、断易天机解、邵雍解、传统解卦（卦辞级别）
以及每爻的白话文解释、邵雍解（爻辞级别）

可通过命令行参数或环境变量指定路径：
  python extract_gua.py <clippings_dir> [output_file]
  环境变量: ICHING_CLIPPINGS_DIR, ICHING_OUTPUT_DIR
"""
import os
import sys
import re
import json

# 优先使用命令行参数，其次环境变量，最后回退到默认路径
if len(sys.argv) >= 2:
    CLIPPINGS_DIR = sys.argv[1]
else:
    CLIPPINGS_DIR = os.environ.get("ICHING_CLIPPINGS_DIR", "")

if len(sys.argv) >= 3:
    OUTPUT_FILE = sys.argv[2]
else:
    output_dir = os.environ.get("ICHING_OUTPUT_DIR", os.path.dirname(__file__))
    OUTPUT_FILE = os.path.join(output_dir, "js", "data", "gua64Data.js")

if not CLIPPINGS_DIR or not os.path.isdir(CLIPPINGS_DIR):
    print(f"错误：找不到 Clippings 目录 '{CLIPPINGS_DIR}'")
    print("用法: python extract_gua.py <clippings_dir> [output_file]")
    print("或设置环境变量 ICHING_CLIPPINGS_DIR")
    sys.exit(1)

BAGUA_SYMBOL = {
    "乾": "☰", "坤": "☷", "震": "☳", "艮": "☶",
    "离": "☲", "坎": "☵", "兑": "☱", "巽": "☴"
}

gua_list = []

def extract_section(content, start_marker, end_markers):
    """从content中提取start_marker到第一个end_markers之间的文本"""
    start_idx = content.find(start_marker)
    if start_idx == -1:
        return ""
    start_idx += len(start_marker)
    
    end_idx = len(content)
    for marker in end_markers:
        idx = content.find(marker, start_idx)
        if idx != -1 and idx < end_idx:
            end_idx = idx
    
    section = content[start_idx:end_idx].strip()
    # 清理：去掉markdown加粗标记和多余空行
    section = re.sub(r'\*\*', '', section)
    section = re.sub(r'\n{3,}', '\n\n', section)
    # 去掉图片链接
    section = re.sub(r'!\[.*?\]\(.*?\)', '', section)
    # 去掉超链接，保留文字
    section = re.sub(r'\[([^\]]+)\]\(.*?\)', r'\1', section)
    section = section.strip()
    return section

def escape_js_string(s):
    """将字符串转义为安全的JS字符串字面量"""
    s = s.replace('\\', '\\\\')
    s = s.replace('"', '\\"')
    s = s.replace('\n', '\\n')
    s = s.replace('\r', '')
    s = s.replace('\t', '\\t')
    return s

for filename in os.listdir(CLIPPINGS_DIR):
    if not filename.endswith(".md"):
        continue
    filepath = os.path.join(CLIPPINGS_DIR, filename)

    id_match = re.search(r'第(\d+)卦', filename)
    if not id_match:
        print(f"SKIP (no id): {filename}")
        continue
    id_num = int(id_match.group(1))

    # 提取上下卦
    upper_lower_matches = re.findall(r'([\u4e00-\u9fff])上([\u4e00-\u9fff])下', filename)
    if not upper_lower_matches:
        print(f"SKIP (no upper/lower): {filename}")
        continue
    upper = upper_lower_matches[0][0]
    lower = upper_lower_matches[0][1]

    # 提取卦名
    name_match = re.search(r'卦[_\s]*([\u4e00-\u9fff]+?)[（\(]([\u4e00-\u9fff]+?)[）\)]', filename)
    if name_match:
        short_name = name_match.group(1)
        full_name = name_match.group(2)
    else:
        short_name = ""
        full_name = ""

    # 读取文件内容
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 如果文件名没提取到卦名，从内容提取
    if not full_name:
        title_match = re.search(r'周易第\d+卦[\\_]+(.+?)[（\(]([\u4e00-\u9fff]+)[）\)]', content)
        if title_match:
            short_name = title_match.group(1).replace('\\', '').replace('_', '')
            full_name = title_match.group(2)
        else:
            title_line = content.split('\n')[0] if content else ""
            name_from_title = re.search(r'([\u4e00-\u9fff]{2,6})[（\(]([\u4e00-\u9fff]{2,8})[）\)]', title_line)
            if name_from_title:
                short_name = name_from_title.group(1)
                full_name = name_from_title.group(2)

    # 提取卦辞原文
    text_match = re.search(
        r'\*\*[\u4e00-\u9fff]+?\。\*\*\s*(.+?)\n\n象曰',
        content, re.DOTALL
    )
    if text_match:
        gua_text = re.sub(r'\*\*', '', text_match.group(0)).strip()
        gua_text = re.sub(r'\n象曰.*', '', gua_text).strip()
    else:
        text_match2 = re.search(
            r'原文\*\*\n\n\*\*[\u4e00-\u9fff]+?\。\*\*\s*(.+?)\n\n\*\*白话文解释',
            content, re.DOTALL
        )
        if text_match2:
            gua_text = re.sub(r'\*\*', '', text_match2.group(1)).strip()
        else:
            gua_text = ""

    # 提取象传
    xiang_match = re.search(r'象曰：([\u4e00-\u9fff，。；：！？\s]+?)。', content)
    xiang_text = xiang_match.group(1).strip() + "。" if xiang_match else ""

    # === 新增字段：卦辞级别的4个解读 ===
    
    # 白话文解释（卦辞级别）
    baihua = extract_section(content, "**白话文解释**", 
        ["**《断易天机》解**", "**北宋易学家邵雍解**", "## 周易第"])
    
    # 《断易天机》解
    duanyi = extract_section(content, "**《断易天机》解**",
        ["**北宋易学家邵雍解**", "**台湾国学大儒傅佩荣解**", "## 周易第"])
    
    # 北宋易学家邵雍解（卦辞级别）
    shaoyong_gua = extract_section(content, "**北宋易学家邵雍解**",
        ["**台湾国学大儒傅佩荣解**", "**传统解卦**", "**台湾张铭仁解卦**", "## 周易第"])
    
    # 传统解卦
    chuantong = extract_section(content, "**传统解卦**",
        ["**台湾张铭仁解卦**", "**大象：**", "**大象**", "## 周易第"])

    # === 提取六爻爻辞（含新增的白话+邵雍） ===
    yaoci = []
    
    # 先把内容按爻辞段落拆分
    # 每爻段落从 "## 周易第X卦[初上六九]爻详解" 开始
    yao_section_pattern = r'## 周易第\d+卦([初上][六九]|[六九][二三四五])爻详解'
    yao_split = re.split(yao_section_pattern, content)
    
    # yao_split[0] 是卦辞部分，之后每两段一组：[position, section_text]
    i = 1
    while i < len(yao_split) - 1:
        pos = yao_split[i]
        section = yao_split[i + 1]
        i += 2
        
        # 提取爻辞原文
        yao_text_match = re.search(
            r'\*\*' + pos + r'\。\*\*\s*([\u4e00-\u9fff，。；：！？\s]+?)\n+象曰',
            section
        )
        if yao_text_match:
            yao_text = yao_text_match.group(1).strip()
        else:
            yao_text_match2 = re.search(
                r'\*\*' + pos + r'\。\*\*\s*([\u4e00-\u9fff，。]+)',
                section
            )
            yao_text = yao_text_match2.group(1).strip() if yao_text_match2 else ""
        
        # 提取象曰
        xiang_yao_match = re.search(r'象曰：([\u4e00-\u9fff，。；：！？\s]+?)。', section)
        yao_xiang = xiang_yao_match.group(1).strip() + "。" if xiang_yao_match else ""
        
        # 提取爻辞白话文解释
        yao_baihua = extract_section(section, "**白话文解释**",
            ["**北宋易学家邵雍解**", "**台湾国学大儒傅佩荣解**", "**变卦**", "**初[六九]变卦**",
             "**九[二三四五]变卦**", "**六[二三四五]变卦**", "**上[六九]变卦**"])
        
        # 提取爻辞邵雍解
        yao_shaoyong = extract_section(section, "**北宋易学家邵雍解**",
            ["**台湾国学大儒傅佩荣解**", "**变卦**", "**初[六九]变卦**",
             "**九[二三四五]变卦**", "**六[二三四五]变卦**", "**上[六九]变卦**"])
        
        yaoci.append({
            "position": pos.strip(),
            "text": yao_text,
            "xiang": yao_xiang,
            "baihua": yao_baihua,
            "shaoyong": yao_shaoyong
        })

    # 回退：如果上面没提取到爻辞，用旧方法
    if not yaoci:
        yao_sections = re.findall(
            r'\*\*([初上][六九]|[六九][二三四五])\。\*\*\s*([\u4e00-\u9fff，。；：！？\s]+?)\n+象曰：([\u4e00-\u9fff，。；：！？\s]+?)。',
            content
        )
        if yao_sections:
            for pos_text, yao_text, yao_xiang in yao_sections:
                yaoci.append({
                    "position": pos_text.strip(),
                    "text": yao_text.strip(),
                    "xiang": yao_xiang.strip() + "。",
                    "baihua": "",
                    "shaoyong": ""
                })
        else:
            all_yao = re.findall(
                r'\*\*([初上][六九]|[六九][二三四五])\。\*\*\s*([\u4e00-\u9fff，。]+?)',
                content
            )
            for pos_text, yao_text in all_yao:
                yaoci.append({
                    "position": pos_text.strip(),
                    "text": yao_text.strip(),
                    "xiang": "",
                    "baihua": "",
                    "shaoyong": ""
                })

    symbol_upper = BAGUA_SYMBOL.get(upper, "")
    symbol_lower = BAGUA_SYMBOL.get(lower, "")
    symbol_display = symbol_lower + "\\n" + symbol_upper

    gua_entry = {
        "id": id_num,
        "name": full_name,
        "shortName": short_name,
        "upper": upper,
        "lower": lower,
        "symbol": symbol_display,
        "text": gua_text,
        "xiangZhuan": xiang_text,
        "baihua": baihua,
        "duanyi": duanyi,
        "shaoyong": shaoyong_gua,
        "chuantong": chuantong,
        "yaoci": yaoci
    }

    gua_list.append(gua_entry)

gua_list.sort(key=lambda x: x["id"])

print(f"Extracted {len(gua_list)} gua entries")
for g in gua_list[:3]:
    print(f"  #{g['id']}: {g['name']} ({g['upper']}上{g['lower']}下) - {len(g['yaoci'])} yaoci")
    print(f"    text: {g['text'][:50]}")
    print(f"    xiang: {g['xiangZhuan'][:50]}")
    print(f"    baihua: {g['baihua'][:50]}...")
    print(f"    duanyi: {g['duanyi'][:50]}...")
    print(f"    shaoyong: {g['shaoyong'][:50]}...")
    print(f"    chuantong: {g['chuantong'][:50]}...")
    if g['yaoci']:
        y = g['yaoci'][0]
        print(f"    yao[0] baihua: {y['baihua'][:40]}...")
        print(f"    yao[0] shaoyong: {y['shaoyong'][:40]}...")

if len(gua_list) < 64:
    missing = [i for i in range(1, 65) if i not in [g['id'] for g in gua_list]]
    print(f"\nMISSING ids: {missing}")

# 生成JS文件 - 使用JSON序列化确保字符串安全
js_lines = []
for g in gua_list:
    # 对每个字段做JS字符串转义
    entry = f"""  {{
    id: {g['id']},
    name: "{escape_js_string(g['name'])}",
    shortName: "{escape_js_string(g['shortName'])}",
    upper: "{escape_js_string(g['upper'])}",
    lower: "{escape_js_string(g['lower'])}",
    symbol: "{g['symbol']}",
    text: "{escape_js_string(g['text'])}",
    xiangZhuan: "{escape_js_string(g['xiangZhuan'])}",
    baihua: "{escape_js_string(g['baihua'])}",
    duanyi: "{escape_js_string(g['duanyi'])}",
    shaoyong: "{escape_js_string(g['shaoyong'])}",
    chuantong: "{escape_js_string(g['chuantong'])}",
    yaoci: {json.dumps(g['yaoci'], ensure_ascii=False)}
  }}"""
    js_lines.append(entry)

js_content = "// 64卦核心数据 - 古籍原文+白话/断易天机/邵雍/传统解卦\n// 来源：周易原文及传统解读，无版权问题\n\nconst gua64List = [\n" + ",\n".join(js_lines) + "\n];\n"

with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js_content)

print(f"\nWritten to {OUTPUT_FILE}")
print(f"File size: {os.path.getsize(OUTPUT_FILE)} bytes")
