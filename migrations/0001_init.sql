-- One row per player per question. The unique key makes a guess final:
-- re-submitting returns the stored result instead of a new score.
CREATE TABLE IF NOT EXISTS guesses (
  issue      INTEGER NOT NULL,
  q_index    INTEGER NOT NULL CHECK (q_index BETWEEN 0 AND 2),
  question   TEXT    NOT NULL,          -- bank ID, e.g. IQ045
  player     TEXT    NOT NULL,          -- random per-device id, not personal data
  guess      REAL    NOT NULL,
  score      INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (issue, q_index, player)
);
CREATE INDEX IF NOT EXISTS guesses_by_question ON guesses (issue, q_index);
