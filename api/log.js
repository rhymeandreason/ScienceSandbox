/* =============================================================================
 *  api/log.js — read the tutor's log
 * =============================================================================
 *  GET /api/log?limit=&offset=&lesson=&aimed=none  → {stats, turns}
 *
 *  This serves other people's questions back, so it is guarded, and the guard
 *  fails CLOSED: with no `LOG_TOKEN` set it answers only to a request from this
 *  machine. Deployed, that is nobody, so the endpoint is off until you set the
 *  token deliberately. The alternative default - open when unconfigured - is
 *  how a log ends up published, and it would be published by omission.
 *
 *  The token is compared in constant time. It is a small thing against an
 *  endpoint nobody is going to attack with a timing oracle, and it costs one
 *  function.
 * ========================================================================== */
'use strict';

const crypto = require('crypto');
const log = require('./_log.js');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }

  const q = req.query || {};
  if (!allowed(req, q)) return res.status(403).json({ error: 'set LOG_TOKEN and pass ?key=' });

  if (!log.enabled()) return res.status(503).json({ error: 'DATABASE_URL is not set: nothing is logged' });

  try {
    const [stats, turns] = await Promise.all([
      log.stats(),
      log.recent({ limit: q.limit, offset: q.offset, lesson: q.lesson || null,
                   aimed: q.aimed || null }),
    ]);
    return res.status(200).json({ stats, turns });
  } catch (err) {
    // Said out loud, unlike on the write path: a viewer showing an empty list
    // because the database is unreachable is a viewer that lies.
    console.error('[log] read failed:', err.message);
    return res.status(502).json({ error: err.message });
  }
};

function allowed(req, q) {
  const token = process.env.LOG_TOKEN;
  if (token) return same(String(q.key || ''), token);
  return local(req);
}

/* Only this machine. `req.socket` is the real peer; a forwarding header is
 * whatever the client wrote, so it is not consulted. */
function local(req) {
  const a = (req.socket && req.socket.remoteAddress) || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

function same(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  if (x.length !== y.length) return false;      // length leaks; the secret does not
  return crypto.timingSafeEqual(x, y);
}
