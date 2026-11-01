#!/usr/bin/env node
'use strict';

/**
 * 方寸工具箱 静态文件服务器
 * 零依赖，默认监听 3100 端口，可直接部署到阿里云 ECS / 容器。
 *
 *   node server.js
 *   PORT=3100 HOST=0.0.0.0 node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 3100;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.rss': 'application/rss+xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

// 需要压缩的类型
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/;

// 不允许通过 HTTP 访问的目录（部署脚本、依赖、版本库等）
const DENY_DIRS = new Set(['deploy', 'node_modules', '.git', '.workbuddy', '.deploy-stage']);

function send(res, status, body, headers) {
  const h = Object.assign(
    {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    },
    headers || {}
  );
  res.writeHead(status, h);
  res.end(body);
}

function serveFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  // 静态资源长缓存，HTML 每次校验
  const cache = ext === '.html' || ext === '.htm'
    ? 'no-cache'
    : 'public, max-age=604800';

  const headers = {
    'Content-Type': type,
    'Cache-Control': cache,
    'Last-Modified': stat.mtime.toUTCString()
  };

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const canGzip = COMPRESSIBLE.test(type) && /\bgzip\b/.test(acceptEncoding) && stat.size > 1024;

  if (!canGzip) {
    headers['Content-Length'] = stat.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(filePath).pipe(res);
  }

  headers['Content-Encoding'] = 'gzip';
  headers['Vary'] = 'Accept-Encoding';
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
}

const server = http.createServer(function (req, res) {
  const started = Date.now();

  res.on('finish', function () {
    const ms = Date.now() - started;
    console.log(
      '[' + new Date().toISOString() + '] ' +
      req.method + ' ' + decodeURIComponent(req.url || '/') + ' ' +
      res.statusCode + ' ' + ms + 'ms'
    );
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // 防目录穿越
  const rel = pathname.replace(/^\/+/, '');
  let filePath = path.resolve(ROOT, rel);

  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // 隐藏文件不可访问
  if (/(^|[\\/])\./.test(path.relative(ROOT, filePath))) {
    return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  // 敏感目录不可访问
  if (DENY_DIRS.has(rel.split('/')[0].toLowerCase())) {
    return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  fs.stat(filePath, function (err, stat) {
    if (err) return notFound(res);

    if (stat.isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: pathname + '/' });
        return res.end();
      }
      filePath = path.join(filePath, 'index.html');
      return fs.stat(filePath, function (e2, s2) {
        if (e2 || !s2.isFile()) return notFound(res);
        serveFile(req, res, filePath, s2);
      });
    }

    if (!stat.isFile()) return notFound(res);
    serveFile(req, res, filePath, stat);
  });

  function notFound(response) {
    const page = path.join(ROOT, '404.html');
    fs.readFile(page, function (err, buf) {
      if (err) {
        return send(response, 404, '404 Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      send(response, 404, buf, { 'Content-Type': 'text/html; charset=utf-8' });
    });
  }
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用，可用 PORT=其他端口 启动。');
  } else if (err.code === 'EACCES') {
    console.error('端口 ' + PORT + ' 无权限监听（1024 以下端口需要 root）。');
  } else {
    console.error('服务启动失败：', err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, function () {
  console.log('方寸工具箱 已启动');
  console.log('  监听地址  http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
  console.log('  静态目录  ' + ROOT);
  console.log('  进程 PID  ' + process.pid);
});

function shutdown(signal) {
  console.log('\n收到 ' + signal + '，正在关闭服务...');
  server.close(function () {
    console.log('已关闭。');
    process.exit(0);
  });
  setTimeout(function () { process.exit(1); }, 8000).unref();
}

process.on('SIGTERM', function () { shutdown('SIGTERM'); });
process.on('SIGINT', function () { shutdown('SIGINT'); });
