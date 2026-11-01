'use strict';
/* ==========================================================================
   方寸工具箱 · 统计与广告后端
   - 零外部依赖，Node 20 原生模块
   - 只监听 127.0.0.1，由 Nginx 反代 /api/ 进来
   - 数据存 JSON：内存聚合 + 定时落盘 + 退出前强制落盘
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3200);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const ADS_FILE = path.join(DATA_DIR, 'ads.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

const MAX_BODY = 32 * 1024;
const KEEP_DAYS = 180;
const TOKEN_TTL = 7 * 24 * 3600; // 7 天

/* 页面 id → 中文名（新增工具时在这里补一行即可） */
const PAGE_LABELS = {
  home: '首页',
  json: 'JSON 格式化',
  timestamp: '时间戳转换',
  codec: 'Base64 编解码',
  radix: '进制转换',
  regex: '正则测试',
  diff: '文本对比',
  format: '代码格式化',
  qrcode: '二维码生成',
  random: '随机字符串',
  color: '颜色工具',
  'img-compress': '图片压缩',
  'img-convert': '图片格式转换',
  url: 'URL 解析',
  jwt: 'JWT 解析',
  cron: 'Cron 解析',
  'file-hash': '文件哈希'
};

const SLOTS = ['home-top', 'home-bottom', 'tool-bottom'];

/* ---------------------------------------------------------------- 存储 */

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return fallback;
  }
}

let stats = {};          // { 'YYYY-MM-DD': { _total:{pv,uv[]}, page:{pv,uv[]} } }
let ads = [];            // 广告数组
let auth = null;         // { user, salt, hash, jwtSecret, updatedAt }
let dirty = false;

/* 内存里 UV 用 Set，落盘时转数组 */
const uvSets = new Map(); // 'YYYY-MM-DD|page' -> Set

function loadAll() {
  ensureDir();

  const rawStats = readJSON(STATS_FILE, {});
  stats = {};
  Object.keys(rawStats).forEach(function (day) {
    stats[day] = {};
    Object.keys(rawStats[day]).forEach(function (page) {
      const rec = rawStats[day][page];
      const set = new Set(Array.isArray(rec.uv) ? rec.uv : []);
      uvSets.set(day + '|' + page, set);
      stats[day][page] = { pv: Number(rec.pv) || 0, uv: [] };
    });
  });

  ads = readJSON(ADS_FILE, []);
  if (!Array.isArray(ads)) ads = [];

  auth = readJSON(AUTH_FILE, null);
  if (!auth) {
    auth = {
      user: 'admin',
      salt: crypto.randomBytes(16).toString('hex'),
      hash: '',
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      updatedAt: new Date().toISOString()
    };
    const initial = genPassword();
    auth.hash = hashPassword(initial, auth.salt);
    writeJSON(AUTH_FILE, auth);
    console.log('[init] 已生成初始账号 admin / ' + initial);
    console.log('[init] 请登录后台后立即修改密码');
  }
  if (!auth.jwtSecret) {
    auth.jwtSecret = crypto.randomBytes(32).toString('hex');
    writeJSON(AUTH_FILE, auth);
  }
}

function writeJSON(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj));
  fs.renameSync(tmp, file);
}

function serializeStats() {
  const out = {};
  Object.keys(stats).forEach(function (day) {
    out[day] = {};
    Object.keys(stats[day]).forEach(function (page) {
      const set = uvSets.get(day + '|' + page);
      out[day][page] = { pv: stats[day][page].pv, uv: set ? Array.from(set) : [] };
    });
  });
  return out;
}

function flush(force) {
  if (!dirty && !force) return;
  try {
    ensureDir();
    writeJSON(STATS_FILE, serializeStats());
    writeJSON(ADS_FILE, ads);
    dirty = false;
  } catch (e) {
    console.error('[flush] 失败', e.message);
  }
}

setInterval(function () { flush(false); }, 8000).unref();

