/* ==========================================================================
   app.js · 工具箱主控：图标 / 路由 / 首页 / 搜索 / 主题
   ========================================================================== */
(function () {
  'use strict';

  const TOOLS = window.TOOL_REGISTRY || [];
  const GROUP_ORDER = ['数据格式', '编解码', '文本处理', '生成器', '图片工具', '开发辅助'];

  /* 默认菜单顺序：按日常使用频率从高到低（估算，非埋点数据） */
  const DEFAULT_ORDER = [
    'json', 'timestamp', 'codec', 'radix',
    'regex', 'diff', 'format',
    'qrcode', 'random', 'color',
    'img-compress', 'img-convert',
    'url', 'jwt', 'cron', 'file-hash'
  ];

  /* 上一版默认顺序（注册顺序），用于识别从未自定义过顺序的老用户 */
  const OLD_ORDER = [
    'json', 'timestamp', 'radix', 'codec', 'regex', 'format', 'random',
    'img-compress', 'img-convert', 'qrcode', 'jwt', 'cron', 'url',
    'file-hash', 'diff', 'color'
  ];

  const MENU_VERSION = 2;

  /* 首页描述：进入工具页时会被替换，返回首页时还原 */
  const metaDescEl = document.querySelector('meta[name="description"]');
  const HOME_DESC = metaDescEl ? metaDescEl.getAttribute('content') : '';

  function setMetaDescription(text) {
    if (metaDescEl && text) metaDescEl.setAttribute('content', text);
  }

  const svg = function (inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  };

  const ICONS = {
    json: svg('<path d="M9 3H7.5A2.5 2.5 0 0 0 5 5.5v3A2.5 2.5 0 0 1 2.5 11 2.5 2.5 0 0 1 5 13.5v3A2.5 2.5 0 0 0 7.5 19H9"/><path d="M15 3h1.5A2.5 2.5 0 0 1 19 5.5v3A2.5 2.5 0 0 0 21.5 11 2.5 2.5 0 0 0 19 13.5v3A2.5 2.5 0 0 1 16.5 19H15"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>'),
    clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/>'),
    binary: svg('<path d="M9.5 3.5L7.5 20.5"/><path d="M16.5 3.5L14.5 20.5"/><path d="M4 8.5h16"/><path d="M3 15.5h16"/>'),
    lock: svg('<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.3"/><path d="M12 16.8v1.8"/>'),
    regex: svg('<path d="M12 4v8"/><path d="M8.5 6l7 4"/><path d="M15.5 6l-7 4"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/><path d="M11 18h2"/>'),
    code: svg('<path d="M9 6l-5 6 5 6"/><path d="M15 6l5 6-5 6"/>'),
    dice: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none"/>'),
    qr: svg('<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.2"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.2"/><path d="M14 14h2.6v2.6H14zM17.8 17.8h2.7v2.7h-2.7zM17.9 14H20"/><path d="M14.2 18.3h2"/>'),
    image: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-4.4-4.2L6 20"/>'),
    convert: svg('<path d="M4 8h13"/><path d="M14 4.5L17.5 8 14 11.5"/><path d="M20 16H7"/><path d="M10 12.5L6.5 16 10 19.5"/>'),
    link: svg('<path d="M10.2 13.8a4.2 4.2 0 0 0 6 0l2.6-2.6a4.2 4.2 0 0 0-6-6l-1.4 1.4"/><path d="M13.8 10.2a4.2 4.2 0 0 0-6 0l-2.6 2.6a4.2 4.2 0 0 0 6 6l1.4-1.4"/>'),
    diff: svg('<rect x="3.5" y="3.5" width="7" height="17" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="17" rx="1.6"/><path d="M5.5 8.5h3M5.5 12h3M5.5 15.5h2M15.5 8.5h3M15.5 12h3M15.5 15.5h2"/>'),
    palette: svg('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.8 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.6" cy="11.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.2" cy="7.9" r="1.1" fill="currentColor" stroke="none"/><circle cx="17.2" cy="12.2" r="1.1" fill="currentColor" stroke="none"/>'),
    hash: svg('<path d="M9.5 3.5L7.5 20.5"/><path d="M16.5 3.5L14.5 20.5"/><path d="M4.5 8.5h15"/><path d="M3.5 15.5h15"/>')
  };

  const view = document.getElementById('view');
  const nav = document.getElementById('nav');
  const crumbs = document.getElementById('crumbs');
  const searchInput = document.getElementById('toolSearch');
  const menuBar = document.getElementById('menuBar');
  const menuBtn = document.getElementById('menuBtn');
  let cleanup = null;
  let managing = false;

  /* ---------------- 菜单自定义状态 ---------------- */
  const MENU_KEY = 'dt-menu';

  function defaultOrder() {
    const ids = DEFAULT_ORDER.filter(function (id) {
      return TOOLS.some(function (t) { return t.id === id; });
    });
    // 新增但未列入 DEFAULT_ORDER 的工具，追加到末尾
    TOOLS.forEach(function (t) { if (ids.indexOf(t.id) < 0) ids.push(t.id); });
    return ids;
  }

  function defaultMenu() {
    return { v: MENU_VERSION, order: defaultOrder(), hidden: [] };
  }

  function loadMenu() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(MENU_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !Array.isArray(s.order)) s = defaultMenu();
    if (!Array.isArray(s.hidden)) s.hidden = [];

    // 顺序升级：仅对「从未调整过顺序」的老用户生效，自定义过的保持原样
    if (s.v !== MENU_VERSION) {
      if (s.order.join(',') === OLD_ORDER.join(',')) s.order = defaultOrder();
      s.v = MENU_VERSION;
      try { localStorage.setItem(MENU_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    }

    const alive = TOOLS.map(function (t) { return t.id; });
    // 清掉已经不存在的工具；版本升级后新增的工具追加到末尾
    s.order = s.order.filter(function (id) { return alive.indexOf(id) >= 0; });
    s.hidden = s.hidden.filter(function (id) { return alive.indexOf(id) >= 0; });
    alive.forEach(function (id) {
      if (s.order.indexOf(id) < 0) s.order.push(id);
    });
    return s;
  }

  let menu = loadMenu();

  function saveMenu() {
    try { localStorage.setItem(MENU_KEY, JSON.stringify(menu)); } catch (e) { /* ignore */ }
  }

  function isHidden(id) {
    return menu.hidden.indexOf(id) >= 0;
  }

  function sortByMenu(items) {
    const rank = {};
    menu.order.forEach(function (id, i) { rank[id] = i; });
    return items.slice().sort(function (a, b) {
      const ra = rank[a.id] === undefined ? 1e6 : rank[a.id];
      const rb = rank[b.id] === undefined ? 1e6 : rank[b.id];
      return ra - rb;
    });
  }

  function visibleTools() {
    return sortByMenu(TOOLS.filter(function (t) { return !isHidden(t.id); }));
  }

  /**
   * 按分组归集工具。
   * all = false 时排除已隐藏的工具（用于正常导航和首页）。
   */
  function groups(all) {
    const map = {};
    TOOLS.forEach(function (t) {
      if (!all && isHidden(t.id)) return;
      if (!map[t.group]) map[t.group] = [];
      map[t.group].push(t);
    });
    const keys = Object.keys(map).sort(function (a, b) {
      const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return keys.map(function (k) { return { name: k, items: sortByMenu(map[k]) }; });
  }

  /* ---------------- 侧边导航 ---------------- */
  function buildNav() {
    let html = '<div class="nav-group"><a class="nav-item" href="#home" data-id="home">' +
      svg('<path d="M4 10.5L12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/>') +
      '<span class="nav-label">全部工具</span></a></div>';

    const gs = groups(false);
    if (!gs.length) {
      html += '<div class="nav-empty">所有工具都被隐藏了' +
        '<button type="button" class="nav-empty-btn" data-reset="1">恢复默认菜单</button></div>';
    }
    gs.forEach(function (g) {
      html += '<div class="nav-group" data-group="' + g.name + '">' +
        '<div class="nav-group-title">' + g.name + '</div>' +
        g.items.map(function (t) {
          return '<a class="nav-item" href="#' + t.id + '" data-id="' + t.id + '" title="' + Lib.escapeHtml(t.desc) + '">' +
            (ICONS[t.icon] || ICONS.code) + '<span class="nav-label">' + t.name + '</span></a>';
        }).join('') + '</div>';
    });
    nav.innerHTML = html;
  }

  function setActive(id) {
    nav.querySelectorAll('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.dataset.id === id);
    });
    const active = nav.querySelector('.nav-item.active');
    if (active && active.scrollIntoView) {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /* ---------------- 首页 ---------------- */
  function homeFoot() {
    return '<div class="home-foot">' +
      '<span class="hf-brand">FANCUN TOOLKIT</span>' +
      '<span class="hf-meta">全部运算在本地完成 · tools.v5pc.com</span>' +
      '</div>';
  }

  function renderHome() {
    const list = visibleTools();
    const sameAsAll = list.length === TOOLS.length;

    let html = '<div class="view-inner fade-in">' +
      '<div class="hero">' +
      '<div class="hero-slogan">方寸之间，得心应手</div>' +
      '<h1>方寸<em>工具箱</em>，一个页面搞定 16 件开发者日常</h1>' +
      '<p>Base64 编解码、JSON、时间戳、进制、JWT、Cron、正则、文本对比、代码美化、随机密码、颜色、图片压缩与二维码 —— 全部在浏览器本地完成，不上传任何数据。</p>' +
      '<div class="hero-stats">' +
      '<div><b>' + list.length + '</b><span>实用工具</span></div>' +
      '<div><b>0</b><span>运行时依赖</span></div>' +
      '<div><b>100%</b><span>本地处理</span></div>' +
      '<div><b>离线</b><span>可用</span></div>' +
      '</div></div>' + adSlot('home-top');

    if (!list.length) {
      html += '<div class="home-empty">' +
        '<b>侧边栏里的工具都被隐藏了</b>' +
        '<span>到「管理菜单」把需要的工具加回来，或者直接恢复默认。</span>' +
        '<button type="button" class="hgt-reset" data-reset="1">恢复默认菜单</button>' +
        '</div>' + adSlot('home-bottom') + homeFoot() + '</div>';
    } else {
      html += '<div class="home-group"><div class="home-group-title">' +
        (sameAsAll ? '全部工具' : '我的工具 <button type="button" class="hgt-reset" data-reset="1">显示全部 ' + TOOLS.length + ' 个</button>') +
        '</div><div class="tool-grid">';
      list.forEach(function (t) {
        html += '<a class="tool-card" href="#' + t.id + '" data-name="' + Lib.escapeHtml(t.name) + '">' +
          '<span class="tc-tag">' + Lib.escapeHtml(t.group) + '</span>' +
          '<span class="tc-icon">' + (ICONS[t.icon] || ICONS.code) + '</span>' +
          '<b>' + t.name + '</b><span>' + Lib.escapeHtml(t.desc) + '</span></a>';
      });
      html += '</div></div>' + adSlot('home-bottom') + homeFoot() + '</div>';
    }
    view.innerHTML = html;
    crumbs.innerHTML = '<b>全部工具</b>';
    document.title = '方寸工具箱｜Base64 编解码、JSON 格式化等 16 个开发者在线工具';
    setMetaDescription(HOME_DESC);
    mountAds();
  }

  /* ---------------- 工具页 ---------------- */
  function renderTool(tool) {
    view.innerHTML = '<div class="view-inner fade-in">' + tool.html() + adSlot('tool-bottom') + '</div>';
    view.querySelectorAll('[data-icon]').forEach(function (el) {
      el.innerHTML = ICONS[el.dataset.icon] || ICONS.code;
    });
    if (typeof tool.mount === 'function') {
      cleanup = tool.mount(view) || null;
    }
    mountAds();
    crumbs.innerHTML = '<span>工具</span><span class="sep">/</span><span>' +
      Lib.escapeHtml(tool.group) + '</span><span class="sep">/</span><b>' +
      Lib.escapeHtml(tool.name) + '</b>';
    document.title = (tool.seoTitle || (tool.name + ' - 在线工具')) + ' | 方寸工具箱';
    setMetaDescription(tool.seoDesc || (tool.name + '：' + tool.desc + '。在线工具，全部在浏览器本地运行，数据不上传。'));
  }

  /* ---------------- 统计埋点 ---------------- */
  const VID_KEY = 'fc_vid';

  function visitorId() {
    try {
      let v = localStorage.getItem(VID_KEY);
      if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
        v = 'v' + (window.crypto && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '')
          : Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem(VID_KEY, v);
      }
      return v;
    } catch (e) {
      return '';
    }
  }

  function trackPage(page) {
    try {
      const data = JSON.stringify({ page: page, vid: visitorId() });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([data], { type: 'application/json' }));
      } else if (window.fetch) {
        fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: data,
          keepalive: true
        }).catch(function () { /* 静默 */ });
      }
    } catch (e) { /* 统计失败不影响使用 */ }
  }

  /* ---------------- 广告位 ---------------- */
  function adSlot(slot) {
    return '<div class="ad-slot" data-slot="' + slot + '"></div>';
  }

  /* 关闭过的广告：记 id，7 天后自动失效（换新素材或重新投放还能再出现） */
  const AD_CLOSED_KEY = 'fc_ad_closed';
  const AD_CLOSED_TTL = 7 * 24 * 3600 * 1000;

  function closedAds() {
    let m = {};
    try { m = JSON.parse(localStorage.getItem(AD_CLOSED_KEY) || '{}') || {}; } catch (e) { m = {}; }
    const now = Date.now(), out = {};
    let pruned = false;
    Object.keys(m).forEach(function (k) {
      const t = +m[k] || 0;
      if (now - t < AD_CLOSED_TTL) out[k] = t;
      else pruned = true;
    });
    if (pruned) {
      try { localStorage.setItem(AD_CLOSED_KEY, JSON.stringify(out)); } catch (e) { /* ignore */ }
    }
    return out;
  }

  function markAdClosed(id) {
    if (!id) return;
    try {
      const m = closedAds();
      m[id] = Date.now();
      localStorage.setItem(AD_CLOSED_KEY, JSON.stringify(m));
    } catch (e) { /* 隐私模式下写不进就算了 */ }
  }

  function adCloseBtn() {
    return '<button type="button" class="ad-close" aria-label="关闭广告" title="关闭广告">' +
      svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>') + '</button>';
  }

  function fillAds(el, list) {
    const closed = closedAds();
    const keep = list.filter(function (a) { return !(a.id && closed[a.id]); });
    if (!keep.length) { el.remove(); return; }

    el.innerHTML = '<span class="ad-tag">广告</span>' + keep.map(function (a) {
      const body = a.type === 'html'
        ? '<div class="ad-body">' + a.html + '</div>'
        : (function () {
            const href = Lib.escapeHtml(a.linkUrl || '#');
            return '<a class="ad-card" href="' + href + '" target="_blank" rel="noopener nofollow sponsored">' +
              (a.imageUrl ? '<img src="' + Lib.escapeHtml(a.imageUrl) + '" alt="' + Lib.escapeHtml(a.title) + '" loading="lazy" referrerpolicy="no-referrer">' : '') +
              '<span class="ad-txt"><b>' + Lib.escapeHtml(a.title) + '</b>' +
              (a.desc ? '<span>' + Lib.escapeHtml(a.desc) + '</span>' : '') +
              '</span></a>';
          })();
      return '<div class="ad-item" data-id="' + Lib.escapeHtml(a.id || '') + '">' + body + adCloseBtn() + '</div>';
    }).join('');
    el.classList.add('has-ad');
    /* 多条广告并排一行两个（窄屏由 CSS 回落单列） */
    el.classList.toggle('is-multi', keep.length > 1);

    /* 事件委托：一个监听管整个广告位 */
    el.addEventListener('click', function (ev) {
      const btn = ev.target.closest ? ev.target.closest('.ad-close') : null;
      if (!btn) return;
      ev.preventDefault();
      closeAd(btn.closest('.ad-item'), el);
    });
  }

  function closeAd(item, slotEl) {
    if (!item || item.classList.contains('is-closing')) return;
    markAdClosed(item.getAttribute('data-id'));
    item.classList.add('is-closing');
    setTimeout(function () {
      if (item.parentNode) item.parentNode.removeChild(item);
      if (!slotEl) return;
      const left = slotEl.querySelectorAll('.ad-item').length;
      /* 该位置广告全关完了，连容器一起收掉，不留空白 */
      if (!left) slotEl.remove();
      /* 只剩一条时取消并排，让它独占一行 */
      else if (left === 1) slotEl.classList.remove('is-multi');
    }, 200);
  }

  function mountAds() {
    if (!window.fetch) return;
    view.querySelectorAll('.ad-slot').forEach(function (el) {
      const slot = el.getAttribute('data-slot');
      fetch('/api/ads?slot=' + encodeURIComponent(slot), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { ads: [] }; })
        .then(function (d) { fillAds(el, (d && d.ads) || []); })
        .catch(function () { el.remove(); });
    });
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (e) { /* ignore */ }
      cleanup = null;
    }
    const id = (location.hash || '').replace(/^#/, '') || 'home';
    const tool = TOOLS.find(function (t) { return t.id === id; });
    if (tool) {
      renderTool(tool);
      setActive(tool.id);
      trackPage(tool.id);
    } else {
      renderHome();
      setActive('home');
      trackPage('home');
    }
    view.scrollTop = 0;
  }

  /* ---------------- 菜单管理 ---------------- */
  const I_UP = svg('<path d="M12 19V6"/><path d="M6 12l6-6 6 6"/>');
  const I_DOWN = svg('<path d="M12 5v13"/><path d="M18 12l-6 6-6-6"/>');
  const I_CROSS = svg('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>');
  const I_PLUS = svg('<path d="M12 5v14"/><path d="M5 12h14"/>');

  function buildManage() {
    const hiddenCount = menu.hidden.length;
    let html = '<div class="mg-head"><span>管理菜单</span>' +
      '<small>' + (TOOLS.length - hiddenCount) + ' / ' + TOOLS.length + ' 已显示</small></div>';

    groups(true).forEach(function (g) {
      const on = g.items.filter(function (t) { return !isHidden(t.id); });
      const off = g.items.filter(function (t) { return isHidden(t.id); });
      if (!on.length && !off.length) return;

      html += '<div class="nav-group mg-group" data-group="' + g.name + '">' +
        '<div class="nav-group-title">' + g.name + '</div>';

      on.forEach(function (t, i) {
        html += '<div class="mg-item" data-id="' + t.id + '">' +
          '<span class="mg-ico">' + (ICONS[t.icon] || ICONS.code) + '</span>' +
          '<span class="mg-name">' + t.name + '</span>' +
          '<span class="mg-ops">' +
            '<button type="button" class="mg-btn" data-act="up" title="上移" aria-label="上移"' + (i === 0 ? ' disabled' : '') + '>' + I_UP + '</button>' +
            '<button type="button" class="mg-btn" data-act="down" title="下移" aria-label="下移"' + (i === on.length - 1 ? ' disabled' : '') + '>' + I_DOWN + '</button>' +
            '<button type="button" class="mg-btn mg-danger" data-act="remove" title="从菜单移除" aria-label="从菜单移除">' + I_CROSS + '</button>' +
          '</span></div>';
      });

      off.forEach(function (t) {
        html += '<div class="mg-item is-off" data-id="' + t.id + '">' +
          '<span class="mg-ico">' + (ICONS[t.icon] || ICONS.code) + '</span>' +
          '<span class="mg-name">' + t.name + '</span>' +
          '<span class="mg-ops">' +
            '<button type="button" class="mg-btn mg-add" data-act="add" title="添加到菜单" aria-label="添加到菜单">' + I_PLUS + '</button>' +
          '</span></div>';
      });

      html += '</div>';
    });

    nav.innerHTML = html;
  }

  /** 在同分组的可见工具之间交换位置 */
  function moveItem(id, dir) {
    const tool = TOOLS.find(function (t) { return t.id === id; });
    if (!tool) return;
    const peers = sortByMenu(TOOLS.filter(function (t) {
      return t.group === tool.group && !isHidden(t.id);
    }));
    const i = peers.findIndex(function (t) { return t.id === id; });
    const j = i + dir;
    if (i < 0 || j < 0 || j >= peers.length) return;

    const a = menu.order.indexOf(peers[i].id);
    const b = menu.order.indexOf(peers[j].id);
    if (a < 0 || b < 0) return;
    menu.order[a] = peers[j].id;
    menu.order[b] = peers[i].id;
  }

  function resetMenu() {
    menu = defaultMenu();
    saveMenu();
  }

  /** 重建管理列表并保持滚动位置，避免操作后列表跳动 */
  function refreshManage() {
    const top = nav.scrollTop;
    buildManage();
    nav.scrollTop = top;
  }

  function setManaging(on) {
    managing = on;
    document.body.classList.toggle('managing', on);
    menuBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    menuBar.hidden = !on;
    searchInput.value = '';
    searchInput.disabled = on;

    if (on) {
      buildManage();
      nav.scrollTop = 0;
    } else {
      filterNav('');
      buildNav();
      route();
    }
  }

  nav.addEventListener('click', function (e) {
    if (!managing) return;

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const item = btn.closest('.mg-item');
    if (!item) return;
    const id = item.dataset.id;
    const act = btn.dataset.act;

    if (act === 'up' || act === 'down') {
      moveItem(id, act === 'up' ? -1 : 1);
    } else if (act === 'remove') {
      if (menu.hidden.indexOf(id) < 0) menu.hidden.push(id);
    } else if (act === 'add') {
      menu.hidden = menu.hidden.filter(function (x) { return x !== id; });
    } else {
      return;
    }

    saveMenu();
    refreshManage();
  });

  menuBtn.addEventListener('click', function () {
    setManaging(!managing);
  });

  document.getElementById('menuDone').addEventListener('click', function () {
    setManaging(false);
  });

  document.getElementById('menuReset').addEventListener('click', function () {
    resetMenu();
    refreshManage();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && managing) setManaging(false);
  });

  /* ---------------- 搜索 ---------------- */
  function filterNav(kw) {
    if (managing) return;
    const q = kw.trim().toLowerCase();
    nav.querySelectorAll('.nav-group[data-group]').forEach(function (group) {
      let visible = 0;
      group.querySelectorAll('.nav-item').forEach(function (a) {
        const tool = TOOLS.find(function (t) { return t.id === a.dataset.id; });
        const hay = (a.textContent + ' ' + (tool ? tool.desc : '')).toLowerCase();
        const show = !q || hay.indexOf(q) >= 0;
        a.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      group.style.display = visible ? '' : 'none';
    });
    const homeItem = nav.querySelector('.nav-item[data-id="home"]');
    if (homeItem) {
      homeItem.style.display = q ? 'none' : '';
      homeItem.parentNode.style.display = q ? 'none' : '';
    }
  }

  function firstMatch() {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return TOOLS[0];
    return TOOLS.find(function (t) {
      return (t.name + ' ' + t.desc + ' ' + t.group).toLowerCase().indexOf(q) >= 0;
    });
  }

  searchInput.addEventListener('input', function () { filterNav(searchInput.value); });
  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const t = firstMatch();
      if (t) {
        location.hash = '#' + t.id;
        searchInput.value = '';
        filterNav('');
        searchInput.blur();
      }
    } else if (e.key === 'Escape') {
      searchInput.value = '';
      filterNav('');
      searchInput.blur();
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
  });

  /* ---------------- 主题 ---------------- */
  const root = document.documentElement;
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('dt-theme', theme); } catch (e) { /* ignore */ }
  }
  let saved = null;
  try { saved = localStorage.getItem('dt-theme'); } catch (e) { saved = null; }
  applyTheme(saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  document.getElementById('themeBtn').addEventListener('click', function () {
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------------- 全局复制 ---------------- */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-copy]');
    if (btn) Lib.copy(btn.getAttribute('data-copy'));
  });

  /* 首页「显示全部」按钮 */
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-reset]');
    if (!btn) return;
    e.preventDefault();
    resetMenu();
    if (managing) {
      refreshManage();
    } else {
      buildNav();
      route();
    }
  });

  /* ---------------- 启动 ---------------- */
  window.addEventListener('hashchange', function () {
    if (managing) return;
    route();
  });
  buildNav();
  route();
})();
