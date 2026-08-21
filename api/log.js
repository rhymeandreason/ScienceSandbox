/* =============================================================================
 *  api/log.js — read the tutor's log
 * =============================================================================
 *  GET /api/log?limit=&offset=&lesson=&aimed=none  → {stats, turns}
 *
 *  A LOCAL TOOL. `.vercelignore` keeps this out of production, and this answers
 *  only to a request from the machine it runs on, so the two would both have to
 *  fail before anyone reached a student's question.
 *
 *  There is no token, on purpose. The log lives in Neon, so `.env.local` points
 *  at the same database production writes to and the dev server shows real data
 *  with nothing public in the path. A secret exists to be leaked; not needing
 *  one is better than guarding one.
 * ========================================================================== */
'use strict';

const log = require('./_log.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }

  const q = req.query || {};
  if (!local(req)) return res.status(403).json({ error: 'the log reads only from localhost' });

  if (!log.enabled()) return res.status(503).json({ error: 'DATABASE_URL is not set: nothing is logged' });

  try {
    const [stats, turns] = await Promise.all([
      log.stats(),
      log.recent({ limit: q.limit, offset: q.offset, lesson: q.lesson || null,
                   aimed: q.aimed || null, model: q.model || null }),
    ]);
    return res.status(200).json({ stats, turns });
  } catch (err) {
    // Said out loud, unlike on the write path: a viewer showing an empty list
    // because the database is unreachable is a viewer that lies.
    console.error('[log] read failed:', err.message);
    return res.status(502).json({ error: err.message });
  }
};

/* Only this machine. `req.socket` is the real peer; a forwarding header is
 * whatever the client wrote, so it is not consulted. */
function local(req) {
  const a = (req.socket && req.socket.remoteAddress) || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

