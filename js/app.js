/**
 * 易经灵机 - 主交互逻辑 v2
 * SPA 单页应用，无框架，纯原生JS
 * 升级内容：首次引导、Tab 切换动画、收藏、Toast
 *
 * 数据文件通过 script 标签以普通变量形式引入
 * qianList 和 gua64List 为全局变量
 */

// ============ 全局状态 ============
let currentTab = 'shake';
let currentResult = null; // { mode: 'qian'|'gua', data: ... }
let isShaking = false;
let isDivining = false;

// 收藏 key 前缀
const FAV_KEY_PREFIX = 'iching_fav_';
const INTRO_KEY = 'iching_intro_seen';

// ============ 首次引导 ============
function dismissIntro() {
  const overlay = document.getElementById('intro-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 600);
  }
  try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
}

// 首次访问才显示引导
(function checkIntro() {
  try {
    let seen = false;
    try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
    // 支持 URL 参数 ?skip_intro=1 跳过引导（用于截图/测试）
    const urlParams = new URLSearchParams(window.location.search);
    const skipIntro = urlParams.get('skip_intro') === '1';
    if (seen || skipIntro) {
      const overlay = document.getElementById('intro-overlay');
      if (overlay) overlay.remove();
    }
    // 支持 ?tab=divination 直接打开卦象页
    const initialTab = urlParams.get('tab');
    if (initialTab && (initialTab === 'shake' || initialTab === 'divination')) {
      setTimeout(() => {
        const tab = document.querySelector('[data-tab="' + initialTab + '"]');
        if (tab) tab.click();
      }, 100);
    }
  } catch (e) {
    console.warn('Intro init error:', e);
  }
})();

// ============ Toast 工具 ============
function showToast(message, duration = 2000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), duration);
}

// ============ 收藏功能 ============
function getFavKey() {
  if (!currentResult) return null;
  if (currentResult.mode === 'qian') return FAV_KEY_PREFIX + 'qian_' + currentResult.data.id;
  return FAV_KEY_PREFIX + 'gua_' + currentResult.data.benGua.upper + currentResult.data.benGua.lower;
}

function isFavorited() {
  const key = getFavKey();
  if (!key) return false;
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}

function updateFavBtn() {
  const btn = document.getElementById('fav-btn');
  if (!btn) return;
  btn.classList.toggle('active', isFavorited());
}

function toggleFavorite() {
  const key = getFavKey();
  if (!key) return;
  const willAdd = !isFavorited();
  try {
    if (willAdd) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  } catch (e) {
    showToast('存储不可用');
    return;
  }
  updateFavBtn();
  showToast(willAdd ? '已收藏' : '已取消收藏');
}

// ============ Tab切换 ============
document.querySelectorAll('.tab-item').forEach(tab => {
  tab.addEventListener('click', () => {
    if (isShaking || isDivining) return;

    const target = tab.dataset.tab;
    if (target === currentTab) return;

    // 切换 tab 激活态
    document.querySelectorAll('.tab-item').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    // 页面切换（带淡出淡入）
    const currentPage = document.querySelector('.page.active');
    const targetPage = document.getElementById(`page-${target}`);

    if (currentPage) {
      currentPage.style.opacity = '0';
      currentPage.style.transform = 'translateY(-6px)';
      setTimeout(() => {
        currentPage.classList.remove('active');
        currentPage.style.opacity = '';
        currentPage.style.transform = '';

        if (targetPage) {
          targetPage.classList.add('active');
          // 触发重排后应用动画
          requestAnimationFrame(() => {
            targetPage.style.animation = 'none';
            void targetPage.offsetWidth;
            targetPage.style.animation = '';
          });
        }
      }, 200);
    }

    currentTab = target;
  });
});

// ============ 摇签逻辑 ============
function startShake() {
  if (isShaking) return;
  isShaking = true;

  const btn = document.getElementById('shake-btn');
  const tube = document.getElementById('sign-tube');
  const tip = document.getElementById('shake-tip-text');
  const glow = document.getElementById('tube-glow');

  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = '感应中...';
  btn.classList.add('shaking-active');
  tube.classList.add('shaking');
  if (glow) glow.classList.add('active');
  tip.textContent = '灵签感应中...';

  setTimeout(() => {
    tube.classList.remove('shaking');
    btn.classList.remove('shaking-active');
    if (glow) glow.classList.remove('active');

    // 签弹出动画
    const fallingSign = document.createElement('div');
    fallingSign.className = 'sign-falling';
    tube.appendChild(fallingSign);
    setTimeout(() => fallingSign.remove(), 900);

    const randomIdx = Math.floor(Math.random() * qianList.length);
    const qian = qianList[randomIdx];

    currentResult = { mode: 'qian', data: qian };
    setTimeout(() => showResult(), 600);
    resetShakeState();
  }, 1800);
}

