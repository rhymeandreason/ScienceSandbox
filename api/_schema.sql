-- =============================================================================
--  api/_schema.sql - what the tutor writes down
-- =============================================================================
--  Applied by `npm run db:init`, which is idempotent. Neon Postgres.
--
--  No IP address, no user agent string, no name. A visitor is a random id the
--  browser minted for itself and can clear by clearing site data.
--
--  One row per message. The question's row carries the moment it was asked in
--  (`step`, `state`); the answer's row carries how it was produced (`point`,
--  `chapters`, `usage`). They share `turn`, and the `turns` view joins them,
--  because the aiming question is always "given THAT screen, why THAT target".
-- =============================================================================

CREATE TABLE IF NOT EXISTS threads (
  id          uuid PRIMARY KEY,
  visitor_id  uuid NOT NULL,               -- stable per browser, cleared with site data
  lesson      text,                        -- null: the plain ask box, no lesson around it
  started_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id          bigserial PRIMARY KEY,
  thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  turn        int  NOT NULL,               -- 1-based; the pair shares it
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

-- The debugging view. One row per exchange, the screen beside the aim.
CREATE OR REPLACE VIEW turns AS
SELECT t.id AS thread_id, t.lesson, t.visitor_id, q.turn,
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
LEFT   JOIN messages a ON a.thread_id = t.id AND a.turn = q.turn AND a.role = 'assistant'
ORDER  BY q.created_at DESC;
