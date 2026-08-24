/* =============================================================================
 *  api/_keys.js — which cohort is asking, if the tutor is gated at all
 * =============================================================================
 *  `TUTOR_KEYS=bio101-fall:<secret>,openday:<secret>`. A key names a COHORT and
 *  never a person: the label is what the log records and what a rate limit
 *  attaches to, so a link that escapes is revoked on its own without cutting
 *  anyone else off.
 *
 *  Unset means the gate does not exist and every request is answered. That is
 *  what a fresh checkout gets and what the dev server gets, so running locally
 *  needs no key for the tutor's own sake - only a provider key. Set it locally
 *  and the gate applies to loopback too: a gate you cannot test from the
 *  machine you are writing it on is a gate nobody has ever seen work.
 *
 *  This is a bearer token and nothing more. Everyone it is forwarded to has it.
 *  It protects SPEND, never anything private, and the provider's prepaid cap
 *  stays the real backstop. Leakage is expected; rotation is routine.
 * ========================================================================== */
'use strict';

const crypto = require('crypto');

/* Parsed per call, not once at module load: the dev server re-reads .env.local
 * per request, so caching here would mean a pasted key needs a restart. The
 * list is a handful of entries and this is not the expensive part of a turn. */
function pairs() {
  const raw = process.env.TUTOR_KEYS || '';
  const out = [];
  for (const entry of raw.split(',')) {
    const at = entry.indexOf(':');
    if (at < 1) continue;                       // no label, or no colon: not a pair
    const label  = entry.slice(0, at).trim();
    const secret = entry.slice(at + 1).trim();
    if (label && secret) out.push({ label, secret });
  }
  return out;
}

/* Whether the gate exists. A malformed TUTOR_KEYS that yields no usable pair
 * counts as OFF rather than as "nobody may ask": a typo in an env var should
 * not look identical to a deliberate lockout, and the GET says which it is. */
function enabled() { return pairs().length > 0; }

/* The cohort a secret names, or null. Compared in constant time so a wrong key
 * cannot be walked to a right one a character at a time. */
function labelFor(secret) {
  const s = String(secret || '');
  if (!s) return null;
  let found = null;
  for (const p of pairs()) if (same(s, p.secret)) found = p.label;
  return found;
}

function same(a, b) {
  const A = Buffer.from(a), B = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length. Hash first: both sides become 32 bytes whatever went in.
  return crypto.timingSafeEqual(sha(A), sha(B));
}
function sha(buf) { return crypto.createHash('sha256').update(buf).digest(); }

/* The header the browser sends. Not a query string: `?k=` lands in access logs,
 * browser history and screenshots, and a header lands in none of them. The page
 * strips it from the address bar after the first load. */
const HEADER = 'x-tutor-key';

/* The transport's half - the only part that touches a request object, for the
 * same reason `_local.js` is shaped this way: `handleAsk` receives a label. */
function cohort(req) {
  const h = (req && req.headers && req.headers[HEADER]) || '';
  return labelFor(Array.isArray(h) ? h[0] : h);
}

module.exports = { enabled, labelFor, cohort, HEADER };
