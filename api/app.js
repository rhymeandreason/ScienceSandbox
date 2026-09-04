/* =============================================================================
 *  api/app.js — a stored app: read it, save it, fork it
 * =============================================================================
 *  GET  /api/app?id=X                 → the latest page, for anyone with the id
 *  GET  /api/app?id=X&versions=1      → the history, token required
 *  GET  /api/app?id=X&n=3             → one version's page, token required
 *  POST /api/app {action, id, token?, ...}
 *       save    {html, summary?}      → a new version from the holder of the token
 *       restore {n}                   → a new version copying an old one
 *       remix   {visitorId}           → a new app whose parent is this one, with its own token
 *       rotate                        → a fresh token; the old link stops working
 *       title   {title}
 *
 *  Nothing here calls a model, so nothing here is rate limited. Reading is
 *  open: an id is unguessable and a view link is meant to be shared. A REMIX
 *  NEEDS THE ACCESS KEY, the same one the builder wants, because a copy that
 *  cannot be edited is a dead end and the beta is closed; the viewer shows a
 *  waitlist notice instead of making one.
 *  The token travels in the `X-App-Token` header or the body, never a query
 *  string, for the reason `_keys.js` gives.
 * ========================================================================== */
'use strict';

const apps    = require('./_apps.js');
const keys    = require('./_keys.js');
const builder = require('./_builder.js');
const { local } = require('./_local.js');

const MAX_HTML = 400000;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!apps.enabled()) return res.status(503).json({ error: 'no database configured' });

  const query = req.query || {};
  const body  = req.method === 'POST'
    ? (typeof req.body === 'string' ? safeParse(req.body) : (req.body || {})) : {};
  const id    = String(query.id || body.id || '');
  const token = header(req, 'x-app-token') || body.token || null;
  if (!apps.validId(id)) return res.status(400).json({ error: 'id is required' });

  try {
    if (req.method === 'GET') {
      const app = await apps.read(id);
      if (!app || !app.version) return res.status(404).json({ error: 'no such app' });

      if (query.versions || query.n) {
        if (!(await apps.mayEdit(id, token))) return res.status(403).json({ error: 'the history is the editor\'s' });
        if (query.n) {
          const v = await apps.version(id, Number(query.n));
          return v ? res.status(200).json(v) : res.status(404).json({ error: 'no such version' });
        }
        return res.status(200).json({ id, title: app.title, versions: await apps.versions(id) });
      }
      return res.status(200).json({
        id, title: app.title, parent: app.parent_id, created_at: app.created_at,
        n: app.version.n, kind: app.version.kind, summary: app.version.summary,
        html: app.version.html,
      });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'GET or POST only' });
    }

    const action = String(body.action || '');

    if (action === 'remix') {
      if (keys.enabled() && !keys.cohort(req)) return res.status(401).json({ error: 'private beta', beta: true });
      const app = await apps.read(id);
      if (!app || !app.version) return res.status(404).json({ error: 'no such app' });
      const made = await apps.create({
        cohort: keys.cohort(req), visitorId: body.visitorId, parentId: id, isLocal: local(req),
        title: String(body.title || app.title || '').slice(0, 120),
        version: { kind: 'remix', html: app.version.html, summary: `remixed from ${id}` },
      });
      return res.status(200).json({ id: made.id, token: made.token, n: made.version.n });
    }

    if (!(await apps.mayEdit(id, token))) return res.status(403).json({ error: 'this link cannot edit that app' });

    if (action === 'save') {
      const html = String(body.html || '');
      if (!html || html.length > MAX_HTML) return res.status(400).json({ error: 'html is required and under 400 KB' });
      const problems = builder.validate(html);
      if (problems.length) return res.status(400).json({ error: 'the page would not pass', problems });
      const v = await apps.addVersion(id, { kind: 'save', html, summary: String(body.summary || '').slice(0, 300) || null });
      return res.status(200).json({ id, n: v.n });
    }

    if (action === 'restore') {
      const old = await apps.version(id, Number(body.n));
      if (!old) return res.status(404).json({ error: 'no such version' });
      const v = await apps.addVersion(id, { kind: 'restore', html: old.html, summary: `restored version ${old.n}` });
      return res.status(200).json({ id, n: v.n, html: old.html });
    }

    if (action === 'rotate') {
      return res.status(200).json({ id, token: await apps.rotate(id) });
    }

    if (action === 'title') {
      await apps.setTitle(id, body.title);
      return res.status(200).json({ id, title: String(body.title || '').slice(0, 120) });
    }

    return res.status(400).json({ error: 'action must be save, restore, remix, rotate or title' });
  } catch (err) {
    console.error('[app] ' + ((err && err.message) || err));
    return res.status(500).json({ error: 'the app store failed' });
  }
};

function header(req, name) {
  const h = (req && req.headers && req.headers[name]) || '';
  return Array.isArray(h) ? h[0] : (h || null);
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
