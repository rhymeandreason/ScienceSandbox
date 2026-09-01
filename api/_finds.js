/* =============================================================================
 *  api/_finds.js — how many searches, and what was asked
 * =============================================================================
 *  Counted in Postgres for the reason _limit.js is: a serverless function has
 *  no memory between requests and none shared with the other instances running
 *  at the same moment. An in-process counter resets on every cold start and
 *  counts each instance separately, which is a limit only in the sense that it
 *  has a number in it.
 *
 *  TWO CAPS, AND THE GLOBAL ONE IS THE PROTECTION.
 *
 *  The VISITOR cap is friction. `visitorId` is a uuid the BROWSER minted, so
 *  anyone willing to mint a thousand has a thousand. It stops one stuck page
 *  from spending the afternoon's budget by accident, and it is not a defence.
 *
 *  The GLOBAL cap is what a script runs into. It needs no identity at all,
 *  which is exactly why it holds when the visitor cap does not. It is set well
 *  above a class of thirty browsing hard, and well below anything that would
 *  starve the tutor of the shared project's quota — which is the real risk
 *  here, since Gemini's rate limits are per PROJECT and a second API key would
 *  not separate them.
 *
 *  FAILS OPEN, like _limit.js: a database blip must not take the map away from
 *  a room full of people. The provider's prepaid cap stays the actual ceiling.
 *  Search degrades to word matching rather than to nothing, so a refusal here
 *  costs a reader accuracy and never the page.
 * ========================================================================== */
'use strict';

const log = require('./_log.js');

const LIMITS = {
  visitorHour: 80,     // a hard browsing session is maybe 30
  globalHour:  1200,   // 40 people searching steadily, and still far under quota
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUDGET_MS = 1200;

const uuidOrNull = v => (UUID.test(String(v || '')) ? v : null);

/* One round trip, not two: the counts differ only in their predicate. */
async function counts(visitor) {
  const db = log.sql();
  if (!db) return null;
  /* `kind <> 'land'` because the cap rations API CALLS and a landing made
     none — it is api/land.js recording where the offline half of the bar sent
     somebody. Counting it would throttle a reader for not spending anything.
     Legacy rows have a null kind and are counted, which is right: they were
     all searches. */
  const [row] = await db`
    SELECT count(*) FILTER (WHERE created_at > now() - interval '1 hour')             AS global_hour,
           count(*) FILTER (WHERE created_at > now() - interval '1 hour'
                              AND visitor_id = ${visitor})                            AS visitor_hour
    FROM finds
    WHERE created_at > now() - interval '1 hour'
      AND kind IS DISTINCT FROM 'land'`;
  return row;
}

async function exceeded({ visitorId }) {
  if (!log.enabled()) return null;
  const visitor = uuidOrNull(visitorId);

  let row;
  try {
    row = await Promise.race([
      counts(visitor),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), BUDGET_MS)),
    ]);
  } catch (err) {
    console.error('[finds] count failed, allowing the search:', (err && err.message) || err);
    return null;
  }
  if (!row) return null;

  if (Number(row.global_hour) >= LIMITS.globalHour) {
    return { status: 429, body: { error: 'the map is busy; word matching still works', scope: 'global' } };
  }
  if (visitor && Number(row.visitor_hour) >= LIMITS.visitorHour) {
    return { status: 429, body: { error: 'that is a lot of searching; word matching still works', scope: 'visitor' } };
  }
  return null;
}

/* Never awaited by the handler: a reader waits for their answer, not for the
 * row that records it. A failed insert is logged and dropped. */
function record({ visitorId, cohort, q, kind, ms, answer }) {
  const db = log.sql();
  if (!db) return;
  const visitor = uuidOrNull(visitorId), text = String(q).slice(0, 400), took = ms | 0;
  db`INSERT INTO finds (visitor_id, cohort, q, kind, ms, answer)
     VALUES (${visitor}, ${cohort || null}, ${text},
             ${kind === 'extend' ? 'extend' : 'find'}, ${took},
             ${answer ? JSON.stringify(answer) : null})`
    /* THE ROW MATTERS MORE THAN THE TAG. `kind` arrives by an ALTER in
       _schema.sql, and between a deploy and somebody running it this insert
       names a column that is not there — which would drop the row silently and
       take the RATE LIMIT with it, since the cap counts these rows. So a
       missing column costs the tag and nothing else. */
    .catch(e => {
      if (!/column .*(kind|answer).* does not exist/i.test((e && e.message) || '')) throw e;
      return db`INSERT INTO finds (visitor_id, cohort, q, ms)
                VALUES (${visitor}, ${cohort || null}, ${text}, ${took})`;
    })
    .catch(e => console.error('[finds] insert failed:', (e && e.message) || e));
}

module.exports = { exceeded, record, LIMITS };