function resetShakeState() {
  isShaking = false;
  const btn = document.getElementById('shake-btn');
  const tip = document.getElementById('shake-tip-text');
  btn.disabled = false;
  btn.querySelector('.btn-text').textContent = '摇 签 体 验';
  tip.textContent = '轻触按钮感应灵签';
}

// ============ 移动端摇一摇 ============
let shakeThreshold = 15;
let lastShakeTime = 0;
let shakeListenerActive = false;
let shakeToggleActive = false;

// 摇一摇开关（显式触发，避免 iOS 首次点击时弹出权限对话框）
function toggleDeviceMotion(event) {
  if (event) event.stopPropagation();

  const toggle = document.getElementById('shake-toggle');

  if (shakeToggleActive) {
    // 关闭摇一摇
    shakeToggleActive = false;
    shakeListenerActive = false;
    if (toggle) {
      toggle.classList.remove('active');
      toggle.textContent = '⚡ 摇一摇';
    }
    showToast('已关闭摇一摇');
    return;
  }

  if (!window.DeviceMotionEvent) {
    showToast('您的设备不支持摇一摇');
    return;
  }

  // iOS 需要请求权限
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(state => {
        if (state === 'granted') {
          shakeToggleActive = true;
          addMotionListener();
          if (toggle) {
            toggle.classList.add('active');
            toggle.textContent = '⚡ 摇一摇 · 已开启';
          }
          showToast('已开启摇一摇，摇晃手机试试');
        } else {
          showToast('未获得权限，已取消');
        }
      })
      .catch(() => {
        showToast('权限请求失败');
      });
  } else {
    // Android / 桌面：直接启用
    shakeToggleActive = true;
    addMotionListener();
    if (toggle) {
      toggle.classList.add('active');
      toggle.textContent = '⚡ 摇一摇 · 已开启';
    }
    showToast('已开启摇一摇，摇晃手机试试');
  }
}

function addMotionListener() {
  if (shakeListenerActive) return;
  shakeListenerActive = true;
  window.addEventListener('devicemotion', (e) => {
    const acc = e.accelerationIncludingGravity;
    if (!acc) return;
    const totalAcc = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
    const now = Date.now();
    if (totalAcc > shakeThreshold && now - lastShakeTime > 3000 && !isShaking && currentTab === 'shake') {
      lastShakeTime = now;
      startShake();
    }
  });
}

// 注意：不再在 shake-btn 点击时自动请求 DeviceMotion 权限（避免 iOS 权限弹窗打断摇签体验）

// ============ 摇一摇默认开启 ============
(function autoEnableShake() {
  if (!window.DeviceMotionEvent) return;           // 不支持的直接跳过
  // iOS 需要用户手势才弹出权限对话框，非 iOS 直接开启
  if (typeof DeviceMotionEvent.requestPermission !== 'function') {
    shakeToggleActive = true;
    addMotionListener();
    var toggle = document.getElementById('shake-toggle');
    if (toggle) {
      toggle.classList.add('active');
      toggle.textContent = '⚡ 摇一摇 · 已开启';
    }
  }
})();

