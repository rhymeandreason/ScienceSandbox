/* =============================================================================
 *  api/_local.js — is this request coming from the machine serving it
 * =============================================================================
 *  The one question two endpoints ask before handing out something that is not
 *  for the public: the log's contents, and the bench's ability to rewrite the
 *  tutor's prompt. Both are developer affordances, and "I am the developer"
 *  means "I am on this machine".
 *
 *  This replaces an ASK_BENCH environment variable. A flag is safe only while
 *  someone remembers not to set it, is silent when it is wrong, and travels to
 *  production in whatever gets copied into a project's settings. An address
 *  cannot be forgotten: deployed, no real request is ever loopback, so the
 *  capability is absent by construction rather than by discipline.
 *
 *  `req.socket` is the real peer. A forwarding header is whatever the client
 *  wrote, so it is not consulted - trusting one here would hand the bench to
 *  anyone willing to type `X-Forwarded-For: 127.0.0.1`.
 * ========================================================================== */
'use strict';

function local(req) {
  const a = (req && req.socket && req.socket.remoteAddress) || '';
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

module.exports = { local };
