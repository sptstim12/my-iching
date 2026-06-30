/**
 * 大衍筮法核心算法
 * 基于《系辞》"大衍之数五十，其用四十有九"
 * 三变成一爻，六爻成一卦
 */

// 八卦名称映射（三爻组合 → 八卦名）
const BAGUA_MAP = {
  '111': '乾', '000': '坤',
  '001': '震', '100': '艮',
  '101': '离', '010': '坎',
  '011': '兑', '110': '巽'
};

// 爻值 → 阴阳判定
// 6=老阴(变爻), 7=少阳, 8=少阴, 9=老阳(变爻)
function yaoToYinYang(yao) {
  if (yao === 7 || yao === 9) return 1; // 阳
  if (yao === 6 || yao === 8) return 0; // 阴
  return -1; // 异常值
}

// 爻值 → 是否为动爻
function isDongYao(yao) {
  return yao === 6 || yao === 9;
}

// 变爻转换：6变阳(1), 9变阴(0)
function yaoTransform(yao) {
  if (yao === 6) return 1; // 老阴变阳
  if (yao === 9) return 0; // 老阳变阴
  return yaoToYinYang(yao); // 7/8不变
}

/**
 * 三变得一爻
 * 大衍筮法：分二→挂一→揲四→归奇，三遍后得6/7/8/9
 *
 * 数学原理：
 * - 第一变（49根）：归奇必为5或9 → 过揲44或40
 * - 第二变（偶数根）：归奇必为4或8 → 过揲40/36/32
 * - 第三变（偶数根）：归奇必为4或8 → 过揲36/32/28/24
 * - 最终过揲÷4 = 9(老阳)/8(少阴)/7(少阳)/6(老阴)
 */
function getOneYao() {
  let remaining = 49;
  for (let round = 0; round < 3; round++) {
    // 分二：随机分成左右两组，left≥1, right≥2(挂一后还需≥1根参与揲四)
    let maxLeft = remaining - 2;
    let left = Math.floor(Math.random() * maxLeft) + 1;
    let right = remaining - left;

    // 挂一：从右手取1根（不计入揲四）
    right -= 1;

    // 揲四：分别对左右两组除以4取余（余0则记为4）
    let leftRem = left % 4 === 0 ? 4 : left % 4;
    let rightRem = right % 4 === 0 ? 4 : right % 4;

    // 归奇：减去挂一(1) + 左揲余 + 右揲余
    remaining -= (1 + leftRem + rightRem);
  }
  // 过揲之数 ÷ 4 = 爻值（6/7/8/9）
  let result = remaining / 4;
  // 安全取整（理论上必为整数，加防护）
  result = Math.round(result);
  if (result < 6) result = 6;
  if (result > 9) result = 9;
  return result;
}

/**
 * 六爻成卦
 * 返回完整卦象信息
 */
function getGua() {
  let yaos = [];
  for (let i = 0; i < 6; i++) {
    yaos.push(getOneYao());
  }
  // yaos[0]=初爻(最下) ... yaos[5]=上爻(最上)

  // 计算本卦阴阳排列
  let benGuaYao = yaos.map(y => yaoToYinYang(y));

  // 计算变卦阴阳排列
  let bianGuaYao = yaos.map(y => yaoTransform(y));

  // 计算动爻列表
  let dongYaoList = [];
  yaos.forEach((y, i) => {
    if (isDongYao(y)) {
      dongYaoList.push(i); // 0=初爻, 5=上爻
    }
  });

  // 本卦：下卦(初二三) + 上卦(四五六)
  let lowerStr = benGuaYao.slice(0, 3).join('');
  let upperStr = benGuaYao.slice(3, 6).join('');
  let lowerGua = BAGUA_MAP[lowerStr];
  let upperGua = BAGUA_MAP[upperStr];

  // 变卦：下卦 + 上卦
  let bianLowerStr = bianGuaYao.slice(0, 3).join('');
  let bianUpperStr = bianGuaYao.slice(3, 6).join('');
  let bianLowerGua = BAGUA_MAP[bianLowerStr];
  let bianUpperGua = BAGUA_MAP[bianUpperStr];

  // 爻辞位置名映射
  const POS_NAMES = ['初', '二', '三', '四', '五', '上'];
  const YAO_TYPE = { 6: '六', 7: '九', 8: '六', 9: '九' };

  let yaoDetails = yaos.map((y, i) => ({
    position: i === 0 ? `${YAO_TYPE[y]}初` : i === 5 ? `上${YAO_TYPE[y]}` : `${YAO_TYPE[y]}${POS_NAMES[i]}`,
    value: y,
    isYang: yaoToYinYang(y) === 1,
    isDong: isDongYao(y),
    symbol: yaoToYinYang(y) === 1 ? '⚊' : '⚋',
    symbolDong: isDongYao(y) ? (y === 9 ? '○' : '×') : ''
  }));

  return {
    yaos,           // [6,7,8,9] 原始爻值
    yaoDetails,     // 爻详细信息
    benGuaYao,      // 本卦阴阳 [0/1]
    bianGuaYao,     // 变卦阴阳 [0/1]
    benGua: {
      upper: upperGua,
      lower: lowerGua,
      upperStr: upperStr,
      lowerStr: lowerStr
    },
    bianGua: dongYaoList.length > 0 ? {
      upper: bianUpperGua,
      lower: bianLowerGua,
      upperStr: bianUpperStr,
      lowerStr: bianLowerStr
    } : null,
    dongYaoList,    // 动爻索引列表
    hasBianGua: dongYaoList.length > 0
  };
}

/**
 * 在64卦数据中匹配卦象
 * @param {Array} gua64List - 64卦数据列表
 * @param {string} upper - 上卦名
 * @param {string} lower - 下卦名
 * @returns {Object|null} 匹配到的卦数据
 */
function matchGua(gua64List, upper, lower) {
  return gua64List.find(g => g.upper === upper && g.lower === lower) || null;
}

/**
 * 获取动爻爻辞
 * @param {Object} guaData - 匹配到的卦数据
 * @param {Array} dongYaoList - 动爻索引列表
 * @returns {Array} 动爻爻辞信息
 */
function getDongYaoCi(guaData, dongYaoList) {
  if (!guaData || !guaData.yaoci) return [];
  return dongYaoList.map(idx => {
    const yao = guaData.yaoci.find(y => {
      // 匹配 position：idx=0→初九/初六, idx=1→九二/六二, etc.
      const posMap = ['初', '二', '三', '四', '五', '上'];
      return y.position.includes(posMap[idx]);
    });
    return yao || { position: `第${idx + 1}爻`, text: '', xiang: '', baihua: '', shaoyong: '' };
  });
}

// 导出