// ============ 起卦逻辑 ============
function startDivination() {
  if (isDivining) return;
  isDivining = true;

  const btn = document.getElementById('divination-btn');
  const progress = document.getElementById('divination-progress');
  const taiji = document.querySelector('.taiji-container');
  const stackLabel = document.getElementById('gua-stack-label');
  const stackLines = document.getElementById('gua-stack-lines');

  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = '推演中...';
  if (progress) progress.style.display = 'flex';

  // 太极图加速旋转
  taiji.classList.add('spinning');
  taiji.style.animation = 'taijiSpin 1.8s linear infinite';

  // 重置卦象堆叠区 - 清空所有爻位
  for (let i = 0; i < 6; i++) {
    const el = document.querySelector(`.yao-slot[data-pos="${i}"]`);
    if (el) el.innerHTML = '<span class="yao-svg-placeholder"></span>';
  }
  if (stackLabel) {
    stackLabel.textContent = '卦象未成';
    stackLabel.classList.remove('active');
  }

  const guaResult = getGua();

  const YAO_NAMES = ['初爻渐成', '二爻初现', '三爻方定', '四爻已成', '五爻显象', '上爻终成'];

  let delay = 300;
  guaResult.yaoDetails.forEach((yao, i) => {
    setTimeout(() => {
      const el = document.querySelector(`.yao-slot[data-pos="${i}"]`);
      if (el) {
        // 渲染爻符号
        const isYang = yao.isYang;
        const isDong = yao.isDong;
        const yaoClass = isYang ? 'yao-yang' : 'yao-yin';
        const dongClass = isDong ? ' dong' : '';
        el.innerHTML = `<div class="${yaoClass}${dongClass}"></div>`;
      }
      // 更新标签
      if (stackLabel && i === guaResult.yaoDetails.length - 1) {
        const finalName = `${guaResult.benGua.upper}上${guaResult.benGua.lower}下`;
        stackLabel.textContent = `已成 ${finalName}`;
        stackLabel.classList.add('active');
      } else if (stackLabel) {
        stackLabel.textContent = YAO_NAMES[i] + '...';
        stackLabel.classList.add('active');
      }
    }, delay + i * 500);
  });

  const totalDelay = delay + 6 * 500 + 1200;
  setTimeout(() => {
    // 恢复太极图动画
    taiji.classList.remove('spinning');
    taiji.style.animation = 'taijiBreath 4s ease-in-out infinite';
    currentResult = { mode: 'gua', data: guaResult };
    updateInterpretBtn(); // 显卦象解卦按钮
    showResult();
    resetDivinationState();
  }, totalDelay);
}

function resetDivinationState() {
  isDivining = false;
  document.getElementById('divination-btn').disabled = false;
  document.getElementById('divination-btn').querySelector('.btn-text').textContent = '推 演 卦 象';
  const progress = document.getElementById('divination-progress');
  if (progress) progress.style.display = 'none';
}

// ============ 结果展示 ============
function showResult() {
  try {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const resultPage = document.getElementById('page-result');
    if (!resultPage) throw new Error('找不到 #page-result 元素');
    resultPage.classList.add('active');

    const titleEl = document.getElementById('result-title');
    const contentEl = document.getElementById('result-content');
    if (!contentEl) throw new Error('找不到 #result-content 元素');

    if (currentResult.mode === 'qian') {
      if (titleEl) titleEl.textContent = '签 诗 赏 析';
      contentEl.innerHTML = renderQianResult(currentResult.data);
    } else {
      if (titleEl) titleEl.textContent = '卦 象 释 义';
      const rendered = renderGuaResult(currentResult.data);
      // 调试：检查渲染结果
      if (!rendered || rendered.length < 50) {
        contentEl.innerHTML = '<div style="color:red;padding:20px;">DEBUG: 渲染结果异常: ' + (rendered ? rendered.length + ' chars' : 'null') + '</div>';
      } else {
        contentEl.innerHTML = rendered;
      }
    }

    // 滚动到顶部
    contentEl.scrollTop = 0;
    updateFavBtn();
  } catch (e) {
    const contentEl = document.getElementById('result-content');
    if (contentEl) {
      contentEl.innerHTML = '<div style="color:red;padding:20px;font-size:14px;">渲染错误: ' + e.message + '<br><br>Stack: ' + (e.stack || 'none').replace(/\n/g, '<br>') + '</div>';
    }
  }
}

