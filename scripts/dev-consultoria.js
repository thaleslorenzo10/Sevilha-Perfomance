'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const handlers = {
  '/api/leads': require('../api/leads'),
  '/api/pageview': require('../api/ab'),
};
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function safePath(raw) {
  const decoded = decodeURIComponent(raw);
  const segments = decoded.split('/');
  if (segments.some(segment => segment.startsWith('.') || segment.includes('\\')) || decoded.includes('\0')) return null;
  return path.join(root, decoded);
}

async function apiRequest(handler, req, res) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 65536) return res.status(413).json({ error: 'Request too large' });
  }
  req.body = body ? JSON.parse(body) : {};
  return handler(req, res);
}

async function serve(req, res) {
  res.status = status => { res.statusCode = status; return res; };
  res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); return res; };
  try {
    if (!safePath(req.url.split('?')[0])) return res.status(403).end();
    const url = new URL(req.url, 'http://127.0.0.1');
    req.query = Object.fromEntries(url.searchParams);
    const handler = handlers[url.pathname];
    if (handler) return await apiRequest(handler, req, res);
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).end();
    let file = safePath(url.pathname);
    if (!file) return res.status(403).end();
    const stat = await fs.stat(file);
    if (stat.isDirectory()) file = path.join(file, 'index.html');
    // Realpath also prevents a symlink from escaping the project root.
    file = await fs.realpath(file);
    if (safePath(path.relative(root, file)) !== file) return res.status(403).end();
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : await fs.readFile(file));
  } catch (error) {
    res.status(error instanceof SyntaxError || error instanceof URIError ? 400 : 404).end();
  }
}

if (process.argv.includes('--self-check')) {
  assert.equal(safePath('/.env.local'), null);
  assert.equal(safePath('/%2e%2e/secrets'), null);
  assert.equal(safePath('/foo/%5c.env'), null);
  assert.equal(safePath('/mentoria/'), path.join(root, 'mentoria/'));
  process.stdout.write('Self-check passed: dotfiles, traversal, backslashes and normal page.\n');
} else {
  const port = Number(process.env.PORT || 3010);
  http.createServer(serve).listen(port, '127.0.0.1', () => {
    process.stdout.write(`Consultoria local: http://127.0.0.1:${port}\n`);
  });
}
