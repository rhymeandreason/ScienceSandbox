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
 *     AND ONLY THE PAGES THAT USE THE FILE RELOAD. With a dozen lessons open,
 *     a broadcast reload throws away eleven scenes to show you one change. So
 *     the server records what each page actually loaded — every subresource
 *     request carries a `Referer` naming the page that asked for it, which is
 *     the real dependency graph, not a parse of the script tags — and a save
 *     wakes only the pages whose set contains the changed file. Editing
 *     `folding/ribbon.js` reloads the two folding lessons and leaves
 *     `water-lab` alone; editing `sandbox.css` still swaps CSS everywhere,
 *     because everything loads it. A page the server has no record of (it
 *     restarted while the tab sat open) is reloaded — conservative is right
 *     when the alternative is a tab that silently stops updating.
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
 *
 *  ONE EXCEPTION, AND IT IS LAZY. `/api/*` is handled by requiring the same
 *  handler Vercel runs, which does need the Anthropic SDK. That require happens
 *  on the first API request, not at startup, so serving lessons still works with
 *  no node_modules — you only need `npm i` to use the question box.
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

/* ---- .env.local ----------------------------------------------------------
 * Vercel injects environment variables for you; locally the key has to come
 * from somewhere, and it must not be a shell export you forget you set. Read
 * the same `.env.local` Vercel's own CLI uses. It is gitignored. Existing
 * environment values win, so `ANTHROPIC_API_KEY=… node …` still overrides. */
function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
      if (line.trim().startsWith('#')) continue;
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    return true;
  } catch { return false; }   // no .env.local: the API route says so when it is called
}
// Re-read per API request, not once at startup, so pasting a key into
// .env.local takes effect on the next question with no restart.
loadEnv();

/* ---- the reload client, injected into HTML responses only ---------------- */
// EventSource rather than a WebSocket: it is one line of client code, it
// reconnects on its own when this server restarts, and it needs no dependency.
const CLIENT = `
<script>
(() => {
  // The page names itself on connect, so the server can decide whether a given
  // change is any of this page's business.
  const es = new EventSource('/__dev/reload?page=' + encodeURIComponent(location.pathname));
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
    } else if (window.__noLiveReload) {
      // A page that edits the repo would reload itself on its own save, which
      // is at best a flash and at worst a lost form. It opts out by name.
      console.info('[dev] change ignored — this page opted out of live reload');
    } else {
      location.reload();
    }
  };
})();
</script>
`;

/* ---- who loaded what ------------------------------------------------------ */
// page URL path → the set of URL paths that page requested. Built from the
// Referer header on each request, so it is what the browser actually fetched:
// dynamic imports, fetch()ed .bin files and PDB text all land in it, and a
// script tag that is present but commented out does not.
const deps = new Map();

// fs.watch reports paths relative to ROOT with the platform separator; URLs are
// '/'-separated and absolute. One canonical form: a leading-slash URL path.
const urlOf = file => '/' + file.split(path.sep).join('/');

function record(pagePath, urlPath) {
  let set = deps.get(pagePath);
  if (!set) deps.set(pagePath, set = new Set());
  set.add(urlPath);
}

/* ---- watch ---------------------------------------------------------------- */
const clients = new Set();          // { res, page }
let timer = null, changed = new Set();

