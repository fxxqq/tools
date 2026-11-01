/* ==========================================================================
   tools-media.js · 图片压缩 / 图片格式转换 / 二维码生成
   ========================================================================== */
(function () {
  'use strict';

  const esc = function (s) { return Lib.escapeHtml(s); };

  /* ---------------- 图片公共方法 ---------------- */
  function decodeImage(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file).then(function (bmp) {
        return { source: bmp, width: bmp.width, height: bmp.height, release: function () { bmp.close && bmp.close(); } };
      }).catch(function () { return decodeByImg(file); });
    }
    return decodeByImg(file);
  }

  function decodeByImg(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        resolve({
          source: img, width: img.naturalWidth, height: img.naturalHeight,
          release: function () { URL.revokeObjectURL(url); }
        });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('无法解析该图片')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('浏览器不支持导出该格式'));
      }, mime, quality);
    });
  }

  function drawResized(source, sw, sh, maxEdge, bg) {
    let w = sw, h = sh;
    if (maxEdge > 0 && Math.max(sw, sh) > maxEdge) {
      const scale = maxEdge / Math.max(sw, sh);
      w = Math.max(1, Math.round(sw * scale));
      h = Math.max(1, Math.round(sh * scale));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    return { canvas: canvas, width: w, height: h };
  }

  function extOf(mime) {
    return { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime] || 'png';
  }

  function baseName(name) { return String(name).replace(/\.[^.]+$/, ''); }

  function supportsType(mime) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    try { return c.toDataURL(mime).indexOf('data:' + mime) === 0; } catch (e) { return false; }
  }

  /* ============================ 图片压缩 ============================ */

  registerTool({
    id: 'img-compress',
    name: '图片压缩',
    group: '图片工具',
    icon: 'image',
    desc: '批量压缩 JPG / PNG / WEBP，可调质量与尺寸，实时对比体积',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="image"></span>图片压缩</h1>' +
        '<p>纯浏览器本地压缩，图片不会上传到任何服务器。支持批量处理、自定义质量与最大边长，并显示压缩前后体积对比。</p></div>' +
        '<div class="card">' +
        '  <div class="dropzone" id="icDrop">' +
        '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><path d="M17 8l-5-5-5 5"></path><path d="M12 3v13"></path></svg>' +
        '    <b>点击或拖拽图片到这里</b>' +
        '    <small>支持 JPG / PNG / WEBP / GIF（静态帧），可多选</small>' +
        '  </div>' +
        '  <input type="file" id="icFile" accept="image/*" multiple hidden>' +
        '  <div class="row" style="margin-top:14px">' +
        '    <label class="field" style="width:210px"><span>质量 <b class="mono" id="icQVal">80%</b></span>' +
        '      <input type="range" id="icQuality" min="10" max="100" value="80" style="width:100%;accent-color:var(--accent)"></label>' +
        '    <label class="field" style="width:150px"><span>最大边长（px）</span>' +
        '      <input class="input sm" type="number" id="icMaxEdge" value="1920" min="0" step="10" placeholder="0 = 不缩放"></label>' +
        '    <label class="field" style="width:150px"><span>输出格式</span>' +
        '      <select class="input sm" id="icFormat">' +
        '        <option value="auto">保持原格式</option><option value="jpeg">JPEG</option>' +
        '        <option value="webp">WEBP</option><option value="png">PNG</option>' +
        '      </select></label>' +
        '    <span class="spacer"></span>' +
        '    <button class="btn" id="icClear">清空列表</button>' +
        '    <button class="btn primary" id="icDownloadAll">全部下载</button>' +
        '  </div>' +
        '  <div class="hint" id="icSummary" style="margin-top:10px">尚未选择图片</div>' +
        '  <div class="hint" style="margin-top:4px">PNG 为无损格式，重编码压缩空间有限；想要更小体积可把输出格式切到 WEBP。</div>' +
        '</div>' +
        '<div class="card" id="icListCard" style="display:none">' +
        '  <div class="card-title">处理结果 <span class="ct-sub" id="icCount"></span></div>' +
        '  <div class="file-list" id="icList"></div>' +
        '</div>';
    },
    mount: function (root) {
      const drop = root.querySelector('#icDrop');
      const fileInput = root.querySelector('#icFile');
      const quality = root.querySelector('#icQuality');
      const qVal = root.querySelector('#icQVal');
      const maxEdgeInput = root.querySelector('#icMaxEdge');
      const formatSel = root.querySelector('#icFormat');
      const listCard = root.querySelector('#icListCard');
      const list = root.querySelector('#icList');
      const summary = root.querySelector('#icSummary');
      const countEl = root.querySelector('#icCount');
      const entries = [];
      let uid = 0;

      function options() {
        return {
          quality: parseInt(quality.value, 10) / 100,
          maxEdge: Math.max(0, parseInt(maxEdgeInput.value, 10) || 0),
          format: formatSel.value
        };
      }

      function renderSummary() {
        if (!entries.length) {
          summary.textContent = '尚未选择图片';
          listCard.style.display = 'none';
          return;
        }
        listCard.style.display = '';
        const before = entries.reduce(function (a, e) { return a + e.file.size; }, 0);
        const after = entries.reduce(function (a, e) { return a + (e.blob ? e.blob.size : e.file.size); }, 0);
        const done = entries.filter(function (e) { return e.blob; }).length;
        const pct = before ? ((1 - after / before) * 100) : 0;
        const pctText = Math.abs(pct) < 0.1
          ? '<span class="hint">体积基本持平</span>'
          : (pct > 0
            ? '<span class="delta-down">节省 ' + pct.toFixed(1) + '%</span>'
            : '<span class="delta-up">增大 ' + Math.abs(pct).toFixed(1) + '%</span>');
        countEl.textContent = done + ' / ' + entries.length + ' 张';
        summary.innerHTML = '共 <b>' + entries.length + '</b> 张，原始 <b>' + Lib.formatBytes(before) + '</b> → 压缩后 <b>' +
          Lib.formatBytes(after) + '</b>，' + pctText;
      }

      function render() {
        renderSummary();
        list.innerHTML = entries.map(function (e) {
          const delta = e.blob ? e.blob.size - e.file.size : 0;
          const pct = e.blob && e.file.size ? (delta / e.file.size) * 100 : 0;
          const cls = pct <= 0 ? 'delta-down' : 'delta-up';
          const sizeLine = e.blob
            ? '<span>' + Lib.formatBytes(e.file.size) + '</span><span>→</span><span class="' + cls + '">' + Lib.formatBytes(e.blob.size) +
            ' (' + (pct > 0 ? '+' : '') + pct.toFixed(1) + '%)</span>'
            : '<span>' + Lib.formatBytes(e.file.size) + '</span><span class="hint">处理中…</span>';
          const dim = e.outW ? '<span>' + e.width + '×' + e.height + ' → ' + e.outW + '×' + e.outH + '</span>' : '<span>' + e.width + '×' + e.height + '</span>';
          return '<div class="file-item" data-id="' + e.id + '">' +
            '<img src="' + e.thumb + '" alt="">' +
            '<div><div class="fi-name">' + esc(e.file.name) + '</div>' +
            '<div class="fi-meta">' + sizeLine + dim + '</div></div>' +
            '<div class="fi-actions">' +
            '<button class="btn sm" data-act="download"' + (e.blob ? '' : ' disabled') + '>下载</button>' +
            '<button class="btn sm ghost" data-act="remove">移除</button>' +
            '</div></div>';
        }).join('');
      }

      function processEntry(entry, opts) {
        entry.blob = null;
        return decodeImage(entry.file).then(function (decoded) {
          entry.width = decoded.width;
          entry.height = decoded.height;
          let mime;
          if (opts.format === 'auto') {
            mime = entry.file.type === 'image/png' || entry.file.type === 'image/gif' ? 'image/png' : 'image/jpeg';
            if (entry.file.type === 'image/webp') mime = 'image/webp';
          } else {
            mime = 'image/' + opts.format;
          }
          if (!supportsType(mime)) mime = 'image/jpeg';
          const size = drawResized(decoded.source, decoded.width, decoded.height, opts.maxEdge,
            mime === 'image/jpeg' ? '#ffffff' : null);
          entry.outW = size.width;
          entry.outH = size.height;
          const q = mime === 'image/png' ? undefined : opts.quality;
          return canvasToBlob(size.canvas, mime, q).then(function (blob) {
            entry.blob = blob;
            entry.mime = mime;
            entry.outName = baseName(entry.file.name) + '-min.' + extOf(mime);
            decoded.release();
            return entry;
          });
        }).catch(function (err) {
          entry.error = err.message;
          return entry;
        });
      }

      function reprocess() {
        const opts = options();
        qVal.textContent = quality.value + '%';
        entries.forEach(function (e) {
          processEntry(e, opts).then(render);
        });
        render();
      }

      function addFiles(files) {
        const arr = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
        if (!arr.length) return Lib.toast('请选择图片文件', 'err');
        arr.forEach(function (f) {
          entries.push({
            id: 'ic' + (++uid), file: f, width: 0, height: 0,
            thumb: URL.createObjectURL(f), blob: null
          });
        });
        render();
        reprocess();
      }

      drop.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        addFiles(fileInput.files);
        fileInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      });

      quality.addEventListener('input', Lib.debounce(reprocess, 320));
      maxEdgeInput.addEventListener('change', reprocess);
      formatSel.addEventListener('change', reprocess);

      root.querySelector('#icClear').addEventListener('click', function () {
        entries.forEach(function (e) { URL.revokeObjectURL(e.thumb); });
        entries.length = 0;
        render();
      });

      root.querySelector('#icDownloadAll').addEventListener('click', function () {
        const ready = entries.filter(function (e) { return e.blob; });
        if (!ready.length) return Lib.toast('还没有可下载的图片', 'err');
        ready.forEach(function (e, i) {
          setTimeout(function () { Lib.downloadBlob(e.blob, e.outName); }, i * 350);
        });
        Lib.toast('开始下载 ' + ready.length + ' 张图片', 'ok');
      });

      list.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const item = e.target.closest('.file-item');
        const entry = entries.find(function (x) { return x.id === item.dataset.id; });
        if (!entry) return;
        if (btn.dataset.act === 'download') {
          if (entry.blob) Lib.downloadBlob(entry.blob, entry.outName);
        } else {
          URL.revokeObjectURL(entry.thumb);
          entries.splice(entries.indexOf(entry), 1);
          render();
        }
      });
    }
  });

  /* ============================ 图片格式转换 ============================ */

  registerTool({
    id: 'img-convert',
    name: '图片格式转换',
    group: '图片工具',
    icon: 'convert',
    desc: 'JPG / PNG / WEBP 互转，可设置质量、背景色与尺寸',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="convert"></span>图片格式转换</h1>' +
        '<p>在 JPG / PNG / WEBP 之间转换，透明图转 JPG 时可指定背景色，同时支持按边长缩放。</p></div>' +
        '<div class="grid-2 wide-left">' +
        '  <div class="card">' +
        '    <div class="card-title">转换设置</div>' +
        '    <div class="dropzone" id="cvDrop">' +
        '      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
        '        <rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle>' +
        '        <path d="M21 15l-5-5L5 21"></path></svg>' +
        '      <b>点击或拖拽图片到这里</b><small>可多选，格式自动识别</small>' +
        '    </div>' +
        '    <input type="file" id="cvFile" accept="image/*" multiple hidden>' +
        '    <div class="row" style="margin-top:14px">' +
        '      <label class="field" style="width:130px"><span>目标格式</span>' +
        '        <select class="input sm" id="cvFormat"><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp" selected>WEBP</option></select></label>' +
        '      <label class="field" style="width:160px"><span>质量 <b class="mono" id="cvQVal">90%</b></span>' +
        '        <input type="range" id="cvQuality" min="10" max="100" value="90" style="width:100%;accent-color:var(--accent)"></label>' +
        '      <label class="field" style="width:120px"><span>背景色（JPG）</span>' +
        '        <input class="input sm" type="color" id="cvBg" value="#ffffff" style="padding:2px;height:34px"></label>' +
        '    </div>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <label class="field" style="width:150px"><span>最大边长（0 = 原尺寸）</span>' +
        '        <input class="input sm" type="number" id="cvMaxEdge" value="0" min="0" step="10"></label>' +
        '      <span class="spacer"></span>' +
        '      <button class="btn" id="cvClear">清空</button>' +
        '    </div>' +
        '    <div class="hint" id="cvStatus" style="margin-top:10px">选择图片后自动转换</div>' +
        '    <div class="file-list" id="cvList" style="max-height:320px;overflow:auto"></div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">预览 <span class="ct-sub" id="cvMeta"></span></div>' +
        '    <div class="qr-stage" style="min-height:300px;align-items:flex-start">' +
        '      <div id="cvPreview" class="hint" style="margin:auto">转换后的图片会显示在这里</div>' +
        '    </div>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <button class="btn primary" id="cvDownload">下载当前图片</button>' +
        '      <button class="btn" id="cvDownloadAll">全部下载</button>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const drop = root.querySelector('#cvDrop');
      const fileInput = root.querySelector('#cvFile');
      const formatSel = root.querySelector('#cvFormat');
      const quality = root.querySelector('#cvQuality');
      const qVal = root.querySelector('#cvQVal');
      const bg = root.querySelector('#cvBg');
      const maxEdge = root.querySelector('#cvMaxEdge');
      const listEl = root.querySelector('#cvList');
      const status = root.querySelector('#cvStatus');
      const preview = root.querySelector('#cvPreview');
      const meta = root.querySelector('#cvMeta');
      const entries = [];
      let uid = 0, activeId = null;

      function opts() {
        return {
          mime: 'image/' + formatSel.value,
          quality: parseInt(quality.value, 10) / 100,
          bg: bg.value,
          maxEdge: Math.max(0, parseInt(maxEdge.value, 10) || 0)
        };
      }

      function render() {
        listEl.innerHTML = entries.map(function (e) {
          return '<div class="file-item" data-id="' + e.id + '"' + (e.id === activeId ? ' style="border-color:var(--accent);background:var(--accent-soft)"' : '') + '>' +
            '<img src="' + e.thumb + '" alt="">' +
            '<div><div class="fi-name">' + esc(e.file.name) + '</div>' +
            '<div class="fi-meta"><span>' + Lib.formatBytes(e.file.size) + '</span><span>→</span>' +
            '<span class="' + (e.blob && e.blob.size < e.file.size ? 'delta-down' : '') + '">' +
            (e.blob ? Lib.formatBytes(e.blob.size) : '处理中…') + '</span>' +
            (e.outW ? '<span>' + e.outW + '×' + e.outH + '</span>' : '') +
            '<span class="pill accent">' + (e.blob ? e.mime.replace('image/', '').toUpperCase() : '…') + '</span></div></div>' +
            '<div class="fi-actions"><button class="btn sm" data-act="download"' + (e.blob ? '' : ' disabled') + '>下载</button></div>' +
            '</div>';
        }).join('');
        const active = entries.find(function (e) { return e.id === activeId; });
        if (active && active.previewUrl) {
          preview.innerHTML = '<img src="' + active.previewUrl + '" alt="预览" style="max-width:100%;max-height:340px;border-radius:8px;box-shadow:var(--shadow)">';
          meta.textContent = active.outW + '×' + active.outH + ' · ' + Lib.formatBytes(active.blob.size);
        } else if (!entries.length) {
          preview.innerHTML = '<span class="hint">转换后的图片会显示在这里</span>';
          meta.textContent = '';
        }
      }

      function convertEntry(entry, o) {
        return decodeImage(entry.file).then(function (decoded) {
          const useBg = o.mime === 'image/jpeg' ? o.bg : null;
          const size = drawResized(decoded.source, decoded.width, decoded.height, o.maxEdge, useBg);
          entry.outW = size.width;
          entry.outH = size.height;
          const mime = supportsType(o.mime) ? o.mime : 'image/png';
          return canvasToBlob(size.canvas, mime, mime === 'image/png' ? undefined : o.quality).then(function (blob) {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
            entry.blob = blob;
            entry.mime = mime;
            entry.previewUrl = URL.createObjectURL(blob);
            entry.outName = baseName(entry.file.name) + '.' + extOf(mime);
            decoded.release();
            return entry;
          });
        }).catch(function (err) {
          Lib.toast('转换失败：' + err.message, 'err');
          return entry;
        });
      }

      function runAll() {
        const o = opts();
        qVal.textContent = quality.value + '%';
        if (!entries.length) return;
        status.textContent = '正在转换为 ' + o.mime.replace('image/', '').toUpperCase() + '…';
        let finished = 0;
        entries.forEach(function (e) {
          convertEntry(e, o).then(function () {
            finished++;
            render();
            if (finished === entries.length) status.textContent = '✓ 全部转换完成，共 ' + entries.length + ' 张';
          });
        });
        render();
      }

      function addFiles(files) {
        const arr = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
        if (!arr.length) return Lib.toast('请选择图片文件', 'err');
        arr.forEach(function (f) {
          entries.push({ id: 'cv' + (++uid), file: f, thumb: URL.createObjectURL(f), blob: null });
        });
        if (!activeId) activeId = entries[0].id;
        runAll();
      }

      drop.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      });

      [formatSel, bg].forEach(function (el) { el.addEventListener('change', runAll); });
      maxEdge.addEventListener('change', runAll);
      quality.addEventListener('input', Lib.debounce(runAll, 350));

      listEl.addEventListener('click', function (e) {
        const item = e.target.closest('.file-item');
        if (!item) return;
        const entry = entries.find(function (x) { return x.id === item.dataset.id; });
        if (!entry) return;
        if (e.target.closest('[data-act="download"]')) {
          if (entry.blob) Lib.downloadBlob(entry.blob, entry.outName);
          return;
        }
        activeId = entry.id;
        render();
      });

      root.querySelector('#cvClear').addEventListener('click', function () {
        entries.forEach(function (e) {
          URL.revokeObjectURL(e.thumb);
          if (e.previewUrl) URL.revokeObjectURL(e.previewUrl);
        });
        entries.length = 0;
        activeId = null;
        status.textContent = '选择图片后自动转换';
        render();
      });

      root.querySelector('#cvDownload').addEventListener('click', function () {
        const active = entries.find(function (e) { return e.id === activeId; });
        if (!active || !active.blob) return Lib.toast('还没有可下载的图片', 'err');
        Lib.downloadBlob(active.blob, active.outName);
      });

      root.querySelector('#cvDownloadAll').addEventListener('click', function () {
        const ready = entries.filter(function (e) { return e.blob; });
        if (!ready.length) return Lib.toast('还没有可下载的图片', 'err');
        ready.forEach(function (e, i) {
          setTimeout(function () { Lib.downloadBlob(e.blob, e.outName); }, i * 350);
        });
      });
    }
  });

  /* ============================ 二维码 ============================ */

  function roundRectPath(ctx, x, y, w, h, r) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  registerTool({
    id: 'qrcode',
    name: '二维码生成',
    group: '生成器',
    icon: 'qr',
    desc: '文本 / 网址转二维码，可调颜色、容错与样式，导出 PNG / SVG',
    html: function () {
      return '' +
        '<div class="tool-head"><h1><span class="th-icon" data-icon="qr"></span>二维码生成器</h1>' +
        '<p>输入文本或网址即可生成二维码，支持中文（UTF-8）、自定义颜色与模块样式，可导出高清 PNG 或矢量 SVG。</p></div>' +
        '<div class="grid-2">' +
        '  <div class="card">' +
        '    <div class="card-title">内容与参数</div>' +
        '    <label class="field"><span>内容（文本 / 网址 / WiFi 密码等）</span>' +
        '      <textarea class="input" id="qrText" style="min-height:104px" spellcheck="false" placeholder="https://example.com">https://www.workbuddy.cn</textarea></label>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <label class="field" style="width:150px"><span>容错级别</span>' +
        '        <select class="input sm" id="qrLevel"><option value="L">L（7%）</option><option value="M" selected>M（15%）</option><option value="Q">Q（25%）</option><option value="H">H（30%）</option></select></label>' +
        '      <label class="field" style="width:130px"><span>模块样式</span>' +
        '        <select class="input sm" id="qrStyle"><option value="square">方块</option><option value="rounded">圆角</option><option value="dot">圆点</option></select></label>' +
        '      <label class="field" style="width:110px"><span>边距</span>' +
        '        <input class="input sm" type="number" id="qrMargin" value="2" min="0" max="10" step="1"></label>' +
        '    </div>' +
        '    <div class="row" style="margin-top:10px">' +
        '      <label class="field" style="width:110px"><span>前景色</span>' +
        '        <input class="input sm" type="color" id="qrFg" value="#111827" style="padding:2px;height:34px"></label>' +
        '      <label class="field" style="width:110px"><span>背景色</span>' +
        '        <input class="input sm" type="color" id="qrBg" value="#ffffff" style="padding:2px;height:34px"></label>' +
        '      <label class="field" style="flex:1"><span>输出尺寸：<b class="mono" id="qrSizeVal">320</b> px</span>' +
        '        <input type="range" id="qrSize" min="160" max="900" step="20" value="320" style="width:100%;accent-color:var(--accent)"></label>' +
        '    </div>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <button class="btn primary" id="qrGen">重新生成</button>' +
        '      <button class="btn" id="qrCopyText">复制内容</button>' +
        '      <span class="spacer"></span>' +
        '      <span class="hint" id="qrStatus"></span>' +
        '    </div>' +
        '  </div>' +
        '  <div class="card">' +
        '    <div class="card-title">预览 <span class="ct-sub" id="qrMeta"></span></div>' +
        '    <div class="qr-stage"><canvas id="qrCanvas" width="320" height="320"></canvas></div>' +
        '    <div class="row" style="margin-top:12px">' +
        '      <button class="btn primary" id="qrPng">下载 PNG</button>' +
        '      <button class="btn" id="qrSvg">下载 SVG</button>' +
        '    </div>' +
        '    <div class="hint" style="margin-top:10px">提示：二维码颜色对比度越高越容易识别，容错级别 H 时可在中心叠加 Logo。</div>' +
        '  </div>' +
        '</div>';
    },
    mount: function (root) {
      const textEl = root.querySelector('#qrText');
      const levelEl = root.querySelector('#qrLevel');
      const styleEl = root.querySelector('#qrStyle');
      const marginEl = root.querySelector('#qrMargin');
      const fgEl = root.querySelector('#qrFg');
      const bgEl = root.querySelector('#qrBg');
      const sizeEl = root.querySelector('#qrSize');
      const sizeVal = root.querySelector('#qrSizeVal');
      const canvas = root.querySelector('#qrCanvas');
      const meta = root.querySelector('#qrMeta');
      const status = root.querySelector('#qrStatus');
      const ctx = canvas.getContext('2d');
      let current = null;

      function buildSVG(qr, count, margin, cell, fg, bg, style) {
        const dim = count + margin * 2;
        let shapes = '';
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (!qr.isDark(r, c)) continue;
            const x = c + margin, y = r + margin;
            if (style === 'dot') {
              shapes += '<circle cx="' + (x + 0.5) + '" cy="' + (y + 0.5) + '" r="0.46"/>';
            } else if (style === 'rounded') {
              shapes += '<rect x="' + (x + 0.06) + '" y="' + (y + 0.06) + '" width="0.88" height="0.88" rx="0.26"/>';
            } else {
              shapes += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
            }
          }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + cell * dim + '" height="' + cell * dim +
          '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">' +
          '<rect width="100%" height="100%" fill="' + bg + '"/>' +
          '<g fill="' + fg + '">' + shapes + '</g></svg>';
      }

      function render() {
        const text = textEl.value;
        sizeVal.textContent = sizeEl.value;
        if (!text.trim()) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          meta.textContent = '';
          status.textContent = '请输入内容';
          current = null;
          return;
        }
        const level = levelEl.value;
        let qr;
        try {
          qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
          qr = qrcode(0, level);
          qr.addData(text);
          qr.make();
        } catch (e) {
          status.className = 'hint err';
          status.textContent = '✗ 内容过长，请缩短或降低容错级别';
          return;
        }
        const count = qr.getModuleCount();
        const margin = Math.max(0, Math.min(10, parseInt(marginEl.value, 10) || 0));
        const target = parseInt(sizeEl.value, 10);
        const cell = Math.max(2, Math.floor(target / (count + margin * 2)));
        const dim = cell * (count + margin * 2);
        canvas.width = dim;
        canvas.height = dim;
        const fg = fgEl.value, bg = bgEl.value, style = styleEl.value;

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, dim, dim);
        ctx.fillStyle = fg;
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (!qr.isDark(r, c)) continue;
            const x = (c + margin) * cell, y = (r + margin) * cell;
            if (style === 'dot') {
              ctx.beginPath();
              ctx.arc(x + cell / 2, y + cell / 2, cell * 0.46, 0, Math.PI * 2);
              ctx.fill();
            } else if (style === 'rounded') {
              roundRectPath(ctx, x + cell * 0.055, y + cell * 0.055, cell * 0.89, cell * 0.89, cell * 0.3);
              ctx.fill();
            } else {
              ctx.fillRect(x, y, cell, cell);
            }
          }
        }
        current = { text: text, level: level, qr: qr, count: count, margin: margin, cell: cell, fg: fg, bg: bg, style: style, dim: dim };
        meta.textContent = count + '×' + count + ' 模块 · ' + dim + 'px';
        status.className = 'hint ok';
        status.textContent = '✓ 已生成（' + level + ' 级容错）';
      }

      const live = Lib.debounce(render, 200);
      [textEl, marginEl].forEach(function (el) { el.addEventListener('input', live); });
      [levelEl, styleEl, fgEl, bgEl].forEach(function (el) { el.addEventListener('change', render); });
      sizeEl.addEventListener('input', render);
      root.querySelector('#qrGen').addEventListener('click', render);
      root.querySelector('#qrCopyText').addEventListener('click', function () { Lib.copy(textEl.value); });

      root.querySelector('#qrPng').addEventListener('click', function () {
        if (!current) return Lib.toast('请先生成二维码', 'err');
        canvas.toBlob(function (blob) {
          Lib.downloadBlob(blob, 'qrcode.png');
          Lib.toast('已开始下载 PNG', 'ok');
        }, 'image/png');
      });

      root.querySelector('#qrSvg').addEventListener('click', function () {
        if (!current) return Lib.toast('请先生成二维码', 'err');
        const svg = buildSVG(current.qr, current.count, current.margin, current.cell, current.fg, current.bg, current.style);
        Lib.downloadText(svg, 'qrcode.svg', 'image/svg+xml;charset=utf-8');
        Lib.toast('已开始下载 SVG', 'ok');
      });

      render();
    }
  });
})();
