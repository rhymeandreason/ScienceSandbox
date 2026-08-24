/* =============================================================================
 *  api/_limit.js — how many questions a class has left
 * =============================================================================
 *  Counted in Postgres, because a serverless function has no memory between
 *  requests and no memory shared with the other instances answering at the same
 *  moment. An in-process counter would reset on every cold start and count each
 *  instance separately, which is a limit only in the sense that it has a number
 *  in it. The rows are already being written; this counts them.
 *
 *  TWO LEVELS, AND ONLY ONE OF THEM IS PROTECTION.
 *
 *  The COHORT cap is the real one. It is what a leaked link runs into, and the
 *  label it counts against is what makes one revocable without cutting off the
 *  other classes.
 *
 *  The VISITOR cap is friction and nothing more, because `visitorId` is a uuid
 *  the BROWSER minted for itself - anyone willing to mint a thousand has a
 *  thousand. It exists so one student with a stuck key does not eat their whole
 *  class's allowance by accident, and it must never be mistaken for a defence
 *  against someone deliberate.
 *
 *  FAILS OPEN. A database that is slow or down must not take a lesson away from
 *  thirty students mid-class, so an error here means the turn is allowed. That
 *  does mean the limit is bypassable by anyone who can degrade the database,
 *  and it is why the provider's prepaid cap stays the actual ceiling. No
 *  DATABASE_URL means no counting and therefore no limit, which is what a local
 *  checkout gets.
 * ========================================================================== */
'use strict';

const log = require('./_log.js');

const BUDGET_MS = 1500;   // a slow count must not become the answer's latency

/* Sized against a class of thirty asking about eight questions each in a
 * session - roughly 240 turns - and against a measured ~$0.0006 a turn, planned
 * at $0.002 to cover a thinking turn at three times the rate.
 *
 * The DAY cap is the one that buys reaction time. At the hourly cap alone a
 * leaked key drains a $10 prepaid balance overnight, while nobody is reading
 * the log; the daily cap stretches that past three days, which is long enough
 * for the viewer's per-cohort counts to say which link escaped. */
const LIMITS = {
  visitorHour: 40,    // MAX_TURNS is 40, so: one full thread an hour. Typical is 8.
  cohortHour:  500,   // 2x a fully active class
  cohortDay:   1500,  // 6x a class's day
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* One round trip, not three: the counts differ only in their predicate, so they
 * are FILTERs over a single scan already bounded to the last day. */
async function counts(cohort, visitor) {
  const db = log.sql();
  if (!db) return null;
  return db`
    SELECT
      count(*) FILTER (WHERE t.cohort = ${cohort}
                         AND m.created_at > now() - interval '1 hour')::int AS cohort_hour,
      count(*) FILTER (WHERE t.cohort = ${cohort})::int                     AS cohort_day,
      count(*) FILTER (WHERE t.visitor_id = ${visitor}::uuid
                         AND m.created_at > now() - interval '1 hour')::int AS visitor_hour
    FROM   messages m
    JOIN   threads  t ON t.id = m.thread_id
    WHERE  m.role = 'user'
      AND  m.created_at > now() - interval '1 day'
      AND  (t.cohort = ${cohort} OR t.visitor_id = ${visitor}::uuid)`;
}

/* Null to allow the turn, or {status, body} to refuse it - the same shape the
 * access gate returns, so `handleAsk` refuses both the same way.
 *
 * Ungated deployments are not limited. Without a cohort there is nothing to
 * count against and nothing to revoke, so a limit would be counting strangers
 * into one bucket; that configuration is the one to fix, not to meter. */
async function exceeded({ cohort, visitorId }) {
  if (!cohort) return null;
  if (!log.enabled()) return null;

  const visitor = UUID.test(String(visitorId || '')) ? visitorId : null;

  let row;
  try {
    const work = counts(cohort, visitor);
    const [r] = await Promise.race([
      work,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), BUDGET_MS)),
    ]);
    row = r;
  } catch (err) {
    // Open, deliberately. See the header: a database blip is not a reason to
    // end a lesson, and the prepaid cap is the ceiling that always holds.
    console.error('[limit] count failed, allowing the turn:', (err && err.message) || err);
    return null;
  }
  if (!row) return null;

  // The class first: it is the cap that means something, and a student told
  // "your class has used its questions" understands it in a way that a message
  // about their own browser would not explain.
  if (row.cohort_day >= LIMITS.cohortDay)
    return refuse('This class has used its questions for today. They come back tomorrow.');
  if (row.cohort_hour >= LIMITS.cohortHour)
    return refuse('This class has asked a lot in the last hour. Try again shortly.');
  if (row.visitor_hour >= LIMITS.visitorHour)
    return refuse('You have asked a lot in the last hour. Try again shortly, so there is room for the rest of the class.');

  return null;
}

/* 429, and a sentence a student can act on. A limit that reads as a crash gets
 * reported as a bug, and the reason it fired is not a secret worth keeping. */
function refuse(message) { return { status: 429, body: { error: message } }; }

module.exports = { exceeded, LIMITS };
