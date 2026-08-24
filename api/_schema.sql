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