function notify(file) {
  changed.add(urlOf(file));
  clearTimeout(timer);
  // Debounced: editors write a file in several syscalls, and a save that touched
  // three files should be one reload, not three.
  timer = setTimeout(() => {
    const batch = changed; changed = new Set();
    let woke = 0;
    for (const c of clients) {
      const set = deps.get(c.page);
      // No record of this page — the server restarted under an open tab, and its
      // EventSource reconnected without re-requesting anything. Reload it rather
      // than let it go quietly stale.
      const hits = set ? [...batch].filter(f => set.has(f)) : [...batch];
      if (!hits.length) continue;
      const kind = hits.every(f => f.endsWith('.css')) ? 'css' : 'reload';
      c.res.write(`data: ${kind}\n\n`);
      console.log(`  → ${kind}: ${c.page}`);
      woke++;
    }
    if (!woke) console.log(`  → no page uses ${[...batch].join(', ')}`);
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

/* ---- the question bank ----------------------------------------------------
 * GET  → the rows on disk, and the mtime a save has to match.
 * POST → validate and rewrite demos/questions.js.
 *
 * questions-cms.html probes the GET to decide whether it can save at all; on
 * Vercel there is no endpoint, the probe fails, and the page falls back to
 * handing over the file text for a paste.
 */
function questions(req, res, json) {
  if (!require(path.join(ROOT, 'api/_local.js')).local(req)) {
    return json(403, { error: 'the question bank is editable from this machine only' });
  }

  let io;
  try { io = require('./questions-io.js'); }
  catch (e) { console.error(e); return json(500, { error: 'questions-io.js would not load' }); }

  if (req.method === 'GET') {
    try {
      const { rows, concepts, mtimeMs } = io.read();
      return json(200, { writable: true, mtimeMs, rows, concepts });
    } catch (e) {
      return json(500, { error: e.message });
    }
  }
  if (req.method !== 'POST') return json(405, { error: 'GET or POST only' });

  let raw = '';
  req.on('data', d => { raw += d; if (raw.length > 5e5) req.destroy(); });
  req.on('end', () => {
    let body;
    try { body = JSON.parse(raw); }
    catch { return json(400, { error: 'body is not JSON' }); }
    if (!Array.isArray(body.rows)) return json(400, { error: 'body needs { rows }' });

    try {
      const saved = io.write(body.rows, { since: body.mtimeMs });
      console.log(`  questions.js ← ${saved.rows} rows from the CMS`);
      return json(200, { ok: true, ...saved });
    } catch (e) {
      if (e.code === 'STALE')   return json(409, { error: e.message });
      if (e.code === 'INVALID') return json(422, { error: e.message, problems: e.problems });
      console.error(e);
      return json(500, { error: e.message });
    }
  });
}

/* ---- serve ---------------------------------------------------------------- */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  if (url === '/__dev/reload') {
    const q = new URL(req.url, 'http://localhost');
    let page = q.searchParams.get('page') || '/';
    if (page.endsWith('/')) page += 'index.html';   // same key the serve path uses
    res.writeHead(200, { 'Content-Type':'text/event-stream',
                         'Cache-Control':'no-store', 'Connection':'keep-alive' });
    res.write(':ok\n\n');
    const client = { res, page };
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return;
  }

  if (url.startsWith('/api/')) return api(url, req, res);

  // Attribute this request to the page that made it. An HTML response is its own
  // page and starts a fresh set — a reload should forget what the *previous*
  // version of the page loaded, or a removed script tag keeps waking it forever.
  if (/\.html?$/.test(url) || url.endsWith('/')) {
    const self = url.endsWith('/') ? url + 'index.html' : url;
    deps.set(self, new Set([self]));
  } else if (req.headers.referer) {
    try {
      const from = new URL(req.headers.referer).pathname;
      record(from.endsWith('/') ? from + 'index.html' : from, url);
    } catch { /* unparseable referer — nothing to attribute */ }
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
  console.log(`  live reload on; only pages that loaded the changed file react`);
  console.log(`  CSS swaps in place, everything else reloads`);
  console.log(`  (published files are untouched — the client is injected per response)\n`);
});

server.listen(PORT);

/* ---- /api/* --------------------------------------------------------------
 * Stands in for Vercel's function runtime, badly but honestly: it reads the body,
 * calls the very handler that ships, and sends back the JSON. Requiring the
 * handler is deliberately deferred and deliberately uncached, so editing
 * `api/_tutor.js` takes effect on the next request with no restart. */
function api(url, req, res) {
  const json = (status, body) => {
    res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8',
                            'Cache-Control':'no-store' });
    res.end(JSON.stringify(body));
  };
  // `url` arrives with the query already stripped, so anything reading a
  // parameter has to go back to `req.url` for it.
  // The question bank's editor. It exists ONLY here: `api/` holds the Vercel
  // functions, and this one is deliberately not among them, so the deployed
  // site has no way to write the repo — absent by construction, not by a flag.
  // `api/_local.js` is still asked, because "the dev server" is not the claim
  // as "the machine running it" the day this port is forwarded somewhere.
  if (url === '/api/questions') return questions(req, res, json);

  if (url !== '/api/ask' && url !== '/api/log') return json(404, { error: 'no such endpoint' });

  // Env and handler are both re-read per request, so pasting a key into
  // .env.local or editing a provider takes effect on the next question with no
  // restart. That matters most while you are switching providers.
  loadEnv();
  let tutor;
  try {
    for (const k of Object.keys(require.cache)) {
      if (k.startsWith(path.join(ROOT, 'api'))) delete require.cache[k];
    }
    tutor = require(path.join(ROOT, 'api/_tutor.js'));
  } catch (e) {
    console.error(e);
    return json(500, { error: 'the API handler would not load. Run `npm i` in the repo root.' });
  }

  // Everything but /api/ask is a plain Vercel handler, so it gets the shim
  // rather than a second copy of the routing. `remoteAddress` has to survive it:
  // api/log.js decides who may read the log from exactly that.
  if (url === '/api/log') {
    const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    let handler;
    try { handler = require(path.join(ROOT, 'api/log.js')); }
    catch (e) { console.error(e); return json(500, { error: 'the log endpoint would not load' }); }
    const shim = { setHeader: () => {}, status: c => ({ json: b => json(c, b) }) };
    return Promise.resolve(handler({ method: req.method, query, socket: req.socket }, shim))
      .catch(e => json(500, { error: e.message }));
  }

  // The bench is a localhost affordance, and here every request is localhost by
  // definition. Computed the same way the Vercel function computes it rather
  // than hardcoded true, so the two transports cannot drift.
  const bench = require(path.join(ROOT, 'api/_local.js')).local(req);

  if (req.method === 'GET')  return json(200, tutor.config(bench));
  if (req.method !== 'POST') return json(405, { error: 'GET or POST only' });

  let raw = '';
  req.on('data', d => { raw += d; if (raw.length > 1e5) req.destroy(); });
  req.on('end', async () => {
    let payload = {};
    try { payload = JSON.parse(raw || '{}'); } catch { /* handled as a missing question */ }
    const out = await tutor.handleAsk(payload, { bench });
    console.log(`  api /api/ask → ${out.status}`);
    json(out.status, out.body);
  });
}

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
