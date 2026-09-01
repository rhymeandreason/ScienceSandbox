/* =============================================================================
 *  api/_log.js — the tutor's notebook
 * =============================================================================
 *  Writes one row per message to Neon. Everything here is best-effort: a log
 *  that fails must cost the student nothing, so every path swallows its error
 *  to the console and returns. `handleAsk` never sees a rejection from here.
 *
 *  Off by default. With no `DATABASE_URL` every call is a no-op, which is what
 *  a contributor without a database gets, and what GitHub Pages gets.
 *
 *  HTTP, not TCP: `neon()` is one fetch per statement, which is the shape a
 *  function that may be frozen the moment it responds can actually use. A pool
 *  would be holding a socket nothing is going to close.
 * ========================================================================== */
'use strict';

const BUDGET_MS = 2000;   // a slow database delays nobody's answer past this

let _sql = null;          // the neon client, or false once we know there is none
function sql() {
  if (_sql !== null) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) return (_sql = false);
  try {
    const { neon } = require('@neondatabase/serverless');
    return (_sql = neon(url));
  } catch (err) {
    // The driver is not installed. Say so once; do not say it per question.
    console.error('[log] no database driver, logging off:', err.message);
    return (_sql = false);
  }
}

function enabled() { return !!sql(); }

/* A write nothing waits on longer than it is worth waiting. The timeout does
 * not cancel the request - it stops the answer being held hostage to it. */
async function within(label, work) {
  let timer;
  try {
    await Promise.race([
      work(),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out')), BUDGET_MS); }),
    ]);
  } catch (err) {
    console.error(`[log] ${label} failed:`, (err && err.message) || err);
  } finally {
    clearTimeout(timer);
  }
}

/* Record one exchange: the question as it was asked, and whatever came back -
 * an answer or the error the student was shown.
 *
 * The thread row is upserted rather than created, because the client mints the
 * id and the server never learns which turn is the first one.
 *
 * `turn` is counted from the rows already in the thread, not from the length of
 * the transcript the client sent. The single-question form has no transcript to
 * count, so a client using it would number every question 1. */
async function logTurn({ threadId, visitorId, lesson, cohort, question, step, state, out, error, ms }) {
  const db = sql();
  if (!db) return;
  if (!isUuid(threadId) || !isUuid(visitorId)) return;   // a malformed id is not worth a row

  await within('write', async () => {
    // DO NOTHING on conflict, so the cohort is whatever the thread started on.
    // A thread belongs to the link it arrived by; a later turn cannot move it.
    await db`INSERT INTO threads (id, visitor_id, lesson, cohort)
             VALUES (${threadId}, ${visitorId}, ${lesson || null}, ${cohort || null})
             ON CONFLICT (id) DO NOTHING`;

    const [q] = await db`
      INSERT INTO messages (thread_id, turn, role, text, step, state)
      VALUES (${threadId},
              (SELECT count(*) + 1 FROM messages m
               WHERE m.thread_id = ${threadId} AND m.role = 'user'),
              'user', ${question},
              ${Number.isFinite(step) ? step : null}, ${json(state)})
      RETURNING id, turn`;

    // Linked to the question by id. Pairing on (thread, turn) instead is what
    // makes two same-numbered questions multiply against two answers.
    await db`INSERT INTO messages (thread_id, turn, reply_to, role, text, point, chapters,
                                   provider, model, usage, ms, error)
             VALUES (${threadId}, ${q.turn}, ${q.id}, 'assistant',
                     ${out ? out.answer : String(error || 'failed')},
                     ${json(out && out.point)}, ${json(out && out.chapters)},
                     ${out ? out.provider : null}, ${out ? out.model : null},
                     ${json(out && out.usage)},
                     ${Number.isFinite(ms) ? ms : null},
                     ${error || null})`;
  });
}

/* ---- reading it back --------------------------------------------------------
 * The viewer's queries live here rather than in the endpoint, so the page and
 * `tools/db.js` cannot drift into two ideas of what a turn is. Everything reads
 * the `turns` view, which is the join the schema exists to make.
 *
 * These DO throw. A viewer that silently shows nothing when the database is
 * unreachable is worse than one that says so, which is the opposite of the rule
 * on the write path. */
async function recent({ limit = 50, offset = 0, lesson = null, aimed = null, model = null, cohort = null } = {}) {
  const db = sql();
  if (!db) throw new Error('DATABASE_URL is not set');
  const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const o = Math.max(Number(offset) || 0, 0);

  // Every filter is optional and they combine, so the predicate is written as
  // SQL that reads its own parameters rather than as branches per combination.
  // A tagged template is safe because a parameter cannot become SQL; building
  // the WHERE by string concatenation is exactly how that stops being true, and
  // one `null`-tolerant predicate beats eight hand-written pairs.
  return db`SELECT * FROM turns
            WHERE (${lesson}::text IS NULL OR lesson = ${lesson})
              AND (${model}::text  IS NULL OR model  = ${model})
              AND (${cohort}::text IS NULL OR cohort = ${cohort})
              AND (${aimed}::text  IS NULL OR (${aimed} = 'none' AND point_id IS NULL))
            LIMIT ${n} OFFSET ${o}`;
}