/* ---------------------------------------------------------------- 工具 */

function today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function dayBefore(n) {
  return new Date(Date.now() + 8 * 3600 * 1000 - n * 86400 * 1000).toISOString().slice(0, 10);
}

function hashPassword(pass, salt) {
  return crypto.scryptSync(String(pass), salt, 64).toString('hex');
}

function genPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = crypto.randomBytes(14);
  for (let i = 0; i < 14; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

function b64u(input) {
  return Buffer.from(input).toString('base64url');
}

function signToken(payload, secret) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(head + '.' + body).digest('base64url');
  return head + '.' + body + '.' + sig;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const expect = crypto.createHmac('sha256', secret).update(parts[0] + '.' + parts[1]).digest('base64url');
  const a = Buffer.from(expect);
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function clientIp(req) {
  const xr = req.headers['x-real-ip'];
  if (xr) return String(xr).trim();
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

/* IP 只参与哈希，不落原文 */
function anonVisitor(ip, ua, day) {
  return crypto.createHash('sha256').update(ip + '|' + (ua || '') + '|' + day).digest('hex').slice(0, 16);
}

/* 登录失败限流：同一 IP 连续失败 6 次锁 15 分钟 */
const failMap = new Map();
function locked(ip) {
  const rec = failMap.get(ip);
  if (!rec) return 0;
  if (rec.lockUntil && rec.lockUntil > Date.now()) return rec.lockUntil;
  return 0;
}
function noteFail(ip) {
  const rec = failMap.get(ip) || { fails: 0, lockUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= 6) { rec.lockUntil = Date.now() + 15 * 60 * 1000; rec.fails = 0; }
  failMap.set(ip, rec);
}
function clearFail(ip) { failMap.delete(ip); }

/* ---------------------------------------------------------------- HTTP 辅助 */

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function requireAuth(req, res) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const payload = verifyToken(token, auth.jwtSecret);
  if (!payload) { send(res, 401, { error: 'unauthorized' }); return null; }
  return payload;
}

/* ---------------------------------------------------------------- 路由 */

function trackPage(page, vid) {
  const day = today();
  const id = String(vid || '').slice(0, 64);
  if (stats[day] === undefined) stats[day] = {};
  if (!stats[day]._total) { stats[day]._total = { pv: 0, uv: [] }; uvSets.set(day + '|_total', new Set()); }
  if (!stats[day][page]) { stats[day][page] = { pv: 0, uv: [] }; uvSets.set(day + '|' + page, new Set()); }

  stats[day]._total.pv += 1;
  stats[day][page].pv += 1;

  const totalSet = uvSets.get(day + '|_total');
  const pageSet = uvSets.get(day + '|' + page);
  if (totalSet) totalSet.add(id);
  if (pageSet) pageSet.add(id);
  dirty = true;
}

function pruneOld() {
  const limit = dayBefore(KEEP_DAYS);
  Object.keys(stats).forEach(function (day) {
    if (day < limit) {
      Object.keys(stats[day]).forEach(function (page) { uvSets.delete(day + '|' + page); });
      delete stats[day];
      dirty = true;
    }
  });
}

function buildStats(days) {
  const from = dayBefore(days - 1);
  const series = [];
  const union = new Set();
  let rangePv = 0;
  const pageAgg = {};

  for (let i = days - 1; i >= 0; i--) {
    const day = dayBefore(i);
    const d = stats[day] || {};
    const total = d._total || { pv: 0 };
    const set = uvSets.get(day + '|_total');
    series.push({ date: day, pv: total.pv || 0, uv: set ? set.size : 0 });
    rangePv += total.pv || 0;
    if (set) set.forEach(function (v) { union.add(v); });

    Object.keys(d).forEach(function (page) {
      if (page === '_total') return;
      const ps = uvSets.get(day + '|' + page);
      const item = pageAgg[page] || (pageAgg[page] = { page: page, pv: 0, uvSet: new Set() });
      item.pv += d[page].pv || 0;
      if (ps) ps.forEach(function (v) { item.uvSet.add(v); });
    });
  }

  const pages = Object.keys(pageAgg).map(function (k) {
    return {
      page: k,
      name: PAGE_LABELS[k] || k,
      pv: pageAgg[k].pv,
      uv: pageAgg[k].uvSet.size
    };
  }).sort(function (a, b) { return b.pv - a.pv; });

  const t = stats[today()] || {};
  const tTotal = t._total || { pv: 0 };
  const tSet = uvSets.get(today() + '|_total');

  let allPv = 0;
  const allUnion = new Set();
  Object.keys(stats).forEach(function (day) {
    const tot = stats[day]._total;
    if (tot) allPv += tot.pv || 0;
    const s = uvSets.get(day + '|_total');
    if (s) s.forEach(function (v) { allUnion.add(v); });
  });

  return {
    today: { date: today(), pv: tTotal.pv || 0, uv: tSet ? tSet.size : 0 },
    range: { days: days, pv: rangePv, uv: union.size },
    total: { pv: allPv, uv: allUnion.size },
    series: series,
    pages: pages
  };
}

function normalizeAd(input, existing) {
  const now = new Date().toISOString();
  const ad = existing ? Object.assign({}, existing) : { id: crypto.randomUUID(), createdAt: now };
  const type = input.type === 'html' ? 'html' : 'image';
  ad.type = type;
  ad.slot = SLOTS.indexOf(input.slot) >= 0 ? input.slot : 'home-top';
  ad.title = String(input.title || '').slice(0, 120);
  ad.enabled = input.enabled !== false;
  ad.startAt = input.startAt ? String(input.startAt).slice(0, 24) : '';
  ad.endAt = input.endAt ? String(input.endAt).slice(0, 24) : '';
  if (type === 'image') {
    ad.imageUrl = String(input.imageUrl || '').slice(0, 500);
    ad.linkUrl = String(input.linkUrl || '').slice(0, 500);
    ad.desc = String(input.desc || '').slice(0, 160);
    ad.html = '';
  } else {
    ad.html = String(input.html || '').slice(0, 4000);
    ad.imageUrl = '';
    ad.linkUrl = '';
    ad.desc = '';
  }
  ad.updatedAt = now;
  return ad;
}

function adVisible(ad) {
  if (!ad.enabled) return false;
  const now = Date.now();
  if (ad.startAt && new Date(ad.startAt).getTime() > now) return false;
  if (ad.endAt && new Date(ad.endAt).getTime() < now) return false;
  return true;
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;

  /* 健康检查 */
  if (pathname === '/api/health' && method === 'GET') {
    return send(res, 200, { ok: true, ts: Date.now(), today: today() });
  }

  /* ---- 埋点 ---- */
  if (pathname === '/api/track' && method === 'POST') {
    return readBody(req).then(function (body) {
      let page = String(body.page || 'home');
      if (!/^[a-z0-9_-]{1,32}$/.test(page)) page = 'home';
      let vid = String(body.vid || '');
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(vid)) {
        vid = anonVisitor(clientIp(req), req.headers['user-agent'], today());
      }
      trackPage(page, vid);
      send(res, 200, { ok: true });
    }).catch(function () { send(res, 400, { error: 'bad request' }); });
  }

  /* ---- 广告读取（前台） ---- */
  if (pathname === '/api/ads' && method === 'GET') {
    const slot = url.searchParams.get('slot');
    const list = ads.filter(function (a) {
      return adVisible(a) && (!slot || a.slot === slot);
    }).map(function (a) {
      return {
        id: a.id, slot: a.slot, type: a.type, title: a.title,
        desc: a.desc || '', imageUrl: a.imageUrl || '', linkUrl: a.linkUrl || '', html: a.html || ''
      };
    });
    return send(res, 200, { ads: list });
  }

  /* ---- 登录 ---- */
  if (pathname === '/api/admin/login' && method === 'POST') {
    const ip = clientIp(req);
    const until = locked(ip);
    if (until) {
      return send(res, 429, { error: 'too many attempts', retryAfter: Math.ceil((until - Date.now()) / 1000) });
    }
    return readBody(req).then(function (body) {
      const user = String(body.user || '');
      const pass = String(body.pass || '');
      const okUser = user === auth.user;
      const okPass = hashPassword(pass, auth.salt) === auth.hash;
      if (!okUser || !okPass) {
        noteFail(ip);
        return send(res, 401, { error: 'invalid credentials' });
      }
      clearFail(ip);
      const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
      send(res, 200, {
        token: signToken({ sub: auth.user, exp: exp }, auth.jwtSecret),
        user: auth.user,
        exp: exp
      });
    }).catch(function () { send(res, 400, { error: 'bad request' }); });
  }

  /* ---- 以下需要登录 ---- */
  if (pathname.indexOf('/api/admin/') === 0) {
    if (!requireAuth(req, res)) return;

    if (pathname === '/api/admin/stats' && method === 'GET') {
      const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 7));
      return send(res, 200, buildStats(days));
    }

    if (pathname === '/api/admin/ads' && method === 'GET') {
      return send(res, 200, { ads: ads, slots: SLOTS });
    }

    if (pathname === '/api/admin/ads' && method === 'POST') {
      return readBody(req).then(function (body) {
        const ad = normalizeAd(body, null);
        ads.unshift(ad);
        dirty = true;
        send(res, 200, { ad: ad });
      }).catch(function () { send(res, 400, { error: 'bad request' }); });
    }

    const m = pathname.match(/^\/api\/admin\/ads\/([A-Za-z0-9-]{8,64})$/);
    if (m) {
      const id = m[1];
      const idx = ads.findIndex(function (a) { return a.id === id; });
      if (idx < 0) return send(res, 404, { error: 'not found' });
      if (method === 'PUT') {
        return readBody(req).then(function (body) {
          ads[idx] = normalizeAd(body, ads[idx]);
          dirty = true;
          send(res, 200, { ad: ads[idx] });
        }).catch(function () { send(res, 400, { error: 'bad request' }); });
      }
      if (method === 'DELETE') {
        ads.splice(idx, 1);
        dirty = true;
        return send(res, 200, { ok: true });
      }
    }

    if (pathname === '/api/admin/password' && method === 'POST') {
      return readBody(req).then(function (body) {
        const oldPass = String(body.old || '');
        const newPass = String(body.next || '');
        if (hashPassword(oldPass, auth.salt) !== auth.hash) {
          return send(res, 401, { error: 'old password wrong' });
        }
        if (newPass.length < 8) return send(res, 400, { error: 'password too short' });
        auth.salt = crypto.randomBytes(16).toString('hex');
        auth.hash = hashPassword(newPass, auth.salt);
        auth.updatedAt = new Date().toISOString();
        writeJSON(AUTH_FILE, auth);
        send(res, 200, { ok: true });
      }).catch(function () { send(res, 400, { error: 'bad request' }); });
    }

    return send(res, 404, { error: 'not found' });
  }

  send(res, 404, { error: 'not found' });
});

loadAll();
pruneOld();

server.listen(PORT, HOST, function () {
  console.log('[fangcun-api] listening on ' + HOST + ':' + PORT + ' · data=' + DATA_DIR);
});

function shutdown(sig) {
  console.log('[fangcun-api] ' + sig + ' → flushing');
  flush(true);
  server.close(function () { process.exit(0); });
  setTimeout(function () { process.exit(0); }, 3000).unref();
}
process.on('SIGINT', function () { shutdown('SIGINT'); });
process.on('SIGTERM', function () { shutdown('SIGTERM'); });
process.on('uncaughtException', function (e) {
  console.error('[uncaught]', e && e.stack || e);
  flush(true);
});
