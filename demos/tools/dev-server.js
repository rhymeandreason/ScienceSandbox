#!/usr/bin/env node
/* =============================================================================
 *  dev-server.js — static server + live reload, for development only
 * =============================================================================
 *  Run:  node tools/dev-server.js            (serves demos/ on :8817)
 *        node tools/dev-server.js 9000        (or any port)
 *
 *  Two jobs, both of which `python3 -m http.server` does badly:
 *
 *  1. LIVE RELOAD. Save a file, the browser reloads. A CSS-only change swaps the
 *     stylesheet in place instead of reloading, so the scene keeps its camera
 *     angle, its selected pair and its toggle states while you tune the paper
 *     texture — reloading the page to check a border colour means rebuilding
 *     every molecule and losing where you were.
 *
 *  2. NO CACHING. python's server sends Last-Modified and nothing else, so a
 *     browser will happily reuse a stale scene.js for the rest of the session.
 *     That has cost real debugging time on this project: a fix appears not to
 *     work, and the file on disk is already correct. Everything here is served
 *     `no-store`.
 *
 *  THE PUBLISHED FILES STAY STATIC. The reload client is injected into HTML
 *  *responses*, never written to disk — this repo deploys to GitHub Pages
 *  straight from the working tree, so anything committed is published. Serve
 *  with python (or open the file directly) and you get exactly what ships; the
 *  only difference is that you reload by hand.
 *
 *  Zero dependencies, by design: no package.json, no node_modules, nothing to
 *  install. Node's standard library is enough.
 * ========================================================================== */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

// The repo root, not demos/ — because that is what GitHub Pages publishes, so
// this is the only root where a local URL is the URL that ships. The lesson
// index lives at the root and links to `demos/…`; serving demos/ instead made
// `/` mean two different pages locally and in production.
const ROOT  = path.resolve(__dirname, '../..');      // repo root
const DEMOS = path.resolve(__dirname, '..');         // demos/ — for the 404 list
const ASKED = process.argv[2] || process.env.PORT;   // explicit port, if any
const PORT  = Number(ASKED || 8817);

const TYPES = {
  '.html':'text/html; charset=utf-8',  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',    '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',              '.png':'image/png',
  '.jpg':'image/jpeg',  '.jpeg':'image/jpeg', '.gif':'image/gif',
  '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff',
  '.md':'text/markdown; charset=utf-8', '.sdf':'text/plain; charset=utf-8',
};

/* ---- the reload client, injected into HTML responses only ---------------- */
// EventSource rather than a WebSocket: it is one line of client code, it
// reconnects on its own when this server restarts, and it needs no dependency.
const CLIENT = `
<script>
(() => {
  const es = new EventSource('/__dev/reload');
  es.onmessage = e => {
    if (e.data === 'css') {
      // Re-point every stylesheet at a fresh URL. The page keeps its state —
      // camera, selection, toggles — which is the whole reason to special-case
      // CSS instead of reloading.
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const u = new URL(link.href, location.href);
        u.searchParams.set('_', Date.now());
        link.href = u.href;
      }
      console.info('[dev] css reloaded');
    } else {
      location.reload();
    }
  };
})();
</script>
`;

/* ---- watch ---------------------------------------------------------------- */
const clients = new Set();
let timer = null, cssOnly = true;

function notify(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext !== '.css') cssOnly = false;          // any non-CSS change → full reload
  clearTimeout(timer);
  // Debounced: editors write a file in several syscalls, and a save that touched
  // three files should be one reload, not three.
  timer = setTimeout(() => {
    const kind = cssOnly ? 'css' : 'reload';
    for (const res of clients) res.write(`data: ${kind}\n\n`);
    console.log(`  → ${kind}${clients.size ? '' : ' (no browser connected)'}`);
    cssOnly = true;
  }, 60);
}