/* The numbers above the list. One round trip, because four would be four. */
async function stats() {
  const db = sql();
  if (!db) throw new Error('DATABASE_URL is not set');
  const [row] = await db`
    SELECT count(*)::int                                         AS turns,
           count(DISTINCT thread_id)::int                         AS threads,
           count(DISTINCT visitor_id)::int                        AS visitors,
           count(*) FILTER (WHERE error IS NOT NULL)::int         AS errors,
           count(*) FILTER (WHERE point_id IS NULL)::int          AS unaimed,
           round(sum((usage->>'cost_usd')::numeric), 4)           AS usd,
           round(avg(ms))::int                                    AS avg_ms
    FROM turns`;
  const lessons = await db`SELECT coalesce(lesson, '(none)') AS lesson, count(*)::int AS n
                           FROM turns GROUP BY 1 ORDER BY 2 DESC`;
  // Per cohort, which is per access link. Usage by class is what says whether a
  // link has escaped: a cohort of thirty students that suddenly outruns the
  // rest is the signal, and the totals hide it.
  const cohorts = await db`SELECT cohort, count(*)::int AS n
                           FROM turns WHERE cohort IS NOT NULL
                           GROUP BY 1 ORDER BY 2 DESC`;
  // Per model, because comparing two models on the same questions is the whole
  // reason to look: median latency and spend per turn are what differ, and a
  // total hides both behind whichever model answered most.
  const models = await db`SELECT model, count(*)::int AS n, round(avg(ms))::int AS avg_ms,
                                 round(avg((usage->>'cost_usd')::numeric), 5) AS avg_usd
                          FROM turns WHERE model IS NOT NULL
                          GROUP BY 1 ORDER BY 2 DESC`;
  return { ...row, lessons, models, cohorts };
}

/* Apply the schema. Idempotent, and separate from the answer path on purpose:
 * a request must never be the thing that decides to create a table. */
async function init() {
  const db = sql();
  if (!db) throw new Error('DATABASE_URL is not set');
  const fs   = require('fs');
  const path = require('path');
  const ddl  = fs.readFileSync(path.join(__dirname, '_schema.sql'), 'utf8');
  // The HTTP driver is one statement per request. Drop the comment lines first,
  // then split on the boundary the file uses: a semicolon ending a line.
  const bare = ddl.replace(/^\s*--.*$/gm, '');
  for (const stmt of bare.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) {
    await db.query(stmt);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s) { return typeof s === 'string' && UUID.test(s); }
function json(v)   { return v == null ? null : JSON.stringify(v); }


/* ---- the composer's searches -------------------------------------------
 * A different table and a different question. `messages` records how the tutor
 * ANSWERED; `finds` records what someone typed at the map, and the value in it
 * is the repeats: one person asking about osmosis is a person, forty are a
 * lesson that is missing. So the roll-up is by text, and the raw list is there
 * to read the wording rather than to count it.
 *
 * Deliberately NOT joined to threads/messages. A visitor id is shared, so the
 * join is possible, and building it would turn two anonymous logs into one
 * profile of a person's afternoon. */
async function finds({ limit = 60 } = {}) {
  const db = sql();
  if (!db) throw new Error('DATABASE_URL is not set');
  const n = Math.min(Math.max(Number(limit) || 60, 1), 300);
  return db`
    SELECT q, cohort, kind, answer, ms, created_at
    FROM   finds
    ORDER  BY id DESC
    LIMIT  ${n}`
    /* A DATABASE THAT PREDATES `kind` AND `answer` MUST STILL SHOW ITS
       SEARCHES. Not a deploy-ordering guard: there is ONE database, and the
       ALTERs in _schema.sql are run against it by hand, so a deploy never
       arrives ahead of them. What this covers is a checkout pointed at a
       database somebody else's ALTER has not reached — a second environment,
       a restored dump, a colleague's branch — where the honest failure is a
       list with no tags rather than the whole searches tab replaced by
       `column "kind" does not exist`. */
    .catch(e => {
      if (!/column .*(kind|answer).* does not exist/i.test((e && e.message) || '')) throw e;
      return db`
        SELECT q, cohort, ms, created_at
        FROM   finds
        ORDER  BY id DESC
        LIMIT  ${n}`;
    });
}

async function findStats() {
  const db = sql();
  if (!db) throw new Error('DATABASE_URL is not set');
  const [row] = await db`
    SELECT count(*)::int                                                   AS searches,
           count(DISTINCT visitor_id)::int                                 AS visitors,
           count(DISTINCT lower(q))::int                                   AS distinct_q,
           count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS day,
           round(avg(ms))::int                                             AS avg_ms
    FROM   finds`;
  const asked = await db`
    SELECT lower(q) AS q, count(*)::int AS n
    FROM   finds
    GROUP  BY lower(q)
    HAVING count(*) > 1
    ORDER  BY count(*) DESC, max(id) DESC
    LIMIT  20`;
  return { ...row, asked };
}

module.exports = { logTurn, recent, stats, init, enabled, sql, finds, findStats };