function goBack() {
  const resultPage = document.getElementById('page-result');
  resultPage.classList.remove('active');
  const target = currentResult.mode === 'qian' ? 'shake' : 'divination';
  const targetPage = document.getElementById(`page-${target}`);
  targetPage.classList.add('active');
  document.querySelectorAll('.tab-item').forEach(t => {
    const isActive = t.dataset.tab === target;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  currentTab = target;
  // 保留 currentResult，让「解卦」按钮可以再次进入结果页
  updateInterpretBtn();
}

// 更新「解卦」按钮显隐 — 卦象模式下有结果时显示
function updateInterpretBtn() {
  const btn = document.getElementById('interpret-btn');
  if (!btn) return;
  const hasGuaResult = currentResult && currentResult.mode === 'gua';
  btn.style.display = hasGuaResult ? 'inline-flex' : 'none';
}

// 解卦：直接打开结果页（复用 currentResult）
function goInterpret() {
  if (!currentResult || currentResult.mode !== 'gua') {
    showToast('请先推演卦象');
    return;
  }
  showResult();
}

// ============ 文本格式化工具 ============

/**
 * 统一中文标点：清理多余空格，规范句号
 */
function normalizeChineseText(text) {
  if (!text) return '';
  return text
    .replace(/\u3002\s+/g, '。')
    .replace(/\s+\u3002/g, '。')
    .replace(/\s+\uff0c/g, '，')
    .replace(/\uff0c\s+/g, '，')
    .replace(/\s+/g, ' ')
    .replace(/\u3002{2,}/g, '。')
    .trim();
}

/**
 * 格式化多段文本：将 \n 转换为段落，保持文章结构
 */
function formatParagraphs(text) {
  if (!text) return '';
  try {
    const paragraphs = text
      .replace(/\n{3,}/g, '\n\n')
      .split(/\n\n/)
      .filter(p => p.trim());

    return paragraphs.map(p => '<p class="text-paragraph">' + normalizeChineseText(p) + '</p>').join('');
  } catch (e) {
    console.warn('formatParagraphs error:', e);
    return '<p class="text-paragraph">' + String(text).replace(/</g, '&lt;') + '</p>';
  }
}

/**
 * 格式化多行短文本（如卦辞爻辞）
 */
function formatMultiline(text) {
  if (!text) return '';
  return normalizeChineseText(text)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, '<br>')
    .trim();
}

// ============ 签诗渲染 ============
function renderQianResult(qian) {
  const levelClass = {
    '上上': 'level-shangshang', '上吉': 'level-shangji',
    '中吉': 'level-shangji', '中平': 'level-zhongping',
    '下下': 'level-xiaxia'
  };
  const cls = levelClass[qian.level] || 'level-zhongping';

  // 签诗分行：按分号/句号分隔，保留每句结尾的句号
  const poemLines = qian.poem
    .split(/[；。]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const poemHtml = poemLines.map(line => `<div class="poem-line">${line}。</div>`).join('');
  const explanationHtml = formatParagraphs(qian.explanation);

  return `<div class="qian-result-card result-card">
    <span class="corner-deco-tr" aria-hidden="true"></span>
    <div class="qian-id">第 ${qian.id} 签</div>
    <div style="text-align: center;"><div class="qian-level ${cls}">${qian.level}</div></div>
    <div class="qian-name">${qian.name}</div>
    <div class="qian-poem">${poemHtml}</div>
    ${explanationHtml ? `<div class="deco-line"></div><div class="qian-explanation">${explanationHtml}</div>` : ''}
  </div>`;
}

// ============ 卦象渲染 ============
function renderGuaResult(guaResult) {
  const benGuaData = matchGua(gua64List, guaResult.benGua.upper, guaResult.benGua.lower);
  const bianGuaData = guaResult.hasBianGua && guaResult.bianGua
    ? matchGua(gua64List, guaResult.bianGua.upper, guaResult.bianGua.lower)
    : null;

  // 本卦爻符展示（CSS 渲染爻线，从下到上排列）
  const benYaoSymbols = guaResult.yaoDetails.map(y => {
    const dong = y.isDong ? ' dong' : '';
    const cls = y.isYang ? 'yao-yang' : 'yao-yin';
    return '<div class="' + cls + dong + ' yao-result-line"></div>';
  }).join('');

  // 卦名展示
  const benGuaName = benGuaData ? benGuaData.name : '未知卦';
  const benGuaCombo = `${guaResult.benGua.upper}上${guaResult.benGua.lower}下`;

  let html = '<div class="gua-result-card result-card">' +
    '<span class="corner-deco-tr" aria-hidden="true"></span>' +
    '<div class="gua-symbol-display">' + benYaoSymbols + '</div>' +
    '<div class="gua-name">' + benGuaName + '</div>' +
    '<div class="gua-combo">' + benGuaCombo + ' · ' + (benGuaData ? benGuaData.shortName : '') + '</div>' +
    '<div class="gua-text">' + (benGuaData ? normalizeChineseText(benGuaData.text) : '卦辞缺失') + '</div>' +
    (benGuaData && benGuaData.xiangZhuan ? '<div class="gua-xiang">象曰：' + normalizeChineseText(benGuaData.xiangZhuan) + '</div>' : '');

  // 白话文解释（全部展开）
  var baihuaText = (benGuaData && benGuaData.baihua) ? formatParagraphs(benGuaData.baihua) : '<p class="text-paragraph" style="color:var(--color-ink-light);">（暂无白话释义）</p>';
  html += '<div class="section-block">' +
    '<div class="section-label">白话释义</div>' +
    '<div class="section-content baihua-section">' + baihuaText + '</div>' +
    '</div>';

  // 《断易天机》解（全部展开）
  var duanyiText = (benGuaData && benGuaData.duanyi) ? formatParagraphs(benGuaData.duanyi) : '<p class="text-paragraph" style="color:var(--color-ink-light);">（暂无《断易天机》解）</p>';
  html += '<div class="section-block">' +
    '<div class="section-label">《断易天机》解</div>' +
    '<div class="section-content duanyi-section">' + duanyiText + '</div>' +
    '</div>';

  // 邵雍解（全部展开）
  var shaoyongText = (benGuaData && benGuaData.shaoyong) ? formatParagraphs(benGuaData.shaoyong) : '<p class="text-paragraph" style="color:var(--color-ink-light);">（暂无邵雍解）</p>';
  html += '<div class="section-block">' +
    '<div class="section-label">邵雍解</div>' +
    '<div class="section-content shaoyong-section">' + shaoyongText + '</div>' +
    '</div>';

  // 传统解卦（全部展开）
  var chuantongText = (benGuaData && benGuaData.chuantong) ? formatParagraphs(benGuaData.chuantong) : '<p class="text-paragraph" style="color:var(--color-ink-light);">（暂无传统解卦）</p>';
  html += '<div class="section-block">' +
    '<div class="section-label">传统解卦</div>' +
    '<div class="section-content chuantong-section">' + chuantongText + '</div>' +
    '</div>';

  // 变卦
  if (guaResult.hasBianGua && bianGuaData) {
    const bianYao = guaResult.bianGuaYao.map(y =>
      '<div class="' + (y === 1 ? 'yao-yang' : 'yao-yin') + ' yao-result-line"></div>'
    ).join('');

    html += '<div class="bian-gua-section">' +
      '<div class="bian-label">→ 变卦 · ' + bianGuaData.name + '</div>' +
      '<div class="gua-symbol-display" style="font-size:36px;">' + bianYao + '</div>' +
      '<div class="gua-combo">' + guaResult.bianGua.upper + '上' + guaResult.bianGua.lower + '下 · ' + bianGuaData.shortName + '</div>' +
      '<div class="gua-text">' + normalizeChineseText(bianGuaData.text) + '</div>' +
      (bianGuaData.xiangZhuan ? '<div class="gua-xiang">象曰：' + normalizeChineseText(bianGuaData.xiangZhuan) + '</div>' : '') +
      '</div>';

    // 变卦白话释义
    if (bianGuaData.baihua) {
      html += '<div class="section-block">' +
        '<div class="section-label" style="margin-top: var(--space-3);">变卦 · 白话释义</div>' +
        '<div class="section-content baihua-section">' + formatParagraphs(bianGuaData.baihua) + '</div>' +
        '</div>';
    }
  }

  // 动爻爻辞（含白话+邵雍）
  if (benGuaData && guaResult.dongYaoList.length > 0) {
    const dongYaos = getDongYaoCi(benGuaData, guaResult.dongYaoList);
    html += '<div class="dong-yaoci"><div class="bian-label">动 爻 释 义</div>';
    dongYaos.forEach(y => {
      var yaoBaihua = y.baihua ? formatParagraphs(y.baihua) : '<p class="text-paragraph" style="color:var(--color-ink-light);">（暂无白话释义）</p>';
      var yaoShaoyong = y.shaoyong ? formatParagraphs(y.shaoyong) : '<p class="text-paragraph" style="color:var(--color-ink-light);">（暂无邵雍解）</p>';
      var yaoTextShort = normalizeChineseText(y.text).substring(0, 18);
      html += '<div class="dong-yao-item">' +
        '<div class="yao-position">' + y.position + ' · ' + yaoTextShort + '…</div>' +
        '<div class="yao-text">' + normalizeChineseText(y.text) + '</div>' +
        (y.xiang ? '<div class="yao-text">象曰：' + normalizeChineseText(y.xiang) + '</div>' : '') +
        '<div class="yao-sub-section"><span class="yao-sub-label">白话释义</span>' + yaoBaihua + '</div>' +
        '<div class="yao-sub-section"><span class="yao-sub-label">邵雍解</span>' + yaoShaoyong + '</div>' +
        '</div>';
    });
    html += '</div>';
  }

  if (!guaResult.hasBianGua) {
    html += '<div class="no-bian-tip">此卦无动爻，不变卦</div>';
  }

  html += '</div>';
  return html;
}
