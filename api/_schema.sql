-- =============================================================================
--  api/_schema.sql - what the tutor writes down
-- =============================================================================
--  Applied by `npm run db:init`, which is idempotent. Neon Postgres.
--
--  No IP address, no user agent string, no name. A visitor is a random id the
--  browser minted for itself and can clear by clearing site data. `cohort` is
--  the access link's label, so it says which class asked and never who.
--
--  One row per message. The question's row carries the moment it was asked in
--  (`step`, `state`); the answer's row carries how it was produced (`point`,
--  `chapters`, `usage`), and points back at its question with `reply_to`. The
--  `turns` view joins on that, because the aiming question is always "given
--  THAT screen, why THAT target".
--
--  The join is on `reply_to` and NOT on (thread_id, turn): a client sending the
--  single-question form has no transcript to count, so two questions in one
--  thread can carry the same turn number and the join multiplies them.
-- =============================================================================

CREATE TABLE IF NOT EXISTS threads (
  id          uuid PRIMARY KEY,
  visitor_id  uuid NOT NULL,               -- stable per browser, cleared with site data
  lesson      text,                        -- null: the plain ask box, no lesson around it
  cohort      text,                        -- the access link's label; null: ungated (local, or no TUTOR_KEYS)
  started_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id          bigserial PRIMARY KEY,
  thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  turn        int  NOT NULL,               -- 1-based, counted server-side; display only
  reply_to    bigint REFERENCES messages(id) ON DELETE CASCADE,   -- set on the answer's row
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  text        text NOT NULL,               -- the question, the answer, or the error shown

  -- The question's half: where they were standing when they asked.
  step        int,
  state       jsonb,

  -- The answer's half: what came back and what it cost.
  point       jsonb,                       -- the resolved target, or null for 'none'
  chapters    jsonb,
  provider    text,
  model       text,
  usage       jsonb,
  ms          int,
  error       text,                        -- set instead of a real answer; `text` holds what the student saw

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_idx  ON messages (thread_id, turn, role);
CREATE INDEX IF NOT EXISTS messages_created_idx ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS threads_visitor_idx  ON threads (visitor_id, started_at DESC);

-- Applied to a table that predates the column. Harmless on a fresh one.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to bigint REFERENCES messages(id) ON DELETE CASCADE;

-- Which access link the thread arrived on. A cohort, never a person: the label
-- is what a rate limit counts against, so it has to be recorded before one can
-- exist. Null on every row written before the gate, and on any ungated request.
ALTER TABLE threads ADD COLUMN IF NOT EXISTS cohort text;

-- After the ALTERs, not with the other indexes: on an existing table these
-- columns do not exist until the lines above run.
CREATE INDEX IF NOT EXISTS messages_reply_idx ON messages (reply_to);

-- The rate limit's query is "how many turns has this cohort taken since T",
-- which is this index and nothing cleverer.
CREATE INDEX IF NOT EXISTS threads_cohort_idx ON threads (cohort, started_at DESC);

-- Backfill: rows written before `reply_to` existed can only be paired the old
-- way. Ambiguous cases are left null rather than guessed, so they drop out of
-- the view instead of pairing a question with someone else's answer.
UPDATE messages a SET reply_to = q.id
FROM   messages q
WHERE  a.reply_to IS NULL AND a.role = 'assistant' AND q.role = 'user'
  AND  q.thread_id = a.thread_id AND q.turn = a.turn
  AND  1 = (SELECT count(*) FROM messages x
            WHERE x.thread_id = a.thread_id AND x.turn = a.turn AND x.role = 'user');

-- The debugging view. One row per exchange, the screen beside the aim.
DROP VIEW IF EXISTS turns;
CREATE VIEW turns AS
SELECT t.id AS thread_id, t.lesson, t.cohort, t.visitor_id, q.turn,
       q.created_at,
       q.text  AS question,
       a.text  AS answer,
       q.step, q.state,
       a.point ->> 'id'   AS point_id,
       a.point ->> 'kind' AS point_kind,
       (a.point ->> 'home')::boolean AS point_home,
       a.chapters, a.provider, a.model, a.usage, a.ms, a.error
FROM   threads t
JOIN   messages q ON q.thread_id = t.id AND q.role = 'user'
LEFT   JOIN messages a ON a.reply_to = q.id
ORDER  BY q.created_at DESC;

-- =============================================================================
--  finds - one row per search on the question composer
-- =============================================================================
--  Two jobs, which is why it is one table. The RATE LIMIT counts these rows in
--  a window; the EDITORIAL QUEUE reads their text, because a question the map
--  could not answer is the only record of a door worth writing.
--
--  THE OUTCOME USED TO BE ABSENT ON PURPOSE. api/find.js returns a vector and
--  the PAGE ranks it, so the server never learned what a question resolved to;
--  the queue re-scored the texts offline instead, and one round trip per search
--  stayed one round trip.
--
--  That held while a find WAS the search. The bar now walks six tiers and only
--  the last two reach api/find.js at all — a reader who typed a card's NAME, or
--  restored a graft, or was offered a new question, embedded nothing, so those
--  arrivals were invisible here and they are most of them. Re-scoring cannot
--  recover a tier it was never part of. api/land.js beacons the landing after
--  the fact: no round trip in front of the reader, and it folds into the search's
--  own row where there is one, so a question is still one row.
--
--  Same privacy rule as the tutor: no IP, no user agent, no name. `visitor_id`
--  is a uuid the browser minted for itself and shares with the tutor, so
--  clearing site data clears both.
--  `kind` names WHICH endpoint wrote the row. Without it a search and a
--  generation are indistinguishable here, and one question that was searched
--  and then built reads as the same question asked twice.
CREATE TABLE IF NOT EXISTS finds (
  id          bigserial PRIMARY KEY,
  visitor_id  uuid,                        -- null: a browser that would not mint one
  cohort      text,                        -- the access link's label, or null when open
  q           text NOT NULL,               -- what was typed, capped at 400 chars upstream
  kind        text,                        -- 'find' | 'extend'; null on rows written before this column
  ms          int,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- CREATE TABLE IF NOT EXISTS does nothing to a table that already exists, so a
-- database made before `kind` needs this to get the column. Idempotent, and it
-- leaves the old rows null rather than guessing what they were.
ALTER TABLE finds ADD COLUMN IF NOT EXISTS kind text;

--  `answer` is what came back, and it exists ONLY on an `extend` row. The
--  reasoning above still holds for a search: the page does that ranking and
--  the server would have to be told. A generation is the other case — the
--  server WROTE the answer, so recording it costs nothing and is the only
--  record there is of what a reader was shown. It is also the expensive call:
--  without this you can see that somebody asked about hollow bones and never
--  what the map told them.
ALTER TABLE finds ADD COLUMN IF NOT EXISTS answer jsonb;

--  `kind` is 'find' | 'extend' | 'land'. A `land` row is an arrival that spent
--  no API call, so _finds.js excludes it from the rate limit — the cap rations
--  spend, and a landing is not spend.
--
--  `is_local` is whether the request came from the machine serving it, by
--  api/_local.js's definition. NOT an address, and not a contradiction of the
--  privacy rule above: a boolean says which side of the loopback a row came
--  from and nothing about who wrote it. Deployed, no real request is loopback,
--  so this is false for every reader and true for whoever is developing —
--  which is the whole point, because a session spent testing the bar otherwise
--  fills the editorial queue with questions no student ever asked. Null on
--  rows written before the column, meaning unknown rather than remote.
ALTER TABLE finds ADD COLUMN IF NOT EXISTS is_local boolean;

-- The limiter's only query is "how many since T", globally and per visitor.
CREATE INDEX IF NOT EXISTS finds_created_idx ON finds (created_at DESC);
CREATE INDEX IF NOT EXISTS finds_visitor_idx ON finds (visitor_id, created_at DESC);
