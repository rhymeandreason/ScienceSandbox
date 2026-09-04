/* =============================================================================
 *  api/build.js — the builder's model turn
 * =============================================================================
 *  GET  /api/build → whether this link may build, and what the reference has
 *  POST /api/build {request, visitorId, id?, token?, errors?, provider?}
 *                → {id, token?, n, title, summary, html, mode, usage, ms, problems}
 *
 *  Without `id` it is a first draft: a new app row, its first version, and the
 *  edit token, which this reply is the only place to get. With `id` it is an
 *  edit, and the token has to match. Every turn that reached a model writes a
 *  version row, including the ones that produced no page, so the cost of a
 *  failure is on the record next to the cost of a success.
 *
 *  Gated by the same key as the tutor, for the same reason: a forwarded email
 *  must not be able to spend the budget. `_apps.js` counts the builds; the
 *  thinking is `_builder.js`, which the eval script shares.
 * ========================================================================== */
'use strict';

const keys    = require('./_keys.js');
const apps    = require('./_apps.js');
const builder = require('./_builder.js');
const providers = require('./_providers/index.js');
const { local } = require('./_local.js');

const MAX_ERRORS = 8;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const who = keys.cohort(req);
  const bench = local(req);

  if (keys.enabled() && !who) {
    return res.status(401).json({ error: 'the builder is open to invited testers; ask for an access link' });
  }

  if (req.method === 'GET') {
    let components = [];
    try { components = builder.components(); } catch { /* reference missing: reported below */ }
    return res.status(200).json({
      ok: apps.enabled() && !!process.env[providers.pick(null, bench).envKey],
      gated: keys.enabled(), cohort: who, bench,
      provider: providers.DEFAULT, limits: apps.LIMITS, components,
      maxRequest: builder.MAX_REQUEST,
    });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'GET or POST only' });
  }
  if (!apps.enabled()) return res.status(503).json({ error: 'no database configured; nothing can be saved' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});
  const request = String(body.request || '').trim();
  if (!request) return res.status(400).json({ error: 'say what to build' });
  if (request.length > builder.MAX_REQUEST) return res.status(400).json({ error: `keep it under ${builder.MAX_REQUEST} characters` });
  const errors = (Array.isArray(body.errors) ? body.errors : []).slice(0, MAX_ERRORS).map(e => String(e).slice(0, 300));
  const provider = bench && body.provider ? String(body.provider) : null;

  const capped = await apps.exceeded({ cohort: who, visitorId: body.visitorId });
  if (capped) return res.status(capped.status).json(capped.body);

  try {
    if (body.id) {
      if (!(await apps.mayEdit(body.id, body.token))) return res.status(403).json({ error: 'this link cannot edit that app' });
      const app = await apps.read(body.id);
      if (!app || !app.version) return res.status(404).json({ error: 'no such app' });

      const out = await builder.edit({ html: app.version.html, request, errors, provider, bench });
      const failed = !out.html;
      const v = await apps.addVersion(app.id, {
        kind: 'edit', html: out.html || app.version.html, request, summary: out.summary,
        errors: errors.length ? errors : null,
        provider: out.provider, model: out.model, usage: out.usage, ms: out.ms,
        error: failed ? (out.problems.join('; ') || 'no page came back') : null,
      });
      return res.status(200).json({
        id: app.id, n: v.n, title: app.title, summary: out.summary,
        html: out.html || app.version.html, changed: !failed,
        mode: out.mode, edits: out.edits, fallback: out.fallback, problems: out.problems,
        model: out.model, usage: out.usage, ms: out.ms,
      });
    }

    const out = await builder.draft({ request, provider, bench });
    const failed = out.problems.length > 0;
    const made = await apps.create({
      cohort: who, visitorId: body.visitorId, title: out.title, isLocal: bench,
      version: {
        kind: 'build', html: out.html, request, summary: out.summary,
        provider: out.provider, model: out.model, usage: out.usage, ms: out.ms,
        error: failed ? out.problems.join('; ') : null,
      },
    });
    return res.status(200).json({
      id: made.id, token: made.token, n: made.version.n,
      title: out.title, summary: out.summary, html: out.html, changed: true,
      mode: 'draft', retried: out.retried, problems: out.problems,
      model: out.model, usage: out.usage, ms: out.ms,
    });
  } catch (err) {
    console.error('[build] ' + ((err && err.message) || err));
    return res.status(502).json({ error: 'the build failed: ' + ((err && err.message) || 'unknown error') });
  }
};

function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
