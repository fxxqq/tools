/* ==========================================================================
   tools-text.js · 编解码 / 正则测试 / 代码格式化 / 随机字符串
   ========================================================================== */
(function () {
  'use strict';

  const esc = function (s) { return Lib.escapeHtml(s); };

  /* ============================ 编解码 ============================ */

  registerTool({
    id: 'codec',
    name: '加密 / 编码',
    group: '编解码',
    icon: 'lock',
    desc: 'Base64 编码解码（含 URL 安全）、URL / Hex / Unicode 转码与 MD5 / SHA-1 / SHA-256 哈希',
    seoTitle: 'Base64 编解码 - 在线编码解码、URL 安全与哈希',
    seoDesc: 'Base64 在线编码与解码，支持中文 UTF-8、URL 安全变体（-_ 无填充），可查看 JWT payload；同时提供 URL 编码、Hex、Unicode 转义与 MD5 / SHA-1 / SHA-256 哈希。全部在浏览器本地运行，明文不上传。',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="lock"></span>加密 / 编码 / 解码</h1>' +
        '<p>常用编码与哈希一站搞定：Base64（支持 URL 安全）、URL 百分号编码、十六进制、Unicode 转义，以及 MD5 / SHA-1 / SHA-256 摘要。</p></div>' +
        '<div class="card">' +
        '  <div class="tabs" id="cTabs">' +
        '    <button data-pane="b64" class="active">Base64</button>' +
        '    <button data-pane="url">URL 编码</button>' +
        '    <button data-pane="hex">Hex</button>' +
        '    <button data-pane="uni">Unicode</button>' +
        '    <button data-pane="hash">哈希</button>' +
        '  </div>' +

        '  <div class="pane active" data-pane="b64">' +
        '    <div class="grid-2">' +
        '      <div><div class="hint" style="margin-bottom:6px">原文（UTF-8）</div>' +
        '        <textarea class="input mid" id="b64In" placeholder="输入要编码的文本" spellcheck="false"></textarea></div>' +
        '      <div><div class="hint" style="margin-bottom:6px">结果</div>' +
        '        <textarea class="input mid" id="b64Out" placeholder="结果" spellcheck="false"></textarea></div>' +
        '    </div>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <button class="btn primary" id="b64Enc">编码</button>' +
        '      <button class="btn" id="b64Dec">解码</button>' +
        '      <button class="btn" id="b64Swap">↑↓ 交换</button>' +
        '      <label class="check"><input type="checkbox" id="b64UrlSafe">URL 安全（-_ 无填充）</label>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn sm" id="b64Copy">复制结果</button>' +
        '      <span class="hint" id="b64Status"></span>' +
        '    </div>' +
        '  </div>' +

        '  <div class="pane" data-pane="url">' +
        '    <div class="grid-2">' +
        '      <div><div class="hint" style="margin-bottom:6px">原文</div>' +
        '        <textarea class="input mid" id="urlIn" placeholder="输入文本或 URL" spellcheck="false"></textarea></div>' +
        '      <div><div class="hint" style="margin-bottom:6px">结果</div>' +
        '        <textarea class="input mid" id="urlOut" placeholder="结果" spellcheck="false"></textarea></div>' +
        '    </div>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <button class="btn primary" id="urlEnc">编码</button>' +
        '      <button class="btn" id="urlDec">解码</button>' +
        '      <select class="input sm" id="urlMode" style="width:auto">' +
        '        <option value="component">encodeURIComponent（整段参数）</option>' +
        '        <option value="uri">encodeURI（完整 URL）</option>' +
        '      </select>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn sm" id="urlCopy">复制结果</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="pane" data-pane="hex">' +
        '    <div class="grid-2">' +
        '      <div><div class="hint" style="margin-bottom:6px">原文 / 十六进制</div>' +
        '        <textarea class="input mid" id="hexIn" placeholder="文本或 48 65 6c 6c 6f" spellcheck="false"></textarea></div>' +
        '      <div><div class="hint" style="margin-bottom:6px">结果</div>' +
        '        <textarea class="input mid" id="hexOut" placeholder="结果" spellcheck="false"></textarea></div>' +
        '    </div>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <button class="btn primary" id="hexEnc">文本 → Hex</button>' +
        '      <button class="btn" id="hexDec">Hex → 文本</button>' +
        '      <label class="check"><input type="checkbox" id="hexUpper" checked>大写</label>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn sm" id="hexCopy">复制结果</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="pane" data-pane="uni">' +
        '    <div class="grid-2">' +
        '      <div><div class="hint" style="margin-bottom:6px">原文 / 转义串</div>' +
        '        <textarea class="input mid" id="uniIn" placeholder="你好 或 \\u4f60\\u597d" spellcheck="false"></textarea></div>' +
        '      <div><div class="hint" style="margin-bottom:6px">结果</div>' +
        '        <textarea class="input mid" id="uniOut" placeholder="结果" spellcheck="false"></textarea></div>' +
        '    </div>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <button class="btn primary" id="uniEnc">文本 → \\uXXXX</button>' +
        '      <button class="btn" id="uniDec">\\uXXXX → 文本</button>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn sm" id="uniCopy">复制结果</button>' +
        '    </div>' +
        '  </div>' +

        '  <div class="pane" data-pane="hash">' +
        '    <div class="hint" style="margin-bottom:6px">输入文本，实时计算摘要</div>' +
        '    <textarea class="input mid" id="hashIn" placeholder="输入任意文本" spellcheck="false"></textarea>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <label class="check"><input type="checkbox" id="hashUpper">输出大写</label>' +
        '      <span class="spacer"></span>' +
        '      <span class="hint" id="hashMeta"></span>' +
        '    </div>' +
        '    <div class="res-list" id="hashOut" style="margin-top:6px"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      /* tabs */
      const tabs = root.querySelector('#cTabs');
      tabs.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b) return;
        tabs.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        root.querySelectorAll('.pane').forEach(function (p) {
          p.classList.toggle('active', p.dataset.pane === b.dataset.pane);
        });
      });

      /* Base64 */
      const b64In = root.querySelector('#b64In');
      const b64Out = root.querySelector('#b64Out');
      const b64Status = root.querySelector('#b64Status');
      const urlSafe = root.querySelector('#b64UrlSafe');
      root.querySelector('#b64Enc').addEventListener('click', function () {
        try {
          b64Out.value = Lib.b64encode(b64In.value, urlSafe.checked);
          b64Status.textContent = b64Out.value.length + ' 字符';
        } catch (e) { Lib.toast('编码失败：' + e.message, 'err'); }
      });
      root.querySelector('#b64Dec').addEventListener('click', function () {
        try {
          b64Out.value = Lib.b64decode(b64In.value);
          b64Status.textContent = '解码成功';
        } catch (e) {
          b64Status.textContent = '解码失败';
          Lib.toast('不是合法的 Base64：' + e.message, 'err');
        }
      });
      root.querySelector('#b64Swap').addEventListener('click', function () {
        const t = b64In.value; b64In.value = b64Out.value; b64Out.value = t;
      });
      root.querySelector('#b64Copy').addEventListener('click', function () { Lib.copy(b64Out.value); });
      urlSafe.addEventListener('change', function () {
        if (b64Out.value) root.querySelector('#b64Enc').click();
      });

      /* URL */
      const urlIn = root.querySelector('#urlIn');
      const urlOut = root.querySelector('#urlOut');
      const urlMode = root.querySelector('#urlMode');
      root.querySelector('#urlEnc').addEventListener('click', function () {
        try {
          urlOut.value = urlMode.value === 'uri' ? encodeURI(urlIn.value) : encodeURIComponent(urlIn.value);
        } catch (e) { Lib.toast('编码失败：' + e.message, 'err'); }
      });
      root.querySelector('#urlDec').addEventListener('click', function () {
        try {
          urlOut.value = urlMode.value === 'uri' ? decodeURI(urlIn.value) : decodeURIComponent(urlIn.value);
        } catch (e) { Lib.toast('解码失败：' + e.message, 'err'); }
      });
      root.querySelector('#urlCopy').addEventListener('click', function () { Lib.copy(urlOut.value); });

      /* Hex */
      const hexIn = root.querySelector('#hexIn');
      const hexOut = root.querySelector('#hexOut');
      const hexUpper = root.querySelector('#hexUpper');
      root.querySelector('#hexEnc').addEventListener('click', function () {
        let h = Lib.bytesToHex(Lib.utf8Bytes(hexIn.value));
        hexOut.value = hexUpper.checked ? h.toUpperCase() : h;
      });
      root.querySelector('#hexDec').addEventListener('click', function () {
        try { hexOut.value = Lib.bytesToText(Lib.hexToBytes(hexIn.value)); }
        catch (e) { Lib.toast(e.message, 'err'); }
      });
      root.querySelector('#hexCopy').addEventListener('click', function () { Lib.copy(hexOut.value); });

      /* Unicode */
      const uniIn = root.querySelector('#uniIn');
      const uniOut = root.querySelector('#uniOut');
      root.querySelector('#uniEnc').addEventListener('click', function () {
        let out = '';
        for (let i = 0; i < uniIn.value.length; i++) {
          const code = uniIn.value.charCodeAt(i).toString(16).padStart(4, '0');
          out += '\\u' + code;
        }
        uniOut.value = out;
      });
      root.querySelector('#uniDec').addEventListener('click', function () {
        uniOut.value = uniIn.value
          .replace(/\\u\{([0-9a-fA-F]+)\}/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
          .replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); });
      });
      root.querySelector('#uniCopy').addEventListener('click', function () { Lib.copy(uniOut.value); });

      /* Hash */
      const hashIn = root.querySelector('#hashIn');
      const hashOut = root.querySelector('#hashOut');
      const hashUpper = root.querySelector('#hashUpper');
      const hashMeta = root.querySelector('#hashMeta');
      function renderHash() {
        const text = hashIn.value;
        const algo = [['MD5', Lib.md5(text), 32], ['SHA-1', Lib.sha1(text), 40], ['SHA-256', Lib.sha256(text), 64]];
        hashOut.innerHTML = algo.map(function (a) {
          let v = hashUpper.checked ? a[1].toUpperCase() : a[1];
          return '<div class="res-row"><span class="res-label">' + a[0] + '</span>' +
            '<span class="res-value">' + esc(v) + '</span>' +
            '<span class="res-actions"><button class="btn sm" data-copy="' + esc(v) + '">复制</button></span></div>';
        }).join('');
        hashMeta.textContent = text ? ('共 ' + text.length + ' 字符 / ' + Lib.utf8Bytes(text).length + ' 字节') : '等待输入';
      }
      hashIn.addEventListener('input', renderHash);
      hashUpper.addEventListener('change', renderHash);
      renderHash();
    }
  });

  /* ============================ 正则测试 ============================ */

  const REGEX_PRESETS = [
    { name: '邮箱', p: '^[\\w.+-]+@[\\w-]+\\.[\\w.-]+$' },
    { name: '手机号', p: '^1[3-9]\\d{9}$' },
    { name: 'URL', p: 'https?://[\\w.-]+(?:\\.[a-z]{2,})[^\\s]*' },
    { name: 'IPv4', p: '\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b' },
    { name: '身份证', p: '^\\d{17}[\\dXx]$' },
    { name: '日期', p: '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])$' },
    { name: '中文字符', p: '[\\u4e00-\\u9fa5]+' },
    { name: 'HTML 标签', p: '</?[\\w-]+[^>]*>' }
  ];

  registerTool({
    id: 'regex',
    name: '正则测试',
    group: '文本处理',
    icon: 'regex',
    desc: '实时匹配高亮、分组详情与替换预览，内置常用正则模板',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="regex"></span>正则表达式测试</h1>' +
        '<p>实时匹配并高亮结果，展示每个匹配的位置与捕获组，支持替换预览。执行超过 2000 次匹配会自动截断。</p></div>' +
        '<div class="card">' +
        '  <div class="row" style="gap:0">' +
        '    <span class="mono" style="padding:0 4px 0 10px;color:var(--muted);font-size:15px">/</span>' +
        '    <input class="input mono" id="rePattern" placeholder="输入正则表达式，例如 \\d+" style="flex:1;border-radius:0;border-left:0;border-right:0" spellcheck="false">' +
        '    <span class="mono" style="padding:0 10px 0 4px;color:var(--muted);font-size:15px">/</span>' +
        '    <input class="input mono" id="reFlagsText" placeholder="gi" style="width:72px" spellcheck="false">' +
        '  </div>' +
        '  <div class="row" style="margin-top:10px">' +
        '    <label class="check"><input type="checkbox" data-flag="g" checked>g 全局</label>' +
        '    <label class="check"><input type="checkbox" data-flag="i">i 忽略大小写</label>' +
        '    <label class="check"><input type="checkbox" data-flag="m">m 多行</label>' +
        '    <label class="check"><input type="checkbox" data-flag="s">s 点匹配换行</label>' +
        '    <label class="check"><input type="checkbox" data-flag="u">u Unicode</label>' +
        '    <span class="spacer"></span>' +
        '    <span class="hint" id="reStatus"></span>' +
        '  </div>' +
        '  <div class="chips" style="margin-top:12px" id="rePresets">' +
        REGEX_PRESETS.map(function (r) {
          return '<button class="chip" data-pattern="' + esc(r.p) + '">' + r.name + '</button>';
        }).join('') +
        '  </div>' +
        '</div>' +
        '<div class="grid-2">' +
        '  <div class="card">' +
        '    <div class="card-title">测试文本 <span class="ct-sub" id="reTextMeta"></span></div>' +
        '    <textarea class="input mid" id="reText" spellcheck="false" placeholder="粘贴要匹配的文本…">联系方式：dev@example.com，备用 ops@test.cn，电话 13800138000。\n订单号 A20241108-001，日期 2024-11-08。</textarea>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">高亮预览 <span class="ct-sub" id="reCount"></span></div>' +
        '    <div class="regex-view" id="reView"></div>' +
        '  </div>' +
        '</div>' +
        '<div class="card">' +
        '  <div class="card-title">匹配详情</div>' +
        '  <div class="table-wrap"><table class="mt" id="reTable"><thead><tr><th style="width:44px">#</th><th style="width:70px">位置</th><th>匹配内容</th><th style="width:36%">捕获组</th></tr></thead><tbody></tbody></table></div>' +
        '</div>' +
        '<div class="card">' +
        '  <div class="card-title">替换预览</div>' +
        '  <div class="row"><input class="input mono" id="reReplace" placeholder="替换为…支持 $1、$&amp; 等语法" style="flex:1"></div>' +
        '  <textarea class="input mid" id="reReplaceOut" readonly style="margin-top:10px" placeholder="替换结果"></textarea>' +
        '  <div class="row" style="margin-top:8px"><button class="btn sm" id="reReplaceCopy">复制替换结果</button></div>' +
        '</div>';
    },
    mount: function (root) {
      const pattern = root.querySelector('#rePattern');
      const flagsText = root.querySelector('#reFlagsText');
      const text = root.querySelector('#reText');
      const view = root.querySelector('#reView');
      const tableBody = root.querySelector('#reTable tbody');
      const status = root.querySelector('#reStatus');
      const countEl = root.querySelector('#reCount');
      const textMeta = root.querySelector('#reTextMeta');
      const replaceInput = root.querySelector('#reReplace');
      const replaceOut = root.querySelector('#reReplaceOut');
      const flagBoxes = root.querySelectorAll('[data-flag]');

      function flags() {
        let f = '';
        flagBoxes.forEach(function (b) { if (b.checked) f += b.dataset.flag; });
        return f;
      }

      function syncFlagText() {
        flagsText.value = flags();
      }

      function run() {
        const p = pattern.value;
        const f = flags();
        const t = text.value;
        textMeta.textContent = t.length + ' 字符';
        replaceOut.value = '';
        if (!p) {
          view.innerHTML = '<span class="hint">输入正则表达式后开始匹配</span>';
          tableBody.innerHTML = '';
          countEl.textContent = '';
          status.className = 'hint';
          status.textContent = '';
          replaceOut.value = t;
          return;
        }
        let re;
        try {
          re = new RegExp(p, f);
        } catch (err) {
          status.className = 'hint err';
          status.textContent = '✗ 正则语法错误：' + err.message;
          view.innerHTML = '';
          tableBody.innerHTML = '';
          countEl.textContent = '';
          return;
        }
        const flagsWithG = f.indexOf('g') >= 0 ? f : f + 'g';
        let globalRe;
        try { globalRe = new RegExp(p, flagsWithG); } catch (e) { globalRe = re; }

        let html = '', last = 0, matches = [], m;
        const LIMIT = 2000;
        globalRe.lastIndex = 0;
        while ((m = globalRe.exec(t)) !== null) {
          matches.push({ index: m.index, value: m[0], groups: m.slice(1) });
          if (matches.length >= LIMIT) break;
          if (m[0].length === 0) globalRe.lastIndex++;
        }
        matches.forEach(function (mt) {
          html += esc(t.slice(last, mt.index));
          html += '<mark>' + (mt.value === '' ? '​' : esc(mt.value)) + '</mark>';
          last = mt.index + mt.value.length;
        });
        html += esc(t.slice(last));
        view.innerHTML = html || '<span class="hint">（无内容）</span>';

        tableBody.innerHTML = matches.slice(0, 200).map(function (mt, i) {
          const groups = mt.groups.length
            ? mt.groups.map(function (g, gi) { return '<span class="pill" style="margin-right:4px">$' + (gi + 1) + ': ' + esc(g == null ? 'undefined' : g) + '</span>'; }).join('')
            : '<span class="hint">—</span>';
          return '<tr><td class="mono">' + (i + 1) + '</td><td class="mono">' + mt.index + '</td>' +
            '<td class="mono">' + (mt.value === '' ? '<span class="hint">空匹配</span>' : esc(mt.value)) + '</td><td>' + groups + '</td></tr>';
        }).join('');

        const total = matches.length;
        countEl.textContent = total ? ('共 ' + total + ' 处匹配' + (total >= LIMIT ? '（已截断）' : '')) : '无匹配';
        status.className = 'hint ' + (total ? 'ok' : '');
        status.textContent = total ? '✓ 表达式有效' : '表达式有效，但没有匹配项';

        try {
          const rr = new RegExp(p, f);
          replaceOut.value = t.replace(rr, replaceInput.value);
        } catch (e) { replaceOut.value = ''; }
      }

      const live = Lib.debounce(run, 180);
      pattern.addEventListener('input', live);
      text.addEventListener('input', live);
      replaceInput.addEventListener('input', Lib.debounce(run, 180));
      flagBoxes.forEach(function (b) {
        b.addEventListener('change', function () { syncFlagText(); run(); });
      });
      flagsText.addEventListener('change', function () {
        const val = flagsText.value.replace(/[^gimsu]/g, '');
        flagsText.value = val;
        flagBoxes.forEach(function (b) { b.checked = val.indexOf(b.dataset.flag) >= 0; });
        run();
      });

      root.querySelector('#rePresets').addEventListener('click', function (e) {
        const b = e.target.closest('.chip');
        if (!b) return;
        pattern.value = b.dataset.pattern;
        pattern.focus();
        run();
      });

      root.querySelector('#reReplaceCopy').addEventListener('click', function () { Lib.copy(replaceOut.value); });

      syncFlagText();
      pattern.value = '(\\w+)@(\\w+\\.\\w+)';
      run();
    }
  });

  /* ============================ 代码格式化 ============================ */

  function tokenizeJS(src) {
    const toks = [];
    let i = 0;
    const isWordStart = function (c) { return /[A-Za-z_$\u00A0-\uFFFF]/.test(c); };
    const isWordPart = function (c) { return /[A-Za-z0-9_$\u00A0-\uFFFF]/.test(c); };
    const ops = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>',
      '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
      '&=', '|=', '^=', '**', '<<', '>>'];
    while (i < src.length) {
      const c = src.charAt(i);
      if (c === '/' && src.charAt(i + 1) === '/') {
        let j = src.indexOf('\n', i); if (j < 0) j = src.length;
        toks.push({ t: 'comment', v: src.slice(i, j) }); i = j; continue;
      }
      if (c === '/' && src.charAt(i + 1) === '*') {
        let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2;
        toks.push({ t: 'comment', v: src.slice(i, j) }); i = j; continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        let j = i + 1;
        while (j < src.length) {
          if (src.charAt(j) === '\\') { j += 2; continue; }
          if (src.charAt(j) === c) { j++; break; }
          j++;
        }
        toks.push({ t: 'string', v: src.slice(i, j) }); i = j; continue;
      }
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src.charAt(i + 1)))) {
        let j = i;
        while (j < src.length && /[0-9a-fA-FxXoObBeE._]/.test(src.charAt(j))) j++;
        toks.push({ t: 'number', v: src.slice(i, j) }); i = j; continue;
      }
      if (isWordStart(c)) {
        let j = i;
        while (j < src.length && isWordPart(src.charAt(j))) j++;
        toks.push({ t: 'word', v: src.slice(i, j) }); i = j; continue;
      }
      let op = null;
      for (let k = 0; k < ops.length; k++) {
        if (src.startsWith(ops[k], i)) { op = ops[k]; break; }
      }
      if (op) { toks.push({ t: 'op', v: op }); i += op.length; continue; }
      toks.push({ t: 'op', v: c }); i++;
    }
    return toks;
  }

  function beautifyJS(src, unit) {
    const toks = tokenizeJS(src);
    let out = '', ind = 0, paren = 0, prev = null, forceSpace = false;
    const CONTROL = ['if', 'for', 'while', 'switch', 'catch', 'with'];
    const ELSE_LIKE = ['else', 'catch', 'finally', 'while'];
    const atLineStart = function () { return out === '' || out.endsWith('\n'); };
    const write = function (s, space) {
      if (atLineStart()) out += unit.repeat(Math.max(ind, 0)) + s;
      else out += ((space || forceSpace) ? ' ' : '') + s;
      forceSpace = false;
    };
    const nl = function () {
      out = out.replace(/[ \t]+$/, '');
      if (out && !out.endsWith('\n')) out += '\n';
    };

    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      const nx = toks[i + 1];
      if (tk.t === 'comment') {
        if (!atLineStart()) nl();
        write(tk.v);
        nl();
        prev = tk;
        continue;
      }
      if (tk.t === 'string' || tk.t === 'number' || tk.t === 'word') {
        let space = false;
        if (prev) {
          if (prev.t === 'string' || prev.t === 'number' || prev.t === 'word') space = true;
          if (prev.t === 'op' && (prev.v === ')' || prev.v === ']')) space = true;
        }
        write(tk.v, space);
        prev = tk;
        continue;
      }
      const v = tk.v;
      if (v === '{') {
        const space = prev && !(prev.t === 'op' && ['(', '[', '{', '!', '=>', ':', ','].indexOf(prev.v) >= 0);
        write('{', !!space);
        if (nx && nx.t === 'op' && nx.v === '}') { prev = tk; continue; }
        ind++; nl(); prev = tk; continue;
      }
      if (v === '}') {
        ind = Math.max(0, ind - 1);
        nl(); write('}');
        if (nx && nx.t === 'op' && [';', ',', ')', ']', '}'].indexOf(nx.v) >= 0) { /* 保持同一行 */ }
        else if (nx && ((nx.t === 'word' && ELSE_LIKE.indexOf(nx.v) >= 0))) { forceSpace = true; }
        else nl();
        prev = tk; continue;
      }
      if (v === ';') {
        write(';');
        if (paren > 0) forceSpace = true; else nl();
        prev = tk; continue;
      }
      if (v === ',') { write(','); forceSpace = true; prev = tk; continue; }
      if (v === '(') {
        const space = prev && prev.t === 'word' && CONTROL.indexOf(prev.v) >= 0;
        write('(', !!space); paren++; prev = tk; continue;
      }
      if (v === ')') { paren = Math.max(0, paren - 1); write(')'); prev = tk; continue; }
      if (v === '[') { write('['); prev = tk; continue; }
      if (v === ']') { write(']'); prev = tk; continue; }
      if (v === '.') { write('.'); prev = tk; continue; }
      if (v === ':') { write(':'); forceSpace = true; prev = tk; continue; }
      if (v === '++' || v === '--') { write(v, false); prev = tk; continue; }
      if (v === '!') { write('!', false); prev = tk; continue; }
      write(v, true);
      forceSpace = true;
      prev = tk;
    }
    return out.replace(/\{\n\s*\}/g, '{}').replace(/\n{3,}/g, '\n\n').trim();
  }

  function beautifyHTML(src, unit) {
    const VOID = 'area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr'.split(',');
    const RAW = ['script', 'style', 'pre', 'textarea'];
    const lines = [];
    let ind = 0, i = 0;
    const pad = function () { return unit.repeat(Math.max(ind, 0)); };
    const pushLine = function (s) {
      s = s.trim();
      if (s) lines.push(pad() + s);
    };
    while (i < src.length) {
      if (src.charAt(i) === '<') {
        if (src.startsWith('<!--', i)) {
          const j = src.indexOf('-->', i + 4);
          const end = j < 0 ? src.length : j + 3;
          pushLine(src.slice(i, end));
          i = end; continue;
        }
        const j = src.indexOf('>', i);
        if (j < 0) { pushLine(src.slice(i)); break; }
        const tag = src.slice(i, j + 1).replace(/\s+/g, ' ').replace(/\s+>/, '>');
        const m = tag.match(/^<\/?\s*([a-zA-Z0-9:-]+)/);
        const name = m ? m[1].toLowerCase() : '';
        const isClose = /^<\//.test(tag);
        const isSelf = /\/>$/.test(tag) || VOID.indexOf(name) >= 0;
        if (isClose) ind = Math.max(0, ind - 1);
        pushLine(tag);
        i = j + 1;
        if (!isClose && !isSelf) {
          // 纯文本子节点保持同一行，例如 <h2>标题</h2>
          const inline = src.slice(i).match(/^([^<>]*)<\/\s*([a-zA-Z0-9:-]+)\s*>/);
          if (inline && inline[2].toLowerCase() === name) {
            const inlineText = inline[1].replace(/\s+/g, ' ').trim();
            lines[lines.length - 1] += inlineText + '</' + inline[2] + '>';
            i += inline[0].length;
            continue;
          }
          if (RAW.indexOf(name) >= 0) {
            const rest = src.slice(i);
            const re = new RegExp('</\\s*' + name + '\\s*>', 'i');
            const cm = rest.match(re);
            if (cm) {
              const content = rest.slice(0, cm.index).replace(/^\n+|\n+$/g, '');
              content.split('\n').forEach(function (l) {
                if (l.trim()) lines.push(unit.repeat(ind + 1) + l.replace(/\s+$/, ''));
              });
              i += cm.index;
            } else {
              ind++;
            }
          } else {
            ind++;
          }
        }
        continue;
      }
      const k = src.indexOf('<', i);
      const raw = src.slice(i, k < 0 ? src.length : k);
      const t = raw.replace(/\s+/g, ' ').trim();
      if (t) pushLine(t);
      i = k < 0 ? src.length : k;
    }
    return lines.join('\n');
  }

  function tokenizeCSS(src) {
    const toks = [];
    let i = 0;
    while (i < src.length) {
      const c = src.charAt(i);
      if (c === '/' && src.charAt(i + 1) === '*') {
        let j = src.indexOf('*/', i + 2); j = j < 0 ? src.length : j + 2;
        toks.push({ t: 'comment', v: src.slice(i, j) }); i = j; continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < src.length) {
          if (src.charAt(j) === '\\') { j += 2; continue; }
          if (src.charAt(j) === c) { j++; break; }
          j++;
        }
        toks.push({ t: 'value', v: src.slice(i, j) }); i = j; continue;
      }
      if (c === '{' || c === '}' || c === ';' || c === ',') { toks.push({ t: c, v: c }); i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      let j = i;
      while (j < src.length && !/[\s{};,"']/.test(src.charAt(j)) &&
        !(src.charAt(j) === '/' && src.charAt(j + 1) === '*')) j++;
      toks.push({ t: 'value', v: src.slice(i, j) });
      i = j;
    }
    return toks;
  }

  function beautifyCSS(src, unit) {
    const toks = tokenizeCSS(src);
    let out = '', ind = 0, lineStart = true, lastType = null;
    const pad = function () { return unit.repeat(Math.max(ind, 0)); };
    const write = function (s, space) {
      if (lineStart) { out += pad() + s; lineStart = false; }
      else out += (space ? ' ' : '') + s;
    };
    const nl = function () {
      out = out.replace(/[ \t]+$/, '');
      out += '\n';
      lineStart = true;
    };
    toks.forEach(function (tk) {
      if (tk.t === 'comment') { if (!lineStart) nl(); write(tk.v); nl(); lastType = 'comment'; return; }
      if (tk.t === '{') { write('{', true); nl(); ind++; lastType = '{'; return; }
      if (tk.t === '}') {
        ind = Math.max(0, ind - 1);
        if (!lineStart) nl();
        write('}');
        nl();
        lastType = '}';
        return;
      }
      if (tk.t === ';') { write(';'); nl(); lastType = ';'; return; }
      if (tk.t === ',') { write(','); lastType = ','; return; }
      const space = lastType === 'value' || lastType === ',';
      write(tk.v, space);
      lastType = 'value';
    });
    return out.replace(/\{\n\s*\}/g, '{}')
      .replace(/\n{3,}/g, '\n\n')
      .split('\n')
      .map(function (line) {
        // 声明行补一个冒号后的空格：display:flex → display: flex
        if (/;\s*$/.test(line)) return line.replace(/^(\s*[^:;{}]+):(?=\S)/, '$1: ');
        return line;
      })
      .join('\n')
      .trim();
  }

  function beautifySQL(src, unit) {
    const major = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
      'UNION ALL', 'UNION', 'INSERT INTO', 'UPDATE', 'SET', 'DELETE FROM', 'VALUES',
      'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN'];
    const minor = ['AND', 'OR', 'ON'];
    let s = src.replace(/\s+/g, ' ').trim();
    const majorRe = new RegExp('\\b(' + major.map(function (k) { return k.replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi');
    const minorRe = new RegExp('\\b(' + minor.join('|') + ')\\b', 'gi');
    s = s.replace(majorRe, function (m) { return '\n' + m.toUpperCase(); });
    s = s.replace(minorRe, function (m) { return '\n' + unit.repeat(2) + m.toUpperCase(); });
    s = s.replace(/^\s+/, '');
    s = s.replace(/\b(select|from|where|group by|order by|having|limit|offset|join|left join|right join|inner join|on|and|or|insert into|update|set|values|as|desc|asc|not null|like|in|is null|count|sum|avg|max|min|distinct)\b/gi,
      function (m) { return m.toUpperCase(); });
    return s.split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').trim();
  }

  function minifyCSS(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};:,>])\s*/g, '$1')
      .replace(/;}/g, '}')
      .trim();
  }

  function minifyHTML(src) {
    return src.replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  registerTool({
    id: 'format',
    name: '代码格式化',
    group: '文本处理',
    icon: 'code',
    desc: 'JSON / HTML / CSS / JS / SQL 美化与压缩',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="code"></span>代码格式化</h1>' +
        '<p>轻量级格式化引擎，纯本地解析：JSON、HTML/XML、CSS、JavaScript、SQL 一键美化或压缩。</p></div>' +
        '<div class="grid-2 wide-left">' +
        '  <div class="card">' +
        '    <div class="card-title">源代码 <span class="ct-sub" id="fInMeta"></span></div>' +
        '    <textarea class="input big" id="fInput" spellcheck="false" placeholder="粘贴需要格式化的代码…"></textarea>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <select class="input sm" id="fLang" style="width:auto">' +
        '        <option value="json">JSON</option><option value="html">HTML / XML</option>' +
        '        <option value="css">CSS</option><option value="js">JavaScript</option><option value="sql">SQL</option>' +
        '      </select>' +
        '      <select class="input sm" id="fIndent" style="width:auto">' +
        '        <option value="2">2 空格</option><option value="4">4 空格</option><option value="tab">Tab</option>' +
        '      </select>' +
        '      <button class="btn primary" id="fRun">格式化</button>' +
        '      <button class="btn" id="fMin">压缩</button>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn ghost" id="fSample">示例</button>' +
        '      <button class="btn ghost" id="fClear">清空</button>' +
        '    </div>' +
        '    <div class="hint" id="fStatus" style="margin-top:9px">选择语言后粘贴代码</div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">结果 <span class="ct-sub" id="fOutMeta"></span></div>' +
        '    <textarea class="input big" id="fOutput" readonly spellcheck="false"></textarea>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <button class="btn" id="fCopy">复制结果</button>' +
        '      <button class="btn" id="fDownload">下载文件</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const input = root.querySelector('#fInput');
      const output = root.querySelector('#fOutput');
      const lang = root.querySelector('#fLang');
      const indent = root.querySelector('#fIndent');
      const status = root.querySelector('#fStatus');
      const inMeta = root.querySelector('#fInMeta');
      const outMeta = root.querySelector('#fOutMeta');

      const SAMPLES = {
        json: '{"id":1,"name":"fangcun","tags":["json","format"],"nested":{"a":true,"b":null}}',
        html: '<div class="card"><h2>标题</h2><p>段落 <b>加粗</b> 文本</p><img src="a.png" alt=""><ul><li>一</li><li>二</li></ul></div>',
        css: '.card{display:flex;gap:8px;padding:16px}.card:hover{box-shadow:0 4px 12px rgba(0,0,0,.1)}/* 注释 */',
        js: 'function greet(name){if(!name){return "hi"}const list=[1,2,3].map(n=>n*2);return `hello ${name}`}\nconst obj={a:1,b:{c:true}};',
        sql: 'select id,name,count(*) as total from users u left join orders o on o.user_id=u.id where u.status=1 and o.amount>100 group by id order by total desc limit 10'
      };

      function unit() {
        return indent.value === 'tab' ? '\t' : ' '.repeat(parseInt(indent.value, 10));
      }
      function ext() {
        return { json: 'json', html: 'html', css: 'css', js: 'js', sql: 'sql' }[lang.value];
      }
      function setStatus(msg, type) {
        status.className = 'hint' + (type ? ' ' + type : '');
        status.textContent = msg;
      }

      function process(mode) {
        const src = input.value;
        inMeta.textContent = src.length + ' 字符';
        if (!src.trim()) {
          output.value = '';
          outMeta.textContent = '';
          setStatus(mode === 'min' ? '压缩会移除多余空白' : '格式化结果会显示在右侧');
          return;
        }
        try {
          let result = '';
          const u = unit();
          if (mode === 'min') {
            if (lang.value === 'css') result = minifyCSS(src);
            else if (lang.value === 'html') result = minifyHTML(src);
            else if (lang.value === 'json') result = JSON.stringify(JSON.parse(src));
            else if (lang.value === 'js') result = src.replace(/\s+/g, ' ').replace(/\s*([{};,])\s*/g, '$1').trim();
            else result = src.replace(/\s+/g, ' ').trim();
            setStatus('✓ 已压缩，' + src.length + ' → ' + result.length + ' 字符', 'ok');
          } else {
            if (lang.value === 'json') result = JSON.stringify(JSON.parse(src), null, u);
            else if (lang.value === 'html') result = beautifyHTML(src, u);
            else if (lang.value === 'css') result = beautifyCSS(src, u);
            else if (lang.value === 'js') result = beautifyJS(src, u);
            else result = beautifySQL(src, u);
            setStatus('✓ 格式化完成，共 ' + result.split('\n').length + ' 行', 'ok');
          }
          output.value = result;
          outMeta.textContent = result.length + ' 字符';
        } catch (err) {
          setStatus('✗ 解析失败：' + err.message, 'err');
          output.value = '';
          outMeta.textContent = '';
        }
      }

      root.querySelector('#fRun').addEventListener('click', function () { process('fmt'); });
      root.querySelector('#fMin').addEventListener('click', function () { process('min'); });
      lang.addEventListener('change', function () {
        setStatus('当前语言：' + lang.options[lang.selectedIndex].text + '　按「格式化」处理');
      });
      root.querySelector('#fSample').addEventListener('click', function () {
        input.value = SAMPLES[lang.value];
        process('fmt');
      });
      root.querySelector('#fClear').addEventListener('click', function () {
        input.value = ''; output.value = ''; inMeta.textContent = ''; outMeta.textContent = '';
        setStatus('已清空');
      });
      root.querySelector('#fCopy').addEventListener('click', function () { Lib.copy(output.value); });
      root.querySelector('#fDownload').addEventListener('click', function () {
        if (!output.value) return Lib.toast('没有可下载的内容', 'err');
        const mimes = { json: 'application/json', html: 'text/html', css: 'text/css', js: 'text/javascript', sql: 'text/plain' };
        Lib.downloadText(output.value, 'formatted.' + ext(), (mimes[lang.value] || 'text/plain') + ';charset=utf-8');
        Lib.toast('已开始下载', 'ok');
      });

      input.addEventListener('input', Lib.debounce(function () {
        inMeta.textContent = input.value.length + ' 字符';
      }, 200));
    }
  });

  /* ============================ 随机字符串 ============================ */

  const CHARSETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digit: '0123456789',
    symbol: '!@#$%^&*()-_=+[]{}<>.,;:?/~'
  };
  const AMBIGUOUS = '0O1lI|`\'"';

  function secureRandomInt(max) {
    if (max <= 0) return 0;
    const buf = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;
    let x;
    do {
      crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % max;
  }

  function uuid4() {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.prototype.map.call(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  registerTool({
    id: 'random',
    name: '随机字符串',
    group: '生成器',
    icon: 'dice',
    desc: '随机密码 / 密钥 / 字符串与 UUID v4 批量生成',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="dice"></span>随机字符串生成</h1>' +
        '<p>基于 <span class="mono">crypto.getRandomValues</span> 密码学安全随机源，可用于生成密码、Token、邀请码与 UUID。</p></div>' +
        '<div class="grid-2">' +
        '  <div class="card">' +
        '    <div class="card-title">随机字符串</div>' +
        '    <label class="field"><span>长度：<b class="mono" id="rnLenVal">32</b></span>' +
        '      <input type="range" id="rnLen" min="1" max="128" value="32" style="width:100%;accent-color:var(--accent)"></label>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <label class="field" style="width:110px"><span>生成数量</span><input class="input sm" type="number" id="rnCount" value="5" min="1" max="200"></label>' +
        '      <label class="field" style="width:150px"><span>预设</span>' +
        '        <select class="input sm" id="rnPreset">' +
        '          <option value="mix">大小写+数字</option>' +
        '          <option value="strong">强密码（含符号）</option>' +
        '          <option value="lower">仅小写+数字</option>' +
        '          <option value="hex">十六进制</option>' +
        '        </select></label>' +
        '    </div>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <label class="check"><input type="checkbox" id="rnUpper" checked>大写</label>' +
        '      <label class="check"><input type="checkbox" id="rnLower" checked>小写</label>' +
        '      <label class="check"><input type="checkbox" id="rnDigit" checked>数字</label>' +
        '      <label class="check"><input type="checkbox" id="rnSymbol">符号</label>' +
        '    </div>' +
        '    <div class="row" style="margin-top:8px">' +
        '      <label class="check"><input type="checkbox" id="rnNoAmbig">排除易混淆字符（0O1lI）</label>' +
        '    </div>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <button class="btn primary" id="rnGen">生成</button>' +
        '      <button class="btn" id="rnCopy">复制结果</button>' +
        '      <span class="spacer"></span>' +
        '      <span class="hint" id="rnEntropy"></span>' +
        '    </div>' +
        '    <textarea class="input" id="rnOut" readonly style="margin-top:10px;min-height:150px" placeholder="点击生成"></textarea>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">UUID v4</div>' +
        '    <div class="row">' +
        '      <label class="field" style="width:110px"><span>生成数量</span><input class="input sm" type="number" id="uuCount" value="5" min="1" max="200"></label>' +
        '      <button class="btn primary" id="uuGen" style="align-self:flex-end">生成 UUID</button>' +
        '      <button class="btn" id="uuCopy" style="align-self:flex-end">复制</button>' +
        '    </div>' +
        '    <textarea class="input" id="uuOut" readonly style="margin-top:12px;min-height:150px" placeholder="点击生成"></textarea>' +
        '    <div class="hint" style="margin-top:10px">UUID v4 为随机版本，第 13 位固定为 4，第 17 位为 8/9/a/b。</div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const len = root.querySelector('#rnLen');
      const lenVal = root.querySelector('#rnLenVal');
      const count = root.querySelector('#rnCount');
      const out = root.querySelector('#rnOut');
      const uuidOut = root.querySelector('#uuOut');
      const entropyEl = root.querySelector('#rnEntropy');
      const boxes = {
        upper: root.querySelector('#rnUpper'),
        lower: root.querySelector('#rnLower'),
        digit: root.querySelector('#rnDigit'),
        symbol: root.querySelector('#rnSymbol')
      };
      const noAmbig = root.querySelector('#rnNoAmbig');
      const preset = root.querySelector('#rnPreset');

      function charset() {
        if (preset.value === 'hex') return '0123456789abcdef';
        let s = '';
        Object.keys(boxes).forEach(function (k) { if (boxes[k].checked) s += CHARSETS[k]; });
        if (noAmbig.checked) {
          s = s.split('').filter(function (c) { return AMBIGUOUS.indexOf(c) < 0; }).join('');
        }
        return s;
      }

      function updateEntropy() {
        const size = charset().length;
        const n = parseInt(len.value, 10);
        lenVal.textContent = n;
        if (!size) { entropyEl.textContent = '请至少选择一种字符类型'; return; }
        const bits = (n * Math.log2(size)).toFixed(0);
        entropyEl.textContent = '字符集 ' + size + ' 个 · 约 ' + bits + ' bit 熵';
      }

      function generate() {
        const set = charset();
        if (!set) { Lib.toast('请至少选择一种字符类型', 'err'); return; }
        const n = Math.max(1, Math.min(128, parseInt(len.value, 10) || 8));
        const num = Math.max(1, Math.min(200, parseInt(count.value, 10) || 1));
        const list = [];
        for (let i = 0; i < num; i++) {
          let s = '';
          for (let j = 0; j < n; j++) s += set.charAt(secureRandomInt(set.length));
          list.push(s);
        }
        out.value = list.join('\n');
        updateEntropy();
      }

      function generateUUIDs() {
        const num = Math.max(1, Math.min(200, parseInt(root.querySelector('#uuCount').value, 10) || 1));
        const list = [];
        for (let i = 0; i < num; i++) list.push(uuid4());
        uuidOut.value = list.join('\n');
      }

      preset.addEventListener('change', function () {
        const v = preset.value;
        boxes.upper.checked = v !== 'lower' && v !== 'hex';
        boxes.lower.checked = v !== 'hex';
        boxes.digit.checked = true;
        boxes.symbol.checked = v === 'strong';
        updateEntropy();
        generate();
      });

      len.addEventListener('input', function () { lenVal.textContent = len.value; updateEntropy(); });
      Object.keys(boxes).forEach(function (k) { boxes[k].addEventListener('change', updateEntropy); });
      noAmbig.addEventListener('change', updateEntropy);
      root.querySelector('#rnGen').addEventListener('click', generate);
      root.querySelector('#rnCopy').addEventListener('click', function () { Lib.copy(out.value, '已复制全部结果'); });
      root.querySelector('#uuGen').addEventListener('click', generateUUIDs);
      root.querySelector('#uuCopy').addEventListener('click', function () { Lib.copy(uuidOut.value, '已复制全部 UUID'); });

      updateEntropy();
      generate();
      generateUUIDs();
    }
  });
})();
