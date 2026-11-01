/* ==========================================================================
   tools-extra.js · 第二批工具
   JWT 解析 / Cron 解析 / URL 解析 / 文件哈希校验 / 文本对比 / 颜色工具
   —— 全部在浏览器本地完成，无网络请求
   ========================================================================== */
(function () {
  'use strict';

  function esc(s) { return Lib.escapeHtml(String(s == null ? '' : s)); }

  function resRow(label, value) {
    return '<div class="res-row"><span class="res-label">' + label + '</span>' +
      '<span class="res-value mono">' + esc(value) + '</span>' +
      '<span class="res-actions"><button class="btn sm" data-copy="' + esc(value) + '">复制</button></span></div>';
  }

  function untilText(ms) {
    const diff = ms - Date.now();
    const abs = Math.abs(diff);
    const day = 86400000, hour = 3600000, min = 60000;
    let text;
    if (abs < min) return diff < 0 ? '刚刚' : '不到 1 分钟';
    if (abs >= day) text = Math.floor(abs / day) + ' 天' + (Math.floor((abs % day) / hour) ? ' ' + Math.floor((abs % day) / hour) + ' 小时' : '');
    else if (abs >= hour) text = Math.floor(abs / hour) + ' 小时' + (Math.floor((abs % hour) / min) ? ' ' + Math.floor((abs % hour) / min) + ' 分钟' : '');
    else text = Math.floor(abs / min) + ' 分钟';
    return diff < 0 ? '已过去 ' + text : '剩余 ' + text;
  }

  /* ============================ JWT 解析 ============================ */

  const JWT_SAMPLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkZhbmN1biBUb29sa2l0IiwiaXNzIjoiZmFuZ2N1bi5sb2NhbCIsImlhdCI6MTczNTY4OTYwMCwiZXhwIjo0MTAyNDQ0ODAwLCJzY29wZSI6WyJyZWFkIiwid3JpdGUiXX0.MsnMvqshPSO-f-b74ODbcFbmrHOrU0az7KbPTvzsNbM';

  const CLAIM_LABELS = {
    iss: '签发者 iss', sub: '主体 sub', aud: '受众 aud', exp: '过期时间 exp',
    nbf: '生效时间 nbf', iat: '签发时间 iat', jti: '编号 jti'
  };

  function b64uBytes(seg) {
    let s = String(seg).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return Lib.base64ToBytes(s);
  }

  function hmacSha256(keyBytes, msgBytes) {
    const B = 64;
    let k = keyBytes;
    if (k.length > B) k = Lib.hexToBytes(Lib.sha256Bytes(k));
    const inner = new Uint8Array(B + msgBytes.length);
    const outer = new Uint8Array(B + 32);
    for (let i = 0; i < B; i++) {
      const b = i < k.length ? k[i] : 0;
      inner[i] = b ^ 0x36;
      outer[i] = b ^ 0x5c;
    }
    inner.set(msgBytes, B);
    outer.set(Lib.hexToBytes(Lib.sha256Bytes(inner)), B);
    return Lib.hexToBytes(Lib.sha256Bytes(outer));
  }

  function claimValue(k, v) {
    if (v == null) return 'null';
    if (v && typeof v === 'object') return JSON.stringify(v);
    if ((k === 'exp' || k === 'nbf' || k === 'iat') && typeof v === 'number') {
      return Lib.formatDate(new Date(v * 1000)) + '　(' + untilText(v * 1000) + ')';
    }
    return String(v);
  }

  registerTool({
    id: 'jwt',
    name: 'JWT 解析',
    group: '开发辅助',
    icon: 'lock',
    desc: '解析 JWT 头部与载荷、检查过期时间，并本地校验 HS256 签名',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="lock"></span>JWT 解析与验签</h1>' +
        '<p>拆开 JWT 看清 header 与 payload，校验过期时间；支持 HS256 本地验签。Token 不会离开这台设备。</p></div>' +
        '<div class="card">' +
        '  <div class="card-title">Token <span class="ct-sub">支持带 Bearer 前缀</span></div>' +
        '  <textarea class="input" id="jwtIn" spellcheck="false" style="min-height:92px" placeholder="粘贴 JWT，例如 eyJhbGciOi..."></textarea>' +
        '  <div class="row" style="margin-top:10px">' +
        '    <button class="btn primary" id="jwtRun">解析</button>' +
        '    <button class="btn" id="jwtSample">载入示例</button>' +
        '    <button class="btn ghost" id="jwtClear">清空</button>' +
        '    <span class="spacer"></span>' +
        '    <span class="hint" id="jwtHint">等待输入</span>' +
        '  </div>' +
        '  <div class="jwt-token is-hidden" id="jwtToken"></div>' +
        '</div>' +
        '<div class="grid-2 is-hidden" id="jwtBody">' +
        '  <div class="card"><div class="card-title">Header <span class="ct-sub">头部</span></div>' +
        '    <textarea class="input mono" id="jwtHead" readonly spellcheck="false" style="min-height:170px"></textarea></div>' +
        '  <div class="card"><div class="card-title">Payload <span class="ct-sub">载荷</span></div>' +
        '    <textarea class="input mono" id="jwtPayload" readonly spellcheck="false" style="min-height:170px"></textarea></div>' +
        '</div>' +
        '<div class="grid-2 is-hidden" id="jwtMeta">' +
        '  <div class="card"><div class="card-title">声明 <span class="ct-sub">Claims</span></div>' +
        '    <div class="table-wrap" style="max-height:330px"><table class="mt" id="jwtClaims"></table></div></div>' +
        '  <div class="card">' +
        '    <div class="card-title">签名校验 <span class="ct-sub">HS256</span></div>' +
        '    <div class="row"><input class="input mono" id="jwtSecret" placeholder="HMAC 密钥（示例：fangcun）" style="flex:1">' +
        '      <button class="btn" id="jwtVerify">校验</button></div>' +
        '    <div class="hint" id="jwtVerifyMsg" style="margin-top:9px">填入密钥即可在本地校验签名</div>' +
        '    <div class="divider"></div>' +
        '    <div class="hint" id="jwtAlg"></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const input = root.querySelector('#jwtIn');
      const hint = root.querySelector('#jwtHint');
      const tokenBox = root.querySelector('#jwtToken');
      const body = root.querySelector('#jwtBody');
      const meta = root.querySelector('#jwtMeta');
      const headOut = root.querySelector('#jwtHead');
      const payloadOut = root.querySelector('#jwtPayload');
      const claims = root.querySelector('#jwtClaims');
      const secret = root.querySelector('#jwtSecret');
      const verifyMsg = root.querySelector('#jwtVerifyMsg');
      const algLine = root.querySelector('#jwtAlg');
      let state = null;

      function setHint(text, type) {
        hint.className = 'hint' + (type ? ' ' + type : '');
        hint.textContent = text;
      }

      function reset() {
        state = null;
        tokenBox.classList.add('is-hidden');
        body.classList.add('is-hidden');
        meta.classList.add('is-hidden');
        verifyMsg.className = 'hint';
        verifyMsg.textContent = '填入密钥即可在本地校验签名';
        algLine.textContent = '';
      }

      function renderClaims(payload) {
        const rows = [];
        Object.keys(CLAIM_LABELS).forEach(function (k) {
          if (payload[k] !== undefined) {
            rows.push([k, CLAIM_LABELS[k], claimValue(k, payload[k])]);
          }
        });
        Object.keys(payload).forEach(function (k) {
          if (CLAIM_LABELS[k]) return;
          rows.push([k, '自定义', claimValue(k, payload[k])]);
        });
        if (!rows.length) {
          claims.innerHTML = '<tr><td class="hint">payload 为空</td></tr>';
          return;
        }
        claims.innerHTML = '<thead><tr><th style="width:60px">键</th><th style="width:120px">含义</th><th>值</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td class="mono">' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td>' +
              '<td class="mono">' + esc(r[2]) + '</td></tr>';
          }).join('') + '</tbody>';
      }

      function run() {
        const raw = input.value.trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, '');
        if (!raw) {
          reset();
          setHint('等待输入');
          return;
        }
        const parts = raw.split('.');
        if (parts.length < 2 || parts.length > 3) {
          reset();
          setHint('✗ 一个 JWT 应为 3 段（header.payload.signature）', 'err');
          return;
        }
        let header, payload;
        try {
          header = JSON.parse(Lib.bytesToText(b64uBytes(parts[0])));
          payload = JSON.parse(Lib.bytesToText(b64uBytes(parts[1])));
        } catch (e) {
          reset();
          setHint('✗ 解析失败：不是合法的 Base64URL JSON（' + e.message + '）', 'err');
          return;
        }

        state = {
          header: header, payload: payload,
          signingInput: parts[0] + '.' + parts[1],
          signature: parts[2] || '',
          alg: String(header.alg || '').toUpperCase()
        };

        tokenBox.innerHTML = '<span class="jt-h">' + esc(parts[0]) + '</span><span class="jt-dot">.</span>' +
          '<span class="jt-p">' + esc(parts[1]) + '</span>' +
          (parts[2] ? '<span class="jt-dot">.</span><span class="jt-s">' + esc(parts[2]) + '</span>' : '');
        tokenBox.classList.remove('is-hidden');
        headOut.value = JSON.stringify(header, null, 2);
        payloadOut.value = JSON.stringify(payload, null, 2);
        renderClaims(payload);
        body.classList.remove('is-hidden');
        meta.classList.remove('is-hidden');

        const now = Date.now();
        const bits = [];
        if (payload.exp !== undefined && typeof payload.exp === 'number') {
          if (payload.exp * 1000 < now) bits.push('<span class="pill err">已过期 ' + esc(untilText(payload.exp * 1000).replace('已过去 ', '')) + '</span>');
          else bits.push('<span class="pill ok">有效，' + esc(untilText(payload.exp * 1000)) + '</span>');
        } else {
          bits.push('<span class="pill">无 exp，不会自动过期</span>');
        }
        if (payload.nbf !== undefined && typeof payload.nbf === 'number' && payload.nbf * 1000 > now) {
          bits.push('<span class="pill warn">尚未生效</span>');
        }
        if (payload.iat !== undefined && typeof payload.iat === 'number') {
          bits.push('<span class="pill">签发于 ' + esc(Lib.formatDate(new Date(payload.iat * 1000)).slice(2, 16)) + '</span>');
        }
        setHint('✓ 解析成功', 'ok');
        tokenBox.insertAdjacentHTML('afterbegin', '<div class="jwt-badges">' + bits.join('') + '</div>');

        const alg = state.alg || '未声明';
        if (parts.length === 2) {
          algLine.innerHTML = '该 Token 没有签名段（未签名）。';
          verifyMsg.className = 'hint warn';
          verifyMsg.textContent = '没有签名段，无法校验';
        } else {
          algLine.innerHTML = '算法：<b class="mono">' + esc(alg) + '</b>' +
            (alg === 'NONE' ? '　<span class="pill err">不安全</span>' : '');
          verifyMsg.className = 'hint';
          verifyMsg.textContent = /^HS256$/.test(alg)
            ? '填入密钥即可在本地校验签名'
            : '当前仅支持 HS256 验签（此 Token 使用 ' + esc(alg) + '）';
        }
      }

      function verify() {
        if (!state || !state.signature) return;
        const key = secret.value;
        if (!key) {
          verifyMsg.className = 'hint warn';
          verifyMsg.textContent = '请先输入 HMAC 密钥';
          return;
        }
        if (!/^HS256$/.test(state.alg)) {
          verifyMsg.className = 'hint warn';
          verifyMsg.textContent = '暂只支持 HS256，算法为 ' + (state.alg || '未声明');
          return;
        }
        const got = Lib.bytesToBase64(hmacSha256(Lib.utf8Bytes(key), Lib.utf8Bytes(state.signingInput)), true);
        if (got === state.signature) {
          verifyMsg.className = 'hint ok';
          verifyMsg.textContent = '✓ 签名有效，密钥正确';
        } else {
          verifyMsg.className = 'hint err';
          verifyMsg.textContent = '✗ 签名不匹配：密钥错误或 Token 被篡改';
        }
      }

      input.addEventListener('input', Lib.debounce(run, 220));
      root.querySelector('#jwtRun').addEventListener('click', run);
      root.querySelector('#jwtVerify').addEventListener('click', verify);
      secret.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });
      root.querySelector('#jwtSample').addEventListener('click', function () {
        input.value = JWT_SAMPLE;
        secret.value = 'fangcun';
        run();
        verify();
      });
      root.querySelector('#jwtClear').addEventListener('click', function () {
        input.value = '';
        secret.value = '';
        reset();
        setHint('等待输入');
      });
    }
  });

  /* ============================ Cron 解析 ============================ */

  const MONTH_NAMES = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
  const DOW_NAMES = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const DOW_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function cronToken(token, names, label) {
    const t = String(token).trim().toUpperCase();
    if (names && names[t] != null) return names[t];
    if (!/^\d+$/.test(t)) throw new Error(label + ' 含非法值「' + token + '」');
    return parseInt(t, 10);
  }

  function parseCronField(raw, min, max, names, label) {
    const text = String(raw).trim();
    if (!text) throw new Error(label + ' 不能为空');
    const set = new Set();
    text.split(',').forEach(function (part) {
      if (!part) throw new Error(label + ' 有空的列表项');
      const seg = part.split('/');
      if (seg.length > 2) throw new Error(label + ' 的「' + part + '」格式不对');
      const step = seg.length === 2 ? parseInt(seg[1], 10) : 1;
      if (seg.length === 2 && (!step || step < 1)) throw new Error(label + ' 的步长必须 ≥ 1');
      let range = seg[0].trim();
      let lo, hi;
      if (range === '*') {
        lo = min; hi = max;
      } else if (range.indexOf('-') > 0) {
        const ab = range.split('-');
        if (ab.length !== 2) throw new Error(label + ' 的「' + part + '」格式不对');
        lo = cronToken(ab[0], names, label);
        hi = cronToken(ab[1], names, label);
      } else {
        const v = cronToken(range, names, label);
        if (seg.length === 2) { lo = v; hi = max; }
        else { lo = hi = v; }
      }
      if (lo < min || hi > max) throw new Error(label + ' 的取值范围是 ' + min + '–' + max);
      if (lo > hi) throw new Error(label + ' 的起点大于终点');
      for (let v = lo; v <= hi; v += step) set.add(v);
    });
    return set;
  }

  function parseCron(expr) {
    const raw = expr.trim().split(/\s+/);
    if (raw.length !== 5) throw new Error('需要 5 段（分 时 日 月 周），当前 ' + raw.length + ' 段');
    const minutes = parseCronField(raw[0], 0, 59, null, '分钟');
    const hours = parseCronField(raw[1], 0, 23, null, '小时');
    const dom = parseCronField(raw[2], 1, 31, null, '日');
    const months = parseCronField(raw[3], 1, 12, MONTH_NAMES, '月');
    let dow = parseCronField(raw[4], 0, 7, DOW_NAMES, '星期');
    if (dow.has(7)) { dow.delete(7); dow.add(0); }
    return {
      raw: raw, minutes: minutes, hours: hours, dom: dom, months: months, dow: dow,
      minutesList: Array.from(minutes).sort(function (a, b) { return a - b; }),
      hoursList: Array.from(hours).sort(function (a, b) { return a - b; }),
      domStar: raw[2].charAt(0) === '*',
      dowStar: raw[4].charAt(0) === '*'
    };
  }

  function listText(arr, limit) {
    const lim = limit || 10;
    return arr.slice(0, lim).join('、') + (arr.length > lim ? ' …' : '');
  }

  function describeCron(f) {
    const minutesAll = f.minutes.size === 60;
    const hoursAll = f.hours.size === 24;

    let when;
    if (minutesAll && hoursAll) when = '每分钟';
    else if (minutesAll) when = listText(f.hoursList) + ' 点的每分钟';
    else if (f.minutesList.length === 1 && hoursAll) when = '每小时的第 ' + f.minutesList[0] + ' 分钟';
    else if (hoursAll) when = '每小时的第 ' + listText(f.minutesList) + ' 分钟';
    else if (f.minutesList.length === 1 && f.hoursList.length === 1) {
      when = Lib.pad2(f.hoursList[0]) + ':' + Lib.pad2(f.minutesList[0]);
    } else {
      when = listText(f.hoursList) + ' 点的 ' + listText(f.minutesList) + ' 分';
    }

    let dayPart;
    if (f.domStar && f.dowStar) dayPart = '每天';
    else if (f.domStar) dayPart = '每' + Array.from(f.dow).sort(function (a, b) { return a - b; })
      .map(function (d) { return DOW_CN[d]; }).join('、');
    else if (f.dowStar) dayPart = '每月 ' + listText(Array.from(f.dom).sort(function (a, b) { return a - b; })) + ' 日';
    else {
      dayPart = '每月 ' + listText(Array.from(f.dom).sort(function (a, b) { return a - b; })) + ' 日或每' +
        Array.from(f.dow).sort(function (a, b) { return a - b; }).map(function (d) { return DOW_CN[d]; }).join('、');
    }

    let monthPart = '';
    if (f.months.size < 12) {
      monthPart = '每年 ' + listText(Array.from(f.months).sort(function (a, b) { return a - b; })) + ' 月，';
    }

    if (minutesAll && hoursAll && f.domStar && f.dowStar && f.months.size === 12) {
      return '每分钟执行一次';
    }
    const sep = /^\d/.test(when) ? ' ' : '';
    return monthPart + dayPart + sep + when + ' 执行';
  }

  function cronDayMatch(f, d) {
    const domOk = f.dom.has(d.getDate());
    const dowOk = f.dow.has(d.getDay());
    if (f.domStar && f.dowStar) return true;
    if (f.domStar) return dowOk;
    if (f.dowStar) return domOk;
    return domOk || dowOk;
  }

  function nextRuns(f, count) {
    const out = [];
    const from = new Date();
    from.setSeconds(0, 0);
    const start = from.getTime() + 60000;
    const base = new Date(start);
    for (let day = 0; day < 366 * 4 && out.length < count; day++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + day);
      if (!f.months.has(d.getMonth() + 1)) continue;
      if (!cronDayMatch(f, d)) continue;
      for (let hi = 0; hi < f.hoursList.length; hi++) {
        for (let mi = 0; mi < f.minutesList.length; mi++) {
          const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), f.hoursList[hi], f.minutesList[mi]);
          if (t.getTime() < start) continue;
          out.push(t);
          if (out.length >= count) return out;
        }
      }
    }
    return out;
  }

  registerTool({
    id: 'cron',
    name: 'Cron 解析',
    group: '开发辅助',
    icon: 'clock',
    desc: '把 Cron 表达式翻译成中文，并算出接下来 5 次运行时间',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="clock"></span>Cron 表达式解析</h1>' +
        '<p>支持标准 5 段表达式：分钟 小时 日 月 星期，可用 * / , - 与 JAN、MON 等名称，并预测接下来 5 次运行时间。</p></div>' +
        '<div class="card">' +
        '  <div class="card-title">表达式 <span class="ct-sub">分 时 日 月 周</span></div>' +
        '  <div class="row"><input class="input mono" id="crInput" value="0 9 * * 1-5" spellcheck="false" style="flex:1;font-size:15px;letter-spacing:.4px">' +
        '    <button class="btn primary" id="crRun">解析</button></div>' +
        '  <div class="chips" id="crPresets" style="margin-top:10px">' +
        '    <button class="chip" data-cron="* * * * *">每分钟</button>' +
        '    <button class="chip" data-cron="*/5 * * * *">每 5 分钟</button>' +
        '    <button class="chip" data-cron="0 * * * *">每小时整点</button>' +
        '    <button class="chip" data-cron="0 0 * * *">每天 0 点</button>' +
        '    <button class="chip" data-cron="30 9 * * 1-5">工作日 9:30</button>' +
        '    <button class="chip" data-cron="0 9 * * 1">每周一 9 点</button>' +
        '    <button class="chip" data-cron="0 0 1 * *">每月 1 号</button>' +
        '    <button class="chip" data-cron="0 3 * * 0">每周日 3 点</button>' +
        '  </div>' +
        '  <div class="hint" id="crHint" style="margin-top:9px">等待解析…</div>' +
        '</div>' +
        '<div class="grid-2 wide-left">' +
        '  <div class="card"><div class="card-title">含义</div>' +
        '    <div class="cron-sentence" id="crSentence">—</div>' +
        '    <div class="table-wrap" style="margin-top:14px"><table class="mt" id="crTable"></table></div>' +
        '  </div>' +
        '  <div class="card"><div class="card-title">接下来 5 次运行 <span class="ct-sub">本地时区</span></div>' +
        '    <div class="cron-next" id="crNext"></div>' +
        '    <div class="hint" style="margin-top:12px">按 Vixie Cron 规则：日与星期同时限定时取「或」的关系。</div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const input = root.querySelector('#crInput');
      const hint = root.querySelector('#crHint');
      const sentence = root.querySelector('#crSentence');
      const table = root.querySelector('#crTable');
      const nextBox = root.querySelector('#crNext');

      function render() {
        let f;
        try {
          f = parseCron(input.value);
        } catch (err) {
          hint.className = 'hint err';
          hint.textContent = '✗ ' + err.message;
          sentence.textContent = '—';
          table.innerHTML = '';
          nextBox.innerHTML = '<span class="hint">—</span>';
          return;
        }
        hint.className = 'hint ok';
        hint.textContent = '✓ 表达式合法';
        sentence.textContent = describeCron(f);

        const rows = [
          ['分钟', f.raw[0], listText(f.minutesList, 20) + '（' + f.minutesList.length + ' 个值）'],
          ['小时', f.raw[1], listText(f.hoursList, 20) + '（' + f.hoursList.length + ' 个值）'],
          ['日', f.raw[2], listText(Array.from(f.dom).sort(function (a, b) { return a - b; }), 20)],
          ['月', f.raw[3], listText(Array.from(f.months).sort(function (a, b) { return a - b; }), 12)],
          ['星期', f.raw[4], f.dowStar ? '每天' : Array.from(f.dow).sort(function (a, b) { return a - b; })
            .map(function (d) { return DOW_CN[d]; }).join('、')]
        ];
        table.innerHTML = '<thead><tr><th style="width:60px">字段</th><th style="width:110px">原文</th><th>解析</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td>' + r[0] + '</td><td class="mono">' + esc(r[1]) + '</td><td class="mono">' + esc(r[2]) + '</td></tr>';
          }).join('') + '</tbody>';

        const runs = nextRuns(f, 5);
        if (!runs.length) {
          nextBox.innerHTML = '<span class="hint">未来 4 年内没有匹配时间（例如 2 月 30 日）</span>';
          return;
        }
        nextBox.innerHTML = runs.map(function (d, i) {
          return '<div class="cron-run"><span class="cr-i">' + (i + 1) + '</span>' +
            '<span class="cr-time mono">' + Lib.formatDate(d).slice(0, 16) + '</span>' +
            '<span class="cr-dow">' + DOW_CN[d.getDay()] + '</span>' +
            '<span class="spacer"></span><span class="cr-rel">' + esc(untilText(d.getTime())) + '</span></div>';
        }).join('');
      }

      input.addEventListener('input', Lib.debounce(render, 180));
      root.querySelector('#crRun').addEventListener('click', render);
      root.querySelector('#crPresets').addEventListener('click', function (e) {
        const b = e.target.closest('[data-cron]');
        if (!b) return;
        input.value = b.dataset.cron;
        render();
      });
      render();
    }
  });

  /* ============================ URL 解析 ============================ */

  registerTool({
    id: 'url',
    name: 'URL 解析',
    group: '开发辅助',
    icon: 'link',
    desc: '拆分 URL 各组成部分，可视化增删改 Query 参数并重新拼接',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="link"></span>URL 解析与拼接</h1>' +
        '<p>拆出协议、主机、路径、查询参数与锚点；参数可逐条增删改，实时生成编码后的完整 URL。</p></div>' +
        '<div class="card">' +
        '  <div class="card-title">URL</div>' +
        '  <textarea class="input mono" id="urlIn" spellcheck="false" style="min-height:64px" placeholder="https://example.com/search?q=dev&amp;page=2#top"></textarea>' +
        '  <div class="row" style="margin-top:10px">' +
        '    <button class="btn primary" id="urlRun">解析</button>' +
        '    <button class="btn" id="urlSample">示例</button>' +
        '    <button class="btn ghost" id="urlClear">清空</button>' +
        '    <span class="spacer"></span><span class="hint" id="urlHint">等待输入</span>' +
        '  </div>' +
        '</div>' +
        '<div class="grid-2 wide-left is-hidden" id="urlMain">' +
        '  <div class="card"><div class="card-title">组成</div><div class="res-list" id="urlParts"></div></div>' +
        '  <div class="card"><div class="card-title">查询参数 <span class="ct-sub">修改后自动拼回</span></div>' +
        '    <div class="table-wrap" style="max-height:300px"><table class="mt" id="urlParams"></table></div>' +
        '    <div class="row" style="margin-top:9px"><button class="btn sm" id="urlAdd">+ 添加参数</button>' +
        '      <span class="spacer"></span><span class="hint" id="urlCount">0 个参数</span></div>' +
        '  </div>' +
        '</div>' +
        '<div class="card is-hidden" id="urlOutCard"><div class="card-title">拼接结果</div>' +
        '  <textarea class="input mono" id="urlOut" readonly spellcheck="false" style="min-height:64px"></textarea>' +
        '  <div class="row" style="margin-top:10px"><button class="btn primary" id="urlCopy">复制 URL</button>' +
        '    <button class="btn" id="urlOpen">在新标签打开</button></div>' +
        '</div>';
    },
    mount: function (root) {
      const input = root.querySelector('#urlIn');
      const hint = root.querySelector('#urlHint');
      const main = root.querySelector('#urlMain');
      const outCard = root.querySelector('#urlOutCard');
      const partsBox = root.querySelector('#urlParts');
      const paramsTable = root.querySelector('#urlParams');
      const countEl = root.querySelector('#urlCount');
      const out = root.querySelector('#urlOut');
      let base = null;

      function setHint(text, type) {
        hint.className = 'hint' + (type ? ' ' + type : '');
        hint.textContent = text;
      }

      function hide() {
        base = null;
        main.classList.add('is-hidden');
        outCard.classList.add('is-hidden');
      }

      function parse() {
        const raw = input.value.trim();
        if (!raw) { hide(); setHint('等待输入'); return; }
        let text = raw;
        let added = false;
        if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(text)) {
          text = 'https://' + text;
          added = true;
        }
        let u;
        try {
          u = new URL(text);
        } catch (e) {
          hide();
          setHint('✗ 不是合法的 URL', 'err');
          return;
        }
        base = u;
        setHint(added ? '✓ 已自动补全 https:// 前缀' : '✓ 解析成功', added ? 'warn' : 'ok');
        main.classList.remove('is-hidden');
        outCard.classList.remove('is-hidden');

        const rows = [
          ['协议', u.protocol.replace(':', '')],
          ['主机名', u.hostname],
          ['端口', u.port || '（默认）'],
          ['路径', u.pathname],
          ['查询串', u.search || '（无）'],
          ['锚点', u.hash || '（无）'],
          ['用户名', u.username || '（无）'],
          ['密码', u.password ? '••••••' : '（无）'],
          ['Origin', u.origin]
        ];
        partsBox.innerHTML = rows.map(function (r) {
          return '<div class="res-row"><span class="res-label">' + r[0] + '</span>' +
            '<span class="res-value mono">' + esc(r[1]) + '</span>' +
            '<span class="res-actions"><button class="btn sm" data-copy="' + esc(r[1]) + '">复制</button></span></div>';
        }).join('');

        paramsTable.innerHTML = '<thead><tr><th style="width:38%">键</th><th>值</th><th style="width:30px"></th></tr></thead><tbody></tbody>';
        const tb = paramsTable.querySelector('tbody');
        u.searchParams.forEach(function (value, key) {
          tb.appendChild(paramRow(key, value));
        });
        updateCount();
        rebuild();
      }

      function paramRow(key, value) {
        const tr = document.createElement('tr');
        tr.dataset.row = '1';
        tr.innerHTML = '<td><input class="input sm mono up-k" value="' + esc(key) + '" spellcheck="false"></td>' +
          '<td><input class="input sm mono up-v" value="' + esc(value) + '" spellcheck="false"></td>' +
          '<td><button class="btn sm ghost up-del" title="删除">✕</button></td>';
        return tr;
      }

      function updateCount() {
        const n = paramsTable.querySelectorAll('tbody tr[data-row]').length;
        countEl.textContent = n + ' 个参数';
      }

      function rebuild() {
        if (!base) return;
        const u = new URL(base.href);
        const params = new URLSearchParams();
        paramsTable.querySelectorAll('tbody tr[data-row]').forEach(function (tr) {
          const k = tr.querySelector('.up-k').value;
          const v = tr.querySelector('.up-v').value;
          if (k === '' && v === '') return;
          params.append(k, v);
        });
        u.search = params.toString();
        out.value = u.href;
      }

      const live = Lib.debounce(parse, 240);
      input.addEventListener('input', live);
      root.querySelector('#urlRun').addEventListener('click', parse);
      root.querySelector('#urlClear').addEventListener('click', function () {
        input.value = '';
        hide();
        setHint('等待输入');
      });
      root.querySelector('#urlSample').addEventListener('click', function () {
        input.value = 'https://shop.example.com:8443/goods/list?keyword=机械键盘&page=2&sort=price%20asc#reviews';
        parse();
      });
      paramsTable.addEventListener('input', function (e) {
        if (e.target.closest('.up-k, .up-v')) rebuild();
      });
      paramsTable.addEventListener('click', function (e) {
        const del = e.target.closest('.up-del');
        if (!del) return;
        del.closest('tr').remove();
        updateCount();
        rebuild();
      });
      root.querySelector('#urlAdd').addEventListener('click', function () {
        const tb = paramsTable.querySelector('tbody');
        tb.appendChild(paramRow('', ''));
        updateCount();
        tb.lastElementChild.querySelector('.up-k').focus();
      });
      root.querySelector('#urlCopy').addEventListener('click', function () {
        Lib.copy(out.value, 'URL 已复制');
      });
      root.querySelector('#urlOpen').addEventListener('click', function () {
        if (!out.value) return;
        window.open(out.value, '_blank', 'noopener');
      });
    }
  });

  /* ============================ 文件哈希校验 ============================ */

  registerTool({
    id: 'file-hash',
    name: '文件哈希校验',
    group: '开发辅助',
    icon: 'hash',
    desc: '拖入文件计算 MD5 / SHA-1 / SHA-256，并与官方校验值比对',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="hash"></span>文件哈希校验</h1>' +
        '<p>拖入安装包、压缩包或任意文件，本地计算 MD5、SHA-1、SHA-256；粘贴官网公布的校验值即可判断文件是否完整。</p></div>' +
        '<div class="card">' +
        '  <div class="dropzone" id="fhDrop">' +
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>' +
        '    <b>拖入文件，或点击选择</b>' +
        '    <small>支持多选 · 文件不会上传，全部在本机计算</small>' +
        '    <input type="file" id="fhFile" multiple hidden>' +
        '  </div>' +
        '  <div class="row" style="margin-top:12px">' +
        '    <input class="input mono" id="fhExpect" placeholder="可选：粘贴官方校验值，自动比对" style="flex:1" spellcheck="false">' +
        '    <button class="btn ghost" id="fhClear">清空</button>' +
        '  </div>' +
        '  <div class="hint" id="fhHint" style="margin-top:9px">大文件计算会占用几秒，请耐心等待</div>' +
        '</div>' +
        '<div class="card is-hidden" id="fhCard"><div class="card-title">校验结果 <span class="ct-sub" id="fhCount"></span></div>' +
        '  <div class="hash-list" id="fhList"></div></div>';
    },
    mount: function (root) {
      const drop = root.querySelector('#fhDrop');
      const fileInput = root.querySelector('#fhFile');
      const expect = root.querySelector('#fhExpect');
      const hint = root.querySelector('#fhHint');
      const card = root.querySelector('#fhCard');
      const list = root.querySelector('#fhList');
      const countEl = root.querySelector('#fhCount');
      const records = [];
      let running = false;

      function updateCount() {
        countEl.textContent = records.length + ' 个文件';
      }

      function updateExpect() {
        const exp = expect.value.trim().toLowerCase().replace(/^sha(1|256)[-:\s]*/i, '');
        records.forEach(function (rec) {
          if (!rec.hashes || rec.skip) return;
          const state = rec.el.querySelector('.hi-state');
          if (!exp) {
            state.className = 'hi-state hint';
            state.textContent = '已完成';
            return;
          }
          let hit = '';
          if (rec.hashes.md5 === exp) hit = 'MD5';
          else if (rec.hashes.sha1 === exp) hit = 'SHA-1';
          else if (rec.hashes.sha256 === exp) hit = 'SHA-256';
          if (hit) {
            state.className = 'hi-state pill ok';
            state.textContent = '✓ 与 ' + hit + ' 匹配';
          } else {
            state.className = 'hi-state pill err';
            state.textContent = '✗ 不匹配';
          }
        });
      }

      async function handleFiles(files) {
        const arr = Array.prototype.slice.call(files || []);
        if (!arr.length) return;
        card.classList.remove('is-hidden');
        running = true;
        hint.className = 'hint';
        hint.textContent = '正在计算…';

        for (let idx = 0; idx < arr.length; idx++) {
          const file = arr[idx];
          const el = document.createElement('div');
          el.className = 'hash-item';
          el.innerHTML = '<div class="hi-head"><b>' + esc(file.name) + '</b>' +
            '<span class="hi-size">' + Lib.formatBytes(file.size) + '</span>' +
            '<span class="spacer"></span><span class="hi-state hint">计算中…</span></div>' +
            '<div class="hi-rows">' +
            [['md5', 'MD5'], ['sha1', 'SHA-1'], ['sha256', 'SHA-256']]
              .map(function (h) {
                return '<div class="hi-row"><span class="hi-k">' + h[1] + '</span>' +
                  '<code class="mono" data-h="' + h[0] + '">—</code>' +
                  '<button class="btn sm ghost" data-copy="" disabled>复制</button></div>';
              }).join('') + '</div>';
          list.appendChild(el);

          const rec = { name: file.name, el: el, hashes: null };
          records.push(rec);
          updateCount();

          if (file.size > 300 * 1024 * 1024) {
            rec.skip = true;
            el.querySelector('.hi-state').className = 'hi-state pill err';
            el.querySelector('.hi-state').textContent = '超过 300 MB，已跳过';
            rec.hashes = { md5: '', sha1: '', sha256: '' };
            continue;
          }

          await new Promise(function (r) { setTimeout(r, 16); });
          try {
            const buf = await file.arrayBuffer();
            const bytes = new Uint8Array(buf);
            const hashes = {
              md5: Lib.md5Bytes(bytes),
              sha1: Lib.sha1Bytes(bytes),
              sha256: Lib.sha256Bytes(bytes)
            };
            rec.hashes = hashes;
            Object.keys(hashes).forEach(function (k) {
              const code = el.querySelector('[data-h="' + k + '"]');
              code.textContent = hashes[k];
              const btn = code.parentNode.querySelector('[data-copy]');
              btn.setAttribute('data-copy', hashes[k]);
              btn.disabled = false;
            });
            el.querySelector('.hi-state').className = 'hi-state hint';
            el.querySelector('.hi-state').textContent = '已完成';
          } catch (err) {
            el.querySelector('.hi-state').className = 'hi-state pill err';
            el.querySelector('.hi-state').textContent = '读取失败';
          }
        }

        running = false;
        hint.className = 'hint ok';
        hint.textContent = '✓ 全部计算完成 · 共 ' + records.length + ' 个文件';
        updateExpect();
      }

      drop.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        handleFiles(fileInput.files);
        fileInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.add('drag');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.remove('drag');
        });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
      });
      expect.addEventListener('input', Lib.debounce(updateExpect, 120));
      root.querySelector('#fhClear').addEventListener('click', function () {
        if (running) return;
        records.length = 0;
        list.innerHTML = '';
        expect.value = '';
        card.classList.add('is-hidden');
        hint.className = 'hint';
        hint.textContent = '大文件计算会占用几秒，请耐心等待';
      });
    }
  });

  /* ============================ 文本对比 ============================ */

  function splitLines(s) {
    return String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n');
  }

  function diffOps(a, b) {
    let pre = 0;
    while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
    let sufA = a.length, sufB = b.length;
    while (sufA > pre && sufB > pre && a[sufA - 1] === b[sufB - 1]) { sufA--; sufB--; }

    const ops = [];
    for (let i = 0; i < pre; i++) ops.push({ t: '=', a: i + 1, b: i + 1, text: a[i] });

    const midA = a.slice(pre, sufA);
    const midB = b.slice(pre, sufB);
    const n = midA.length, m = midB.length;
    let overflow = false;

    if (n && m && n * m <= 1600000) {
      const W = m + 1;
      const dp = new Uint32Array((n + 1) * W);
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i * W + j] = midA[i] === midB[j]
            ? dp[(i + 1) * W + j + 1] + 1
            : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
        }
      }
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (midA[i] === midB[j]) {
          ops.push({ t: '=', a: pre + i + 1, b: pre + j + 1, text: midA[i] });
          i++; j++;
        } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) {
          ops.push({ t: '-', a: pre + i + 1, text: midA[i] });
          i++;
        } else {
          ops.push({ t: '+', b: pre + j + 1, text: midB[j] });
          j++;
        }
      }
      while (i < n) { ops.push({ t: '-', a: pre + i + 1, text: midA[i] }); i++; }
      while (j < m) { ops.push({ t: '+', b: pre + j + 1, text: midB[j] }); j++; }
    } else {
      if (n * m > 1600000) overflow = true;
      for (let i = 0; i < n; i++) ops.push({ t: '-', a: pre + i + 1, text: midA[i] });
      for (let j = 0; j < m; j++) ops.push({ t: '+', b: pre + j + 1, text: midB[j] });
    }

    for (let k = 0; k < a.length - sufA; k++) {
      ops.push({ t: '=', a: sufA + k + 1, b: sufB + k + 1, text: a[sufA + k] });
    }
    ops.overflow = overflow;
    return ops;
  }

  function highlightPair(a, b) {
    const max = Math.min(a.length, b.length);
    let p = 0;
    while (p < max && a.charAt(p) === b.charAt(p)) p++;
    let s = 0;
    while (s < max - p && a.charAt(a.length - 1 - s) === b.charAt(b.length - 1 - s)) s++;
    const aMid = a.slice(p, a.length - s);
    const bMid = b.slice(p, b.length - s);
    if (!aMid && !bMid) return [esc(a), esc(b)];
    return [
      esc(a.slice(0, p)) + (aMid ? '<mark class="df-hl">' + esc(aMid) + '</mark>' : '') + esc(a.slice(a.length - s)),
      esc(b.slice(0, p)) + (bMid ? '<mark class="df-hl">' + esc(bMid) + '</mark>' : '') + esc(b.slice(b.length - s))
    ];
  }

  registerTool({
    id: 'diff',
    name: '文本对比',
    group: '文本处理',
    icon: 'diff',
    desc: '逐行对比两段文本或代码，高亮新增与删除，可复制 unified diff',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="diff"></span>文本对比 Diff</h1>' +
        '<p>逐行比对两段文本、配置或代码，标出新增与删除的行；可选忽略空白与大小写，并复制标准 unified diff。</p></div>' +
        '<div class="card">' +
        '  <div class="grid-2">' +
        '    <label class="field"><span>原文本</span><textarea class="input mid" id="dfA" spellcheck="false" placeholder="粘贴旧版本内容"></textarea></label>' +
        '    <label class="field"><span>新文本</span><textarea class="input mid" id="dfB" spellcheck="false" placeholder="粘贴新版本内容"></textarea></label>' +
        '  </div>' +
        '  <div class="row" style="margin-top:10px">' +
        '    <label class="check"><input type="checkbox" id="dfSpace">忽略空白</label>' +
        '    <label class="check"><input type="checkbox" id="dfCase">忽略大小写</label>' +
        '    <div class="tabs" id="dfMode"><button data-mode="split" class="active">并排</button><button data-mode="unified">统一</button></div>' +
        '    <span class="spacer"></span>' +
        '    <button class="btn sm" id="dfSample">示例</button>' +
        '    <button class="btn sm" id="dfClear">清空</button>' +
        '  </div>' +
        '</div>' +
        '<div class="card"><div class="card-title">差异 <span class="ct-sub" id="dfStats"></span></div>' +
        '  <div class="diff-view" id="dfView"><div class="empty">两侧输入文本后自动对比</div></div>' +
        '  <div class="row" style="margin-top:10px">' +
        '    <button class="btn sm" id="dfCopy">复制 unified diff</button>' +
        '    <span class="spacer"></span><span class="hint" id="dfNote"></span>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const taA = root.querySelector('#dfA');
      const taB = root.querySelector('#dfB');
      const ignoreSpace = root.querySelector('#dfSpace');
      const ignoreCase = root.querySelector('#dfCase');
      const modeBox = root.querySelector('#dfMode');
      const view = root.querySelector('#dfView');
      const stats = root.querySelector('#dfStats');
      const note = root.querySelector('#dfNote');
      let mode = window.innerWidth < 720 ? 'unified' : 'split';
      let lastPatch = '';
      let lastOps = [];
      if (mode === 'unified') {
        modeBox.querySelectorAll('button').forEach(function (x) {
          x.classList.toggle('active', x.dataset.mode === 'unified');
        });
      }

      function norm(line) {
        let s = line;
        if (ignoreCase.checked) s = s.toLowerCase();
        if (ignoreSpace.checked) s = s.replace(/\s+/g, ' ').trim();
        return s;
      }

      function renderRows(rows) {
        return rows.map(function (row) {
          const l = row.l, r = row.r;
          let lh = '', rh = '';
          if (l && r && l.t === '-' && r.t === '+') {
            const hl = highlightPair(l.text, r.text);
            lh = hl[0]; rh = hl[1];
          } else {
            lh = l ? esc(l.text) : '';
            rh = r ? esc(r.text) : '';
          }
          return '<div class="df-row">' +
            '<span class="df-n">' + (l ? l.a : '') + '</span>' +
            '<span class="df-c ' + (l ? (l.t === '-' ? 'df-del' : 'df-same') : 'df-blank') + '">' + (l ? (lh || '\u200b') : '') + '</span>' +
            '<span class="df-n">' + (r ? r.b : '') + '</span>' +
            '<span class="df-c ' + (r ? (r.t === '+' ? 'df-add' : 'df-same') : 'df-blank') + '">' + (r ? (rh || '\u200b') : '') + '</span>' +
            '</div>';
        }).join('');
      }

      function buildRows(ops) {
        const rows = [];
        let i = 0;
        while (i < ops.length) {
          if (ops[i].t === '-') {
            const dels = [];
            while (i < ops.length && ops[i].t === '-') { dels.push(ops[i]); i++; }
            const adds = [];
            while (i < ops.length && ops[i].t === '+') { adds.push(ops[i]); i++; }
            const max = Math.max(dels.length, adds.length);
            for (let k = 0; k < max; k++) rows.push({ l: dels[k], r: adds[k] });
          } else if (ops[i].t === '+') {
            while (i < ops.length && ops[i].t === '+') {
              rows.push({ r: ops[i] });
              i++;
            }
          } else {
            rows.push({ l: ops[i], r: ops[i] });
            i++;
          }
        }
        return rows;
      }

      function render() {
        const rawA = taA.value, rawB = taB.value;
        if (!rawA && !rawB) {
          view.innerHTML = '<div class="empty">两侧输入文本后自动对比</div>';
          stats.textContent = '';
          note.textContent = '';
          lastPatch = '';
          return;
        }
        const A = splitLines(rawA).map(norm);
        const B = splitLines(rawB).map(norm);
        const ops = diffOps(A, B);
        lastOps = ops;

        let add = 0, del = 0, same = 0;
        ops.forEach(function (o) {
          if (o.t === '+') add++;
          else if (o.t === '-') del++;
          else same++;
        });
        stats.innerHTML = '<span class="df-stat-add">+' + add + '</span> <span class="df-stat-del">-' + del + '</span> ' +
          '相同 ' + same + ' 行';

        const rows = buildRows(ops);
        const LIMIT = 3000;
        let html = '';
        if (mode === 'split') {
          html = '<div class="diff-split">' + renderRows(rows.slice(0, LIMIT)) + '</div>';
        } else {
          html = '<div class="diff-uni">' + ops.slice(0, LIMIT).map(function (o) {
            return '<div class="df-row">' +
              '<span class="df-n">' + (o.a || '') + '</span>' +
              '<span class="df-n">' + (o.b || '') + '</span>' +
              '<span class="df-c ' + (o.t === '+' ? 'df-add' : o.t === '-' ? 'df-del' : 'df-same') + '">' +
              '<span class="df-sign">' + (o.t === '=' ? ' ' : o.t) + '</span>' +
              (esc(o.text) || '\u200b') + '</span></div>';
          }).join('') + '</div>';
        }
        view.innerHTML = html;

        if (rows.length > LIMIT || ops.length > LIMIT) {
          note.textContent = '内容较多，仅渲染前 ' + LIMIT + ' 行';
        } else {
          note.textContent = ops.overflow ? '内容过大，已退化为逐行对齐' : '';
        }

        const aTotal = splitLines(rawA).length;
        const bTotal = splitLines(rawB).length;
        lastPatch = '--- 原文本\n+++ 新文本\n@@ -1,' + aTotal + ' +1,' + bTotal + ' @@\n' +
          ops.map(function (o) { return (o.t === '=' ? ' ' : o.t) + o.text; }).join('\n');
      }

      const live = Lib.debounce(render, 200);
      taA.addEventListener('input', live);
      taB.addEventListener('input', live);
      ignoreSpace.addEventListener('change', render);
      ignoreCase.addEventListener('change', render);
      modeBox.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b) return;
        mode = b.dataset.mode;
        modeBox.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
        render();
      });
      root.querySelector('#dfCopy').addEventListener('click', function () {
        Lib.copy(lastPatch, 'unified diff 已复制');
      });
      root.querySelector('#dfClear').addEventListener('click', function () {
        taA.value = '';
        taB.value = '';
        render();
      });
      root.querySelector('#dfSample').addEventListener('click', function () {
        taA.value = 'function greet(name) {\n  const msg = "Hello, " + name;\n  console.log(msg);\n  return msg;\n}\n\ngreet("world");';
        taB.value = 'function greet(name, punctuation = "!") {\n  const msg = `Hello, ${name}${punctuation}`;\n  console.log(msg);\n  return msg;\n}\n\ngreet("Fancun");';
        render();
      });
    }
  });

  /* ============================ 颜色工具 ============================ */

  function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }

  function hexToRgb(hex) {
    let s = String(hex).trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(s)) throw new Error('HEX 需为 #RGB 或 #RRGGBB');
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function rgbToHex(c) {
    return '#' + [c.r, c.g, c.b].map(function (v) { return clamp255(v).toString(16).padStart(2, '0'); }).join('');
  }

  function rgbToHsl(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = Math.max(0, Math.min(100, s)) / 100;
    l = Math.max(0, Math.min(100, l)) / 100;
    if (s === 0) {
      const v = l * 255;
      return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
      r: hue2rgb(p, q, h + 1 / 3) * 255,
      g: hue2rgb(p, q, h) * 255,
      b: hue2rgb(p, q, h - 1 / 3) * 255
    };
  }

  function rgbToHsv(c) {
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: Math.round(h), s: Math.round((max ? d / max : 0) * 100), v: Math.round(max * 100) };
  }

  function relLum(c) {
    const f = function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }

  function contrastRatio(a, b) {
    const l1 = relLum(a), l2 = relLum(b);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function mixRgb(c, target, t) {
    return {
      r: c.r + (target.r - c.r) * t,
      g: c.g + (target.g - c.g) * t,
      b: c.b + (target.b - c.b) * t
    };
  }

  function textOn(c) {
    return relLum(c) > 0.45 ? '#12141a' : '#ffffff';
  }

  registerTool({
    id: 'color',
    name: '颜色工具',
    group: '生成器',
    icon: 'palette',
    desc: 'HEX / RGB / HSL / HSV 互转，明暗梯度、配色方案与 WCAG 对比度检测',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="palette"></span>颜色转换与对比度</h1>' +
        '<p>在 HEX、RGB、HSL、HSV 之间实时转换，生成明暗梯度与配色方案，并按 WCAG 标准检查文字对比度。</p></div>' +
        '<div class="grid-2 wide-left">' +
        '  <div class="card">' +
        '    <div class="card-title">取色 <span class="ct-sub">点击色块复制 HEX</span></div>' +
        '    <div class="color-hero" id="cHero"><span id="cHeroHex">#4F46E5</span>' +
        '      <button class="btn sm" id="cHeroCopy">复制</button></div>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <input type="color" id="cPick" class="color-input" value="#4f46e5" aria-label="选择颜色">' +
        '      <input class="input mono" id="cHex" value="#4F46E5" maxlength="7" spellcheck="false" style="flex:1">' +
        '      <button class="btn" id="cRandom">随机</button>' +
        '    </div>' +
        '    <div class="grid-3 color-nums" style="margin-top:12px">' +
        '      <label class="field"><span>R</span><input class="input mono" id="cR" type="number" min="0" max="255" value="79"></label>' +
        '      <label class="field"><span>G</span><input class="input mono" id="cG" type="number" min="0" max="255" value="70"></label>' +
        '      <label class="field"><span>B</span><input class="input mono" id="cB" type="number" min="0" max="255" value="229"></label>' +
        '    </div>' +
        '    <div class="grid-3 color-nums" style="margin-top:10px">' +
        '      <label class="field"><span>H (°)</span><input class="input mono" id="cH" type="number" min="0" max="360" value="243"></label>' +
        '      <label class="field"><span>S (%)</span><input class="input mono" id="cS" type="number" min="0" max="100" value="76"></label>' +
        '      <label class="field"><span>L (%)</span><input class="input mono" id="cL" type="number" min="0" max="100" value="59"></label>' +
        '    </div>' +
        '    <div class="res-list" id="cFormats" style="margin-top:14px"></div>' +
        '  </div>' +
        '  <div>' +
        '    <div class="card">' +
        '      <div class="card-title">WCAG 对比度 <span class="ct-sub">当前文字色 / 背景色</span></div>' +
        '      <div class="row"><input type="color" id="cBg" class="color-input" value="#ffffff" aria-label="背景色">' +
        '        <input class="input mono" id="cBgHex" value="#FFFFFF" maxlength="7" spellcheck="false" style="flex:1">' +
        '        <span class="pill" id="cRatio">—</span></div>' +
        '      <div class="wcag-list" id="cWcag"></div>' +
        '    </div>' +
        '    <div class="card"><div class="card-title">明暗梯度</div><div class="shade-row" id="cShades"></div></div>' +
        '    <div class="card"><div class="card-title">配色方案</div><div class="shade-row" id="cPalette"></div></div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const pick = root.querySelector('#cPick');
      const hexIn = root.querySelector('#cHex');
      const rIn = root.querySelector('#cR'), gIn = root.querySelector('#cG'), bIn = root.querySelector('#cB');
      const hIn = root.querySelector('#cH'), sIn = root.querySelector('#cS'), lIn = root.querySelector('#cL');
      const hero = root.querySelector('#cHero');
      const heroHex = root.querySelector('#cHeroHex');
      const formats = root.querySelector('#cFormats');
      const bgPick = root.querySelector('#cBg');
      const bgHexIn = root.querySelector('#cBgHex');
      const ratioEl = root.querySelector('#cRatio');
      const wcag = root.querySelector('#cWcag');
      const shadesBox = root.querySelector('#cShades');
      const paletteBox = root.querySelector('#cPalette');
      let rgb = { r: 79, g: 70, b: 229 };
      let bgRgb = { r: 255, g: 255, b: 255 };

      function setColor(next, source) {
        rgb = { r: clamp255(next.r), g: clamp255(next.g), b: clamp255(next.b) };
        const hex = rgbToHex(rgb);
        if (source !== 'hex') hexIn.value = hex.toUpperCase();
        if (source !== 'pick') pick.value = hex;
        if (source !== 'rgb') { rIn.value = rgb.r; gIn.value = rgb.g; bIn.value = rgb.b; }
        if (source !== 'hsl') {
          const hsl = rgbToHsl(rgb);
          hIn.value = hsl.h; sIn.value = hsl.s; lIn.value = hsl.l;
        }
        render();
      }

      function chip(c, extra) {
        const hex = rgbToHex(c);
        return '<button class="shade" data-copy="' + hex + '" title="点击复制 ' + hex.toUpperCase() + '">' +
          '<span class="shade-box" style="background:' + hex + '"></span>' +
          '<span class="shade-hex">' + (extra || hex.toUpperCase()) + '</span></button>';
      }

      function render() {
        const hex = rgbToHex(rgb);
        const hsl = rgbToHsl(rgb);
        const hsv = rgbToHsv(rgb);
        hero.style.background = hex;
        hero.style.color = textOn(rgb);
        heroHex.textContent = hex.toUpperCase();

        const formats_ = [
          ['HEX', hex.toUpperCase()],
          ['RGB', 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'],
          ['HSL', 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)'],
          ['HSV', 'hsv(' + hsv.h + ', ' + hsv.s + '%, ' + hsv.v + '%)'],
          ['CSS 变量', '--color: ' + hex + ';']
        ];
        formats.innerHTML = formats_.map(function (f) {
          return '<div class="res-row"><span class="res-label">' + f[0] + '</span>' +
            '<span class="res-value mono">' + esc(f[1]) + '</span>' +
            '<span class="res-actions"><button class="btn sm" data-copy="' + esc(f[1]) + '">复制</button></span></div>';
        }).join('');

        const ratio = contrastRatio(rgb, bgRgb);
        ratioEl.textContent = ratio.toFixed(2) + ':1';
        ratioEl.className = 'pill ' + (ratio >= 4.5 ? 'ok' : ratio >= 3 ? 'warn' : 'err');
        const checks = [
          ['AA 正文（4.5:1）', 4.5],
          ['AA 大字（3:1）', 3],
          ['AAA 正文（7:1）', 7],
          ['AAA 大字（4.5:1）', 4.5]
        ];
        wcag.innerHTML = checks.map(function (c) {
          const pass = ratio >= c[1];
          return '<div class="wcag-row"><span>' + c[0] + '</span>' +
            '<span class="pill ' + (pass ? 'ok' : 'err') + '">' + (pass ? '通过' : '不通过') + '</span></div>';
        }).join('');

        const white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
        shadesBox.innerHTML = [0.8, 0.6, 0.4, 0.2].map(function (t) { return chip(mixRgb(rgb, white, t)); }).join('') +
          chip(rgb, 'BASE') +
          [0.2, 0.4, 0.6, 0.8].map(function (t) { return chip(mixRgb(rgb, black, t)); }).join('');

        const palette = [
          hslToRgb(hsl.h, hsl.s, hsl.l),
          hslToRgb(hsl.h + 30, hsl.s, hsl.l),
          hslToRgb(hsl.h - 30, hsl.s, hsl.l),
          hslToRgb(hsl.h + 180, hsl.s, hsl.l),
          hslToRgb(hsl.h + 120, hsl.s, hsl.l)
        ];
        paletteBox.innerHTML = palette.map(function (c) { return chip(c); }).join('');
      }

      pick.addEventListener('input', function () { setColor(hexToRgb(pick.value), 'pick'); });
      hexIn.addEventListener('input', function () {
        try { setColor(hexToRgb(hexIn.value), 'hex'); } catch (e) { /* 输入未完成时忽略 */ }
      });
      [rIn, gIn, bIn].forEach(function (el) {
        el.addEventListener('input', function () {
          const r = parseInt(rIn.value, 10), g = parseInt(gIn.value, 10), b = parseInt(bIn.value, 10);
          if ([r, g, b].some(function (v) { return isNaN(v); })) return;
          setColor({ r: r, g: g, b: b }, 'rgb');
        });
      });
      [hIn, sIn, lIn].forEach(function (el) {
        el.addEventListener('input', function () {
          const h = parseFloat(hIn.value), s = parseFloat(sIn.value), l = parseFloat(lIn.value);
          if ([h, s, l].some(function (v) { return isNaN(v); })) return;
          setColor(hslToRgb(h, s, l), 'hsl');
        });
      });
      root.querySelector('#cRandom').addEventListener('click', function () {
        setColor({ r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 }, 'random');
      });
      root.querySelector('#cHeroCopy').addEventListener('click', function () {
        Lib.copy(rgbToHex(rgb).toUpperCase(), '颜色已复制');
      });

      bgPick.addEventListener('input', function () {
        bgRgb = hexToRgb(bgPick.value);
        bgHexIn.value = bgPick.value.toUpperCase();
        render();
      });
      bgHexIn.addEventListener('input', function () {
        try {
          bgRgb = hexToRgb(bgHexIn.value);
          bgPick.value = rgbToHex(bgRgb);
          render();
        } catch (e) { /* ignore */ }
      });

      setColor(rgb, 'init');
    }
  });
})();
