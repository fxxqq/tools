/* ==========================================================================
   lib.js · 底层工具函数（编码 / 哈希 / DOM / 复制 / 下载）
   —— 纯手写实现，无第三方依赖，可离线运行
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---------------- 文本 ↔ 字节 ---------------- */
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function utf8Bytes(str) { return encoder.encode(str); }
  function bytesToText(bytes) { return decoder.decode(bytes); }

  /* ---------------- Hex ---------------- */
  function bytesToHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }
  function hexToBytes(hex) {
    const clean = String(hex).replace(/^0x/i, '').replace(/[\s:,-]/g, '');
    if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('包含非法的十六进制字符');
    const out = new Uint8Array(Math.ceil(clean.length / 2));
    for (let i = 0; i < out.length; i++) {
      const byte = clean.substr(i * 2, 2);
      out[i] = parseInt(byte.length === 1 ? byte + '0' : byte, 16);
    }
    return out;
  }

  /* ---------------- Base64 ---------------- */
  function bytesToBase64(bytes, urlSafe) {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    let b64 = btoa(bin);
    if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  }

  function base64ToBytes(str) {
    let s = String(str).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('包含非法 Base64 字符');
    while (s.length % 4 !== 0) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function b64encode(str, urlSafe) { return bytesToBase64(utf8Bytes(str), urlSafe); }
  function b64decode(str) { return bytesToText(base64ToBytes(str)); }

  /* ---------------- 哈希：MD5 ---------------- */
  const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

  const MD5_K = (function () {
    const k = new Uint32Array(64);
    for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
    return k;
  })();

  function rotl(x, n) { return ((x << n) | (x >>> (32 - n))) >>> 0; }

  function md5Bytes(bytes) {
    const bitLen = bytes.length * 8;
    const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
    const M = new Uint8Array(paddedLen);
    const dv = new DataView(M.buffer);
    M.set(bytes);
    M[bytes.length] = 0x80;
    dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
    dv.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296) >>> 0, true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const w = new Uint32Array(16);

    for (let off = 0; off < paddedLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) & 15; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) & 15; }
        else { F = C ^ (B | ~D); g = (7 * i) & 15; }
        const tmp = D;
        D = C; C = B;
        B = (B + rotl((A + F + MD5_K[i] + w[g]) | 0, MD5_S[i])) >>> 0;
        A = tmp;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }

    let hex = '';
    [a0, b0, c0, d0].forEach(function (word) {
      for (let i = 0; i < 4; i++) hex += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    });
    return hex;
  }

  function md5(str) { return md5Bytes(utf8Bytes(str)); }

  /* ---------------- 哈希：SHA-1 ---------------- */
  function sha1Bytes(bytes) {
    const bitLen = bytes.length * 8;
    const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
    const M = new Uint8Array(paddedLen);
    const dv = new DataView(M.buffer);
    M.set(bytes);
    M[bytes.length] = 0x80;
    dv.setUint32(paddedLen - 8, Math.floor(bitLen / 4294967296) >>> 0, false);
    dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Uint32Array(80);

    for (let off = 0; off < paddedLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 80; i++) {
        const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
        w[i] = ((x << 1) | (x >>> 31)) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) {
        let f, k;
        if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
        else { f = b ^ c ^ d; k = 0xca62c1d6; }
        const t = (rotl(a, 5) + (f | 0) + e + k + w[i]) | 0;
        e = d; d = c; c = rotl(b, 30); b = a; a = t;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
    }

    return [h0, h1, h2, h3, h4].map(function (x) {
      let s = '';
      for (let i = 3; i >= 0; i--) s += ((x >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
      return s;
    }).join('');
  }

  function sha1(str) { return sha1Bytes(utf8Bytes(str)); }

  /* ---------------- 哈希：SHA-256 ---------------- */
  const SHA256_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

  function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function sha256Bytes(bytes) {
    const bitLen = bytes.length * 8;
    const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
    const M = new Uint8Array(paddedLen);
    const dv = new DataView(M.buffer);
    M.set(bytes);
    M[bytes.length] = 0x80;
    dv.setUint32(paddedLen - 8, Math.floor(bitLen / 4294967296) >>> 0, false);
    dv.setUint32(paddedLen - 4, bitLen >>> 0, false);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
      h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let off = 0; off < paddedLen; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
        const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
        const ch = ((e & f) ^ (~e & g)) >>> 0;
        const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
        const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }

    return [h0, h1, h2, h3, h4, h5, h6, h7].map(function (x) {
      let s = '';
      for (let i = 3; i >= 0; i--) s += ((x >>> (i * 8)) & 0xff).toString(16).padStart(2, '0');
      return s;
    }).join('');
  }

  function sha256(str) { return sha256Bytes(utf8Bytes(str)); }

  /* ---------------- 杂项 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatBytes(n) {
    if (n === 0 || n == null) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const v = n / Math.pow(1024, i);
    return (i === 0 ? v : v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)) + ' ' + units[i];
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatDate(d, withMs) {
    const s = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    return withMs ? s + '.' + String(d.getMilliseconds()).padStart(3, '0') : s;
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 160);
    };
  }

  function toast(msg, type) {
    const box = document.getElementById('toast');
    if (!box) return;
    box.textContent = msg;
    box.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(box._t);
    box._t = setTimeout(function () { box.className = 'toast'; }, 1900);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copy(text, okMsg) {
    const value = String(text == null ? '' : text);
    if (!value) { toast('没有可复制的内容', 'err'); return; }
    const done = function () { toast(okMsg || '已复制到剪贴板', 'ok'); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done, function () {
        fallbackCopy(value) ? done() : toast('复制失败，请手动选择复制', 'err');
      });
    } else {
      fallbackCopy(value) ? done() : toast('复制失败，请手动选择复制', 'err');
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2500);
  }

  function downloadText(text, filename, mime) {
    downloadBlob(new Blob([text], { type: mime || 'text/plain;charset=utf-8' }), filename);
  }

  const api = {
    utf8Bytes: utf8Bytes,
    bytesToText: bytesToText,
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    bytesToBase64: bytesToBase64,
    base64ToBytes: base64ToBytes,
    b64encode: b64encode,
    b64decode: b64decode,
    md5: md5,
    sha1: sha1,
    sha256: sha256,
    md5Bytes: md5Bytes,
    sha1Bytes: sha1Bytes,
    sha256Bytes: sha256Bytes,
    escapeHtml: escapeHtml,
    formatBytes: formatBytes,
    formatDate: formatDate,
    pad2: pad2,
    debounce: debounce,
    toast: toast,
    copy: copy,
    downloadBlob: downloadBlob,
    downloadText: downloadText
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Lib = api;

  /* ---------------- 工具注册表 ---------------- */
  global.TOOL_REGISTRY = global.TOOL_REGISTRY || [];
  global.registerTool = function (tool) { global.TOOL_REGISTRY.push(tool); };
})(typeof window !== 'undefined' ? window : globalThis);