const IGNORE = /(^|[\\/])(\.git|node_modules|\.DS_Store|__pycache__)([\\/]|$)/;
try {
  fs.watch(ROOT, { recursive: true }, (_evt, file) => {
    if (!file || IGNORE.test(file)) return;
    if (path.basename(file).startsWith('.')) return;   // editor swap files
    console.log(`changed: ${file}`);
    notify(file);
  });
} catch (e) {
  console.warn('watch failed — serving without live reload:', e.message);
}

/* ---- serve ---------------------------------------------------------------- */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url === '/__dev/reload') {
    res.writeHead(200, { 'Content-Type':'text/event-stream',
                         'Cache-Control':'no-store', 'Connection':'keep-alive' });
    res.write(':ok\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Resolve inside ROOT only — a dev server still should not serve the whole
  // disk to anything that can reach this port.
  const target = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!target.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }

  fs.stat(target, (err, st) => {
    if (err) return listOrMiss(url, res);
    if (st.isDirectory()) {
      const idx = path.join(target, 'index.html');
      return fs.existsSync(idx) ? send(idx, res) : listing(target, url, res);
    }
    send(target, res);
  });
});

/* ---- listen, and cope with a port already in use --------------------------
 * Something else holding the port is the normal case, not an exception: another
 * editor window, a python http.server from last week, a second copy of this.
 * Crashing with an unhandled 'error' event and a stack trace tells you almost
 * nothing, so:
 *   · no port asked for  → quietly try the next few and say which one won;
 *   · port asked for     → that was a deliberate choice, so say plainly what is
 *                          holding it and how to look, and stop.
 */
const MAX_TRIES = 10;
let tries = 0;

server.on('error', err => {
  if (err.code !== 'EADDRINUSE') throw err;
  const port = PORT + tries;
  if (ASKED) {
    console.error(`\n  Port ${port} is already in use.\n`);
    console.error(`  Something else is serving on it — another copy of this server,`);
    console.error(`  or a python http.server. To see what:\n`);
    console.error(`      lsof -nP -iTCP:${port} -sTCP:LISTEN\n`);
    console.error(`  Then stop it, or pick another port:\n`);
    console.error(`      node tools/dev-server.js ${port + 1}\n`);
    process.exit(1);
  }
  if (++tries > MAX_TRIES) {
    console.error(`\n  Ports ${PORT}–${PORT + MAX_TRIES} are all in use. `
      + `Pass one explicitly:\n\n      node tools/dev-server.js 9000\n`);
    process.exit(1);
  }
  console.log(`  port ${port} busy, trying ${PORT + tries}…`);
  server.listen(PORT + tries);
});

server.on('listening', () => {
  const port = server.address().port;
  console.log(`\n  dev server → http://localhost:${port}/`);
  console.log(`  serving     ${ROOT}`);
  console.log(`  live reload on; CSS swaps in place, everything else reloads`);
  console.log(`  (published files are untouched — the client is injected per response)\n`);
});

server.listen(PORT);

function send(file, res) {
  const ext = path.extname(file).toLowerCase();
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(500).end(String(err)); return; }
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream',
                      'Cache-Control': 'no-store, must-revalidate' };
    if (ext === '.html') {
      let html = buf.toString('utf8');
      html = html.includes('</body>')
        ? html.replace('</body>', CLIENT + '</body>')
        : html + CLIENT;
      buf = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, headers);
    res.end(buf);
  });
}

function listOrMiss(url, res) {
  res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8',
                       'Cache-Control':'no-store' });
  res.end(`<pre>404 — no such file: ${url}\n\n`
    + fs.readdirSync(DEMOS).filter(f => f.endsWith('.html'))
        .map(f => `<a href="/demos/${f}">/demos/${f}</a>`).join('\n')
    + `</pre>${CLIENT}`);
}

function listing(dir, url, res) {
  const items = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
  res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8',
                       'Cache-Control':'no-store' });
  res.end(`<pre>${url}\n\n`
    + items.map(f => `<a href="${path.posix.join(url, f)}">${f}</a>`).join('\n')
    + `</pre>${CLIENT}`);
}
