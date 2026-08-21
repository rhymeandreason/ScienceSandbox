#!/usr/bin/env node
/* =============================================================================
 *  tools/db.js — the tutor's log, from the terminal
 * =============================================================================
 *    node demos/tools/db.js init     apply api/_schema.sql (idempotent)
 *    node demos/tools/db.js recent   the last 20 exchanges, screen beside aim
 *    node demos/tools/db.js aim      where the tutor pointed, by target
 *    node demos/tools/db.js cost     turns, tokens and dollars per day
 *
 *  Reads `.env.local` the way the dev server does, so it needs no key of its
 *  own. Next to the dev server because that is where the repo keeps the things
 *  you run rather than the things that ship.
 * ========================================================================== */
'use strict';

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

for (const line of read(path.join(ROOT, '.env.local')).split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const log = require(path.join(ROOT, 'api/_log.js'));

const CMDS = {
  async init() {
    await log.init();
    console.log('schema applied');
  },

  async recent() {
    const sql = log.sql();
    const rows = await sql`SELECT lesson, turn, question, answer, step, state,
                                  point_id, ms, error
                           FROM turns LIMIT 20`;
    if (!rows.length) return console.log('nothing logged yet');
    for (const r of rows) {
      console.log(`\n${r.lesson || '(no lesson)'} · turn ${r.turn}`
        + (r.step != null ? ` · step ${r.step}` : '')
        + ` · → ${r.point_id || 'none'}` + (r.ms ? ` · ${r.ms}ms` : ''));
      console.log(`  Q ${r.question}`);
      // On a failed turn `answer` IS the error the student was shown; printing
      // both would print it twice.
      console.log(r.error ? `  ! ${r.error}` : `  A ${(r.answer || '').slice(0, 160)}`);
      if (r.state) console.log(`  screen ${JSON.stringify(r.state)}`);
    }
  },

  async aim() {
    const sql = log.sql();
    const rows = await sql`SELECT lesson, coalesce(point_id, 'none') AS target, count(*)::int AS n
                           FROM (SELECT * FROM turns LIMIT 500) t
                           GROUP BY 1, 2 ORDER BY 1, 3 DESC`;
    if (!rows.length) return console.log('nothing logged yet');
    for (const r of rows) console.log(`${String(r.n).padStart(4)}  ${r.lesson || '-'}  ${r.target}`);
  },

  async cost() {
    const sql = log.sql();
    const rows = await sql`SELECT created_at::date AS day, count(*)::int AS turns,
                                  sum((usage->>'input')::int)  AS in_tok,
                                  sum((usage->>'output')::int) AS out_tok,
                                  sum((usage->>'cached')::int) AS cached_tok,
                                  round(sum((usage->>'cost_usd')::numeric), 4) AS usd
                           FROM turns WHERE usage IS NOT NULL
                           GROUP BY 1 ORDER BY 1 DESC`;
    if (!rows.length) return console.log('nothing logged yet');
    for (const r of rows) console.log(`${String(r.day).slice(0, 10)}  `
      + `${String(r.turns).padStart(4)} turns  in ${r.in_tok} (cached ${r.cached_tok})  `
      + `out ${r.out_tok}  $${r.usd}`);
  },
};

(async () => {
  const cmd = process.argv[2];
  if (!CMDS[cmd]) {
    console.error('usage: node demos/tools/db.js ' + Object.keys(CMDS).join(' | '));
    process.exit(1);
  }
  if (!log.enabled()) {
    console.error('DATABASE_URL is not set in .env.local');
    process.exit(1);
  }
  try { await CMDS[cmd](); }
  catch (err) { console.error(err.message); process.exit(1); }
})();
