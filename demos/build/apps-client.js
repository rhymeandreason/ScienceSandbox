/* =============================================================================
 *  build/apps-client.js — what the builder and the viewer share
 * =============================================================================
 *  The access key, the visitor id, the edit tokens this browser holds, the
 *  fetch that carries them, and the one way a stored page is put on screen.
 *
 *  A PAGE RUNS IN A SANDBOX, ALWAYS. `mount` writes it into an iframe by
 *  `srcdoc` with `allow-scripts` and nothing else, so it lives on an opaque
 *  origin: it cannot read this page's storage, cannot send a request with
 *  this browser's key, and cannot navigate the parent. Two things are spliced
 *  into its head first: a `<base>` so the `../lib/` paths the reference uses
 *  resolve against the library one folder up, and a relay that posts every
 *  uncaught error to the parent, which is how the next build turn hears what
 *  the last one broke.
 *
 *  ON LOOPBACK THE FRAME RUNS SAME-ORIGIN, and that is the one exception.
 *  Chromium refuses every request an opaque origin makes to localhost (its
 *  local-network-access rule treats the sandbox as a public page), so on the
 *  dev server an opaque frame loads the CDN and nothing of the library.
 *  Deployed, the site is public and the rule never applies. Locally a stored
 *  page can therefore read this page's storage; the dev machine is the one
 *  place that is acceptable.
 *
 *  THE EDIT TOKEN RIDES IN THE URL ONCE. `?e=` is copied to storage and
 *  stripped from the address bar on arrival, the way the tutor's `?k=` is,
 *  so a screenshot or a pasted address does not hand out the right to save.
 *  Safari clears a site's storage after seven days of browser use without a
 *  visit, so the link in the email stays the real record, and the page says so.
 * ========================================================================== */
const Apps = (() => {
  'use strict';

  const KEY_KEY     = 'ss.tutor.key';       // shared with ask/chat.js: one link admits to both
  const VISITOR_KEY = 'ss.tutor.visitor';
  const STORE_KEY   = 'ss.apps';            // { id: { token, title, at } }

  const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* this page load only */ } };

  const url = new URL(location.href);
  const params = url.searchParams;
  let dirty = false;

  /* ---- the access link, exactly as chat.js does it ---------------------- */
  let KEY = params.get('k');
  if (KEY) { set(KEY_KEY, KEY); params.delete('k'); dirty = true; }
  else KEY = get(KEY_KEY);

  /* ---- the edit token for this app, if the link carried one ------------- */
  /* Deployed, `/app/<id>` is a rewrite and the browser never sees the query
   * it adds, so the id is read from the path when the query has none. */
  const ID = params.get('id') || (/^\/app\/([A-Za-z0-9_-]+)\/?$/.exec(url.pathname) || [])[1] || null;
  const fromLink = params.get('e');
  if (fromLink && ID) { remember(ID, fromLink); params.delete('e'); dirty = true; }
  if (dirty) { try { history.replaceState(null, '', url.pathname + (params.toString() ? '?' + params : '') + url.hash); } catch {} }

  const VISITOR = (() => { let v = get(VISITOR_KEY); if (!v) { v = uuid(); set(VISITOR_KEY, v); } return v; })();

  function store() { try { return JSON.parse(get(STORE_KEY) || '{}') || {}; } catch { return {}; } }
  function remember(id, token, title) {
    const s = store();
    s[id] = { ...(s[id] || {}), token, title: title || (s[id] || {}).title || '', at: Date.now() };
    set(STORE_KEY, JSON.stringify(s));
  }
  function forget(id) { const s = store(); delete s[id]; set(STORE_KEY, JSON.stringify(s)); }
  function tokenFor(id) { return (store()[id] || {}).token || null; }
  function mine() {
    return Object.entries(store()).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.at || 0) - (a.at || 0));
  }

  /* ---- fetch, with the headers ------------------------------------------ */
  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (KEY) headers['X-Tutor-Key'] = KEY;
    if (token) headers['X-App-Token'] = token;
    const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await r.json(); } catch { json = { error: `HTTP ${r.status}` }; }
    if (!r.ok) { const e = new Error((json && json.error) || `HTTP ${r.status}`); e.status = r.status; e.body = json; throw e; }
    return json;
  }

  /* ---- links ------------------------------------------------------------ *
   * Deployed, the short forms `/app/<id>` and `/build?id=` are vercel.json
   * rewrites; on the dev server the file path is the URL. Which world this is
   * shows in the address bar. */
  const fileForm = /\.html$/.test(location.pathname);
  const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  function link(kind, id, token) {
    const o = location.origin;
    if (kind === 'view') return fileForm ? `${o}/demos/build/app.html?id=${id}` : `${o}/app/${id}`;
    const base = fileForm ? `${o}/demos/build/build.html?id=${id}` : `${o}/build?id=${id}`;
    return kind === 'edit' && token ? `${base}&e=${token}` : base;
  }

  /* ---- the sandbox -------------------------------------------------------- */
  const RELAY = `<script>(function(){function send(m){try{parent.postMessage({type:'app-error',message:String(m).slice(0,300)},'*')}catch(e){}}
window.addEventListener('error',function(e){send((e.message||'error')+(e.filename?' @ '+String(e.filename).split('/').pop()+':'+e.lineno:''))});
window.addEventListener('unhandledrejection',function(e){send('unhandled: '+(e.reason&&e.reason.message||e.reason))});})();</script>`;

  function framed(html) {
    const base = `<base href="${location.origin}/demos/build/">`;
    const head = /<head[^>]*>/i.exec(html);
    return head ? html.slice(0, head.index + head[0].length) + '\n' + base + RELAY + html.slice(head.index + head[0].length)
                : base + RELAY + html;
  }

  /* Puts the page in the iframe and returns the errors it relays, as a live
   * array the caller drains between turns. */
  function mount(iframe, html, onError) {
    const errors = [];
    const listener = e => {
      if (e.source !== iframe.contentWindow || !e.data || e.data.type !== 'app-error') return;
      errors.push(e.data.message);
      if (onError) onError(e.data.message, errors);
    };
    if (iframe._appListener) window.removeEventListener('message', iframe._appListener);
    iframe._appListener = listener;
    window.addEventListener('message', listener);
    iframe.setAttribute('sandbox', LOOPBACK ? 'allow-scripts allow-same-origin' : 'allow-scripts');
    iframe.srcdoc = framed(html);
    return errors;
  }

  /* The file, standing alone: the library paths made absolute to this site. */
  function exportFile(html, title) {
    const abs = html.replace(/((?:src|href)=["'])\.\.\//g, `$1${location.origin}/demos/`);
    const blob = new Blob([abs], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || 'app').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'app'}.html`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* The closed door. Shown when a remix or a build answers 401: no copy is
   * made, and the page says why. */
  function beta() {
    let d = document.getElementById('betaModal');
    if (!d) {
      d = document.createElement('dialog');
      d.id = 'betaModal';
      d.className = 'beta';
      d.innerHTML = '<h2>Private beta</h2><p>Building and remixing apps is open to invited testers for now. Join the waitlist and we will send you a link.</p>'
        + '<form method="dialog"><button class="btn btn--tint" type="submit">OK</button></form>';
      document.body.appendChild(d);
    }
    d.showModal();
  }

  return { KEY, VISITOR, ID, api, link, mount, exportFile, remember, forget, tokenFor, mine, beta };
})();
