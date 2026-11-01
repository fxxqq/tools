/* ==========================================================================
   tools-data.js · JSON 工具 / 时间戳转换 / 进制转换
   ========================================================================== */
(function () {
  'use strict';

  /* ============================ JSON 工具 ============================ */

  function jsonErrorDetail(err, text) {
    const msg = err && err.message ? err.message : String(err);
    const m = msg.match(/position\s+(\d+)/i);
    let out = msg;
    if (m) {
      const pos = parseInt(m[1], 10);
      const before = text.slice(0, pos);
      const line = before.split('\n').length;
      const col = pos - before.lastIndexOf('\n');
      out = '第 ' + line + ' 行第 ' + col + ' 列附近：' + msg.replace(/\s*\(line.*?\)\s*$/, '').replace(/\s*at position \d+/, '');
    }
    return out;
  }

  function deepSortKeys(value) {
    if (Array.isArray(value)) return value.map(deepSortKeys);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).sort(function (a, b) { return a.localeCompare(b, 'zh-Hans-CN'); })
        .forEach(function (k) { out[k] = deepSortKeys(value[k]); });
      return out;
    }
    return value;
  }

  function jsonStats(value) {
    let keys = 0, depth = 1, arrays = 0, nodes = 0;
    (function walk(v, d) {
      nodes++;
      depth = Math.max(depth, d);
      if (Array.isArray(v)) { arrays++; v.forEach(function (x) { walk(x, d + 1); }); }
      else if (v && typeof v === 'object') {
        const ks = Object.keys(v);
        keys += ks.length;
        ks.forEach(function (k) { walk(v[k], d + 1); });
      }
    })(value, 1);
    return { keys: keys, depth: depth, arrays: arrays, nodes: nodes };
  }

  function pascalCase(s) {
    const parts = String(s).split(/[^A-Za-z0-9]+/).filter(Boolean);
    let out = parts.map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join('');
    if (!out) out = 'Type';
    if (/^\d/.test(out)) out = 'T' + out;
    return out;
  }

  function safeKey(k) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
  }

  function jsonToTS(data, rootName) {
    const interfaces = [];
    let uid = 0;

    function typeOf(v, name) {
      if (v === null) return 'null';
      if (Array.isArray(v)) {
        if (!v.length) return 'any[]';
        let inner = 'any';
        const seen = {};
        v.slice(0, 12).forEach(function (item) {
          const t = typeOf(item, name + 'Item');
          seen[t] = true;
        });
        const types = Object.keys(seen);
        inner = types.length === 1 ? types[0] : types.join(' | ');
        return /[|]/.test(inner) ? '(' + inner + ')[]' : inner + '[]';
      }
      if (typeof v === 'object') {
        const ifaceName = pascalCase(name) + (interfaces.some(function (i) { return i.name === pascalCase(name); }) ? ++uid : '');
        const lines = Object.keys(v).map(function (k) {
          return '  ' + safeKey(k) + ': ' + typeOf(v[k], ifaceName + pascalCase(k)) + ';';
        });
        interfaces.push({ name: ifaceName, body: 'export interface ' + ifaceName + ' {\n' + lines.join('\n') + '\n}' });
        return ifaceName;
      }
      if (typeof v === 'string') return 'string';
      if (typeof v === 'number') return 'number';
      if (typeof v === 'boolean') return 'boolean';
      return 'any';
    }

    const rootType = typeOf(data, rootName || 'Root');
    const head = '// 由方寸工具箱 · JSON 工具生成\n';
    const body = interfaces.map(function (i) { return i.body; }).join('\n\n');
    if (rootType && interfaces.length && rootType !== interfaces[interfaces.length - 1].name) {
      return head + 'export type ' + pascalCase(rootName) + 'Data = ' + rootType + ';\n\n' + body;
    }
    return head + body;
  }

  function unescapeJsonString(raw) {
    const s = String(raw).trim();
    try { return JSON.parse(s); } catch (e) { /* next */ }
    try { return JSON.parse('"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'); } catch (e) { /* next */ }
    return s
      .replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
      .replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  registerTool({
    id: 'json',
    name: 'JSON 格式化',
    group: '数据格式',
    icon: 'json',
    desc: '格式化、压缩、校验 JSON，支持键名排序、转义与 TypeScript 类型生成',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="json"></span>JSON 格式化 / 压缩 / 转换</h1>' +
        '<p>粘贴 JSON 即可实时格式化，错误定位到行列；支持压缩、键名排序、字符串转义与 TypeScript 接口生成。数据仅在本机处理。</p></div>' +
        '<div class="grid-2 wide-left">' +
        '  <div class="card">' +
        '    <div class="card-title">输入 <span class="ct-sub" id="jInStat">0 字符</span></div>' +
        '    <textarea class="input big" id="jInput" spellcheck="false" placeholder=\'{"name":"fangcun","version":1,"tags":["json","tool"],"author":{"nick":"dev","mail":"dev@example.com"}}\'></textarea>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <select class="input sm" id="jIndent" style="width:auto"><option value="2">缩进 2 空格</option><option value="4">缩进 4 空格</option><option value="tab">缩进 Tab</option><option value="0">单行</option></select>' +
        '      <button class="btn primary" id="jFormat">格式化</button>' +
        '      <button class="btn" id="jMinify">压缩</button>' +
        '      <button class="btn" id="jValidate">校验</button>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn ghost" id="jSample">示例</button>' +
        '      <button class="btn ghost" id="jClear">清空</button>' +
        '    </div>' +
        '    <div class="hint" id="jStatus" style="margin-top:9px">实时校验中…</div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">输出 <span class="ct-sub" id="jOutStat"></span></div>' +
        '    <textarea class="input big" id="jOutput" readonly spellcheck="false" placeholder="格式化结果会显示在这里"></textarea>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <button class="btn primary" id="jCopy">复制结果</button>' +
        '      <button class="btn" id="jDownload">下载 .json</button>' +
        '    </div>' +
        '    <div class="row tight" style="margin-top:9px">' +
        '      <span class="hint">转换</span>' +
        '      <button class="btn sm" id="jSort">键名排序</button>' +
        '      <button class="btn sm" id="jTs">转 TypeScript</button>' +
        '      <button class="btn sm" id="jEscape">字符串转义</button>' +
        '      <button class="btn sm" id="jUnescape">去转义</button>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="card"><div class="card-title">结构统计</div><div class="stat-row" id="jStats"><span class="hint">等待输入…</span></div></div>';
    },
    mount: function (root) {
      const input = root.querySelector('#jInput');
      const output = root.querySelector('#jOutput');
      const status = root.querySelector('#jStatus');
      const inStat = root.querySelector('#jInStat');
      const outStat = root.querySelector('#jOutStat');
      const statsBox = root.querySelector('#jStats');
      const indentSel = root.querySelector('#jIndent');

      const SAMPLE = JSON.stringify({
        name: 'fangcun', version: '1.0.0', private: true,
        tools: ['json', 'timestamp', 'base64', 'regex'],
        author: { nick: 'dev', mail: 'dev@example.com', socials: [{ name: 'github', url: 'https://github.com' }] },
        stats: { stars: 128, forks: 12, active: true }
      }, null, 2);

      function parseInput() {
        const text = input.value.trim();
        if (!text) throw new Error('请输入 JSON 内容');
        return JSON.parse(text);
      }

      function indentValue() {
        const v = indentSel.value;
        return v === 'tab' ? '\t' : parseInt(v, 10);
      }

      function setStatus(text, type) {
        status.className = 'hint' + (type ? ' ' + type : '');
        status.textContent = text;
      }

      function renderStats(value) {
        const s = jsonStats(value);
        const kinds = { object: '对象', array: '数组', string: '字符串', number: '数字', boolean: '布尔', null: 'null' };
        const items = [
          ['类型', kinds[value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value] || typeof value],
          ['键总数', s.keys],
          ['嵌套深度', s.depth],
          ['数组数', s.arrays],
          ['节点数', s.nodes]
        ];
        statsBox.innerHTML = items.map(function (i) {
          return '<span class="pill">' + i[0] + ' <b class="mono" style="color:var(--text);font-weight:600">' + i[1] + '</b></span>';
        }).join('');
      }

      function run(mode) {
        const text = input.value;
        inStat.textContent = text.length + ' 字符';
        if (!text.trim()) {
          output.value = '';
          outStat.textContent = '';
          statsBox.innerHTML = '<span class="hint">等待输入…</span>';
          setStatus('粘贴 JSON 后自动格式化');
          return;
        }
        try {
          const value = parseInput();
          let result;
          if (mode === 'minify') result = JSON.stringify(value);
          else if (mode === 'ts') result = jsonToTS(value, 'Root');
          else if (mode === 'sort') result = JSON.stringify(deepSortKeys(value), null, indentValue());
          else result = JSON.stringify(value, null, mode === 'format' ? indentValue() : indentValue());

          if (mode !== 'ts') output.value = result;
          else output.value = result;
          outStat.textContent = result.length + ' 字符';
          if (mode === 'format' || !mode) {
            setStatus('✓ JSON 合法，已格式化', 'ok');
          }
          renderStats(value);
        } catch (err) {
          const detail = jsonErrorDetail(err, text);
          if (String(err.message).indexOf('请输入') === 0) {
            setStatus('请输入内容', 'warn');
          } else {
            setStatus('✗ ' + detail, 'err');
            outStat.textContent = '';
          }
          statsBox.innerHTML = '<span class="hint err">解析失败，无法统计结构</span>';
        }
      }

      const live = Lib.debounce(function () { run('format'); }, 260);
      input.addEventListener('input', live);
      indentSel.addEventListener('change', function () { run('format'); });

      root.querySelector('#jFormat').addEventListener('click', function () { run('format'); });
      root.querySelector('#jMinify').addEventListener('click', function () { run('minify'); });
      root.querySelector('#jSort').addEventListener('click', function () { run('sort'); });
      root.querySelector('#jTs').addEventListener('click', function () { run('ts'); });
      root.querySelector('#jValidate').addEventListener('click', function () {
        try {
          const v = parseInput();
          renderStats(v);
          setStatus('✓ JSON 合法，可以正常解析', 'ok');
        } catch (err) {
          setStatus('✗ ' + jsonErrorDetail(err, input.value), 'err');
        }
      });
      root.querySelector('#jCopy').addEventListener('click', function () { Lib.copy(output.value, '结果已复制'); });
      root.querySelector('#jDownload').addEventListener('click', function () {
        if (!output.value) return Lib.toast('没有可下载的内容', 'err');
        Lib.downloadText(output.value, 'data.json', 'application/json;charset=utf-8');
        Lib.toast('已开始下载 data.json', 'ok');
      });
      root.querySelector('#jSample').addEventListener('click', function () {
        input.value = SAMPLE;
        run('format');
      });
      root.querySelector('#jClear').addEventListener('click', function () {
        input.value = '';
        run('format');
        input.focus();
      });
      root.querySelector('#jEscape').addEventListener('click', function () {
        const s = input.value.trim();
        if (!s) return Lib.toast('请先输入内容', 'err');
        output.value = JSON.stringify(s).slice(1, -1);
        outStat.textContent = output.value.length + ' 字符';
        setStatus('已转义为 JSON 字符串内容（不含首尾引号）', 'ok');
      });
      root.querySelector('#jUnescape').addEventListener('click', function () {
        const s = input.value.trim();
        if (!s) return Lib.toast('请先输入内容', 'err');
        output.value = unescapeJsonString(s);
        outStat.textContent = output.value.length + ' 字符';
        setStatus('已去掉转义字符', 'ok');
      });

      run('format');
    }
  });

  /* ============================ 时间戳转换 ============================ */

  function normalizeTs(raw) {
    const s = String(raw).trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error('请输入纯数字时间戳，例如 1735689600');
    const n = Number(s);
    const abs = Math.abs(n);
    let ms, unit;
    if (abs >= 1e15) { ms = n / 1000; unit = '微秒'; }
    else if (abs >= 1e11) { ms = n; unit = '毫秒'; }
    else { ms = n * 1000; unit = '秒'; }
    return { ms: ms, unit: unit };
  }

  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function relativeTime(d) {
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const units = [[31536000000, '年'], [2592000000, '个月'], [604800000, '周'], [86400000, '天'],
      [3600000, '小时'], [60000, '分钟'], [1000, '秒']];
    for (let i = 0; i < units.length; i++) {
      if (abs >= units[i][0]) {
        const v = Math.round(abs / units[i][0]);
        return diff < 0 ? v + ' ' + units[i][1] + '前' : v + ' ' + units[i][1] + '后';
      }
    }
    return '刚刚';
  }

  function utcString(d) {
    return d.getUTCFullYear() + '-' + Lib.pad2(d.getUTCMonth() + 1) + '-' + Lib.pad2(d.getUTCDate()) +
      ' ' + Lib.pad2(d.getUTCHours()) + ':' + Lib.pad2(d.getUTCMinutes()) + ':' + Lib.pad2(d.getUTCSeconds());
  }

  function resRow(label, value) {
    return '<div class="res-row"><span class="res-label">' + label + '</span>' +
      '<span class="res-value">' + Lib.escapeHtml(value) + '</span>' +
      '<span class="res-actions"><button class="btn sm" data-copy="' + Lib.escapeHtml(value) + '">复制</button></span></div>';
  }

  registerTool({
    id: 'timestamp',
    name: '时间戳转换',
    group: '数据格式',
    icon: 'clock',
    desc: 'Unix 时间戳与日期互转，支持秒 / 毫秒 / 微秒自动识别',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="clock"></span>时间戳转换</h1>' +
        '<p>Unix 时间戳 ↔ 本地时间，自动识别 10 位（秒）与 13 位（毫秒）；同时给出 UTC、ISO 8601 与相对时间。</p></div>' +
        '<div class="card">' +
        '  <div class="card-title">当前时间戳 <span class="ct-sub">每秒自动刷新</span></div>' +
        '  <div class="ts-hero">' +
        '    <div><div class="ts-num" id="tNow">—</div><div class="ts-date" id="tNowDate">—</div></div>' +
        '    <span class="spacer"></span>' +
        '    <div class="row tight">' +
        '      <div class="tabs" id="tUnit"><button data-unit="s" class="active">秒</button><button data-unit="ms">毫秒</button></div>' +
        '      <button class="btn sm" id="tCopyNow">复制</button>' +
        '      <button class="btn sm" id="tUseNow">填入下方</button>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="grid-2">' +
        '  <div class="card">' +
        '    <div class="card-title">时间戳 → 日期</div>' +
        '    <div class="row"><input class="input mono" id="tInput" placeholder="1735689600 或 1735689600000" style="flex:1"><button class="btn primary" id="tConvert">转换</button></div>' +
        '    <div class="hint" id="tHint" style="margin:8px 0 4px">支持负数（1970 年之前）</div>' +
        '    <div class="res-list" id="tResult"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">日期 → 时间戳</div>' +
        '    <div class="field" style="margin-bottom:10px"><span>选择日期时间（本地时区）</span>' +
        '      <input class="input mono" type="datetime-local" id="tDate" step="1">' +
        '    </div>' +
        '    <div class="res-list" id="tDateResult"></div>' +
        '    <div class="hint" style="margin-top:10px">浏览器本地时区：<b class="mono" id="tZone">—</b></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const nowEl = root.querySelector('#tNow');
      const nowDateEl = root.querySelector('#tNowDate');
      const unitTabs = root.querySelector('#tUnit');
      const input = root.querySelector('#tInput');
      const result = root.querySelector('#tResult');
      const hint = root.querySelector('#tHint');
      const dateInput = root.querySelector('#tDate');
      const dateResult = root.querySelector('#tDateResult');
      let unit = 's';

      root.querySelector('#tZone').textContent = (Intl.DateTimeFormat().resolvedOptions().timeZone || '本地') +
        ' (UTC' + (-new Date().getTimezoneOffset() >= 0 ? '+' : '') + (-new Date().getTimezoneOffset() / 60) + ')';

      function tick() {
        const d = new Date();
        nowEl.textContent = unit === 's' ? String(Math.floor(d.getTime() / 1000)) : String(d.getTime());
        nowDateEl.textContent = Lib.formatDate(d) + ' ' + WEEK[d.getDay()];
      }
      tick();
      const timer = setInterval(tick, 1000);

      unitTabs.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b) return;
        unit = b.dataset.unit;
        unitTabs.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        tick();
      });

      root.querySelector('#tCopyNow').addEventListener('click', function () {
        Lib.copy(nowEl.textContent, '当前时间戳已复制');
      });
      root.querySelector('#tUseNow').addEventListener('click', function () {
        input.value = nowEl.textContent;
        convert();
      });

      function convert() {
        const raw = input.value.trim();
        if (!raw) { result.innerHTML = ''; hint.className = 'hint'; hint.textContent = '请输入时间戳'; return; }
        try {
          const r = normalizeTs(raw);
          const d = new Date(r.ms);
          if (isNaN(d.getTime())) throw new Error('时间超出可表示范围');
          hint.className = 'hint';
          hint.innerHTML = '识别为 <b>' + r.unit + '</b> 时间戳';
          result.innerHTML =
            resRow('本地时间', Lib.formatDate(d, true) + ' ' + WEEK[d.getDay()]) +
            resRow('UTC 时间', utcString(d)) +
            resRow('ISO 8601', d.toISOString()) +
            resRow('相对现在', relativeTime(d)) +
            resRow('秒 / 毫秒', Math.floor(r.ms / 1000) + ' / ' + Math.round(r.ms)) +
            resRow('UTC 偏移', 'UTC' + (-d.getTimezoneOffset() >= 0 ? '+' : '') + (-d.getTimezoneOffset() / 60));
        } catch (err) {
          hint.className = 'hint err';
          hint.textContent = '✗ ' + err.message;
          result.innerHTML = '';
        }
      }
      input.addEventListener('input', Lib.debounce(convert, 200));
      root.querySelector('#tConvert').addEventListener('click', convert);

      function fromDate() {
        if (!dateInput.value) { dateResult.innerHTML = ''; return; }
        const d = new Date(dateInput.value);
        if (isNaN(d.getTime())) { dateResult.innerHTML = '<div class="hint err">日期无效</div>'; return; }
        dateResult.innerHTML =
          resRow('秒级时间戳', String(Math.floor(d.getTime() / 1000))) +
          resRow('毫秒时间戳', String(d.getTime())) +
          resRow('ISO 8601', d.toISOString()) +
          resRow('UTC 时间', utcString(d));
      }
      dateInput.addEventListener('input', fromDate);

      const now = new Date();
      const localIso = now.getFullYear() + '-' + Lib.pad2(now.getMonth() + 1) + '-' + Lib.pad2(now.getDate()) +
        'T' + Lib.pad2(now.getHours()) + ':' + Lib.pad2(now.getMinutes()) + ':' + Lib.pad2(now.getSeconds());
      dateInput.value = localIso;
      fromDate();

      input.value = String(Math.floor(Date.now() / 1000));
      convert();

      return function () { clearInterval(timer); };
    }
  });

  /* ============================ 进制转换 ============================ */

  function parseBigInt(str, base) {
    let s = String(str).trim().replace(/[\s_,]/g, '').toLowerCase();
    let neg = false;
    if (s.charAt(0) === '-') { neg = true; s = s.slice(1); }
    else if (s.charAt(0) === '+') s = s.slice(1);
    if (base === 16 && s.indexOf('0x') === 0) s = s.slice(2);
    if (base === 2 && s.indexOf('0b') === 0) s = s.slice(2);
    if (base === 8 && s.indexOf('0o') === 0) s = s.slice(2);
    if (!s) throw new Error('请输入数字');
    const B = BigInt(base);
    let v = 0n;
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      const d = parseInt(ch, 36);
      if (isNaN(d) || d >= base) throw new Error('字符 “' + ch + '” 不属于 ' + base + ' 进制');
      v = v * B + BigInt(d);
    }
    return neg ? -v : v;
  }

  registerTool({
    id: 'radix',
    name: '进制转换',
    group: '编解码',
    icon: 'binary',
    desc: '二 / 八 / 十 / 十六进制互转，基于 BigInt 支持任意大整数',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="binary"></span>进制转换</h1>' +
        '<p>支持 2–36 进制互转，采用 BigInt 运算，超大整数也不会丢失精度。</p></div>' +
        '<div class="card">' +
        '  <div class="card-title">输入</div>' +
        '  <div class="row">' +
        '    <input class="input mono" id="rInput" value="255" placeholder="输入数字" style="flex:1;min-width:180px" spellcheck="false">' +
        '    <select class="input" id="rBase" style="width:150px">' +
        '      <option value="2">二进制 (2)</option><option value="8">八进制 (8)</option>' +
        '      <option value="10" selected>十进制 (10)</option><option value="16">十六进制 (16)</option>' +
        '      <option value="custom">自定义…</option>' +
        '    </select>' +
        '    <input class="input mono" id="rCustom" type="number" min="2" max="36" value="36" style="width:86px;display:none" title="自定义进制 2-36">' +
        '  </div>' +
        '  <div class="hint" id="rHint" style="margin-top:8px">支持 0x / 0b / 0o 前缀与下划线分隔</div>' +
        '</div>' +
        '<div class="card">' +
        '  <div class="card-title">转换结果 <span class="ct-sub">点击右侧按钮复制</span></div>' +
        '  <div class="res-list" id="rResult"></div>' +
        '</div>' +
        '<div class="card"><div class="card-title">位信息</div><div class="stat-row" id="rBits"><span class="hint">等待输入…</span></div>' +
        '  <div class="hint" id="rBin" style="margin-top:10px;word-break:break-all;line-height:1.9"></div></div>';
    },
    mount: function (root) {
      const input = root.querySelector('#rInput');
      const baseSel = root.querySelector('#rBase');
      const custom = root.querySelector('#rCustom');
      const result = root.querySelector('#rResult');
      const hint = root.querySelector('#rHint');
      const bits = root.querySelector('#rBits');
      const binLine = root.querySelector('#rBin');

      function currentBase() {
        return baseSel.value === 'custom' ? Math.min(36, Math.max(2, parseInt(custom.value, 10) || 2)) : parseInt(baseSel.value, 10);
      }

      function render() {
        const base = currentBase();
        hint.className = 'hint';
        hint.textContent = '当前源进制：' + base + '　·　支持 0x / 0b / 0o 前缀与下划线分隔';
        try {
          const v = parseBigInt(input.value, base);
          const bases = [
            ['2 进制', 2, 'BIN'], ['8 进制', 8, 'OCT'], ['10 进制', 10, 'DEC'],
            ['16 进制', 16, 'HEX'], ['36 进制', 36, 'B36']
          ];
          result.innerHTML = bases.map(function (b) {
            const str = v.toString(b[1]);
            return '<div class="res-row"><span class="res-label">' + b[0] + '</span>' +
              '<span class="res-value">' + Lib.escapeHtml(str) + '</span>' +
              '<span class="res-actions"><button class="btn sm" data-copy="' + Lib.escapeHtml(str) + '">复制</button></span></div>';
          }).join('');

          const absBin = (v < 0n ? -v : v).toString(2);
          const groups = absBin.replace(/\B(?=(.{4})+(?!.))/g, ' ');
          bits.innerHTML = [
            ['十进制位数', v.toString(10).replace('-', '').length],
            ['二进制位', absBin.length],
            ['字节数', Math.ceil(absBin.length / 8)],
            ['符号', v < 0n ? '负数' : '正数']
          ].map(function (i) {
            return '<span class="pill">' + i[0] + ' <b class="mono" style="color:var(--text);font-weight:600">' + i[1] + '</b></span>';
          }).join('');
          binLine.innerHTML = '<span class="hint">二进制分组（4 位）：</span><br>' +
            Lib.escapeHtml((v < 0n ? '-' : '') + groups);
        } catch (err) {
          hint.className = 'hint err';
          hint.textContent = '✗ ' + err.message;
          result.innerHTML = '';
          bits.innerHTML = '<span class="hint">—</span>';
          binLine.innerHTML = '';
        }
      }

      baseSel.addEventListener('change', function () {
        const isCustom = baseSel.value === 'custom';
        custom.style.display = isCustom ? '' : 'none';
        render();
      });
      custom.addEventListener('input', render);
      input.addEventListener('input', Lib.debounce(render, 120));
      render();
    }
  });
})();
