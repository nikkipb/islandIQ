-- Switch from 0-100 points to fermi-style multipliers (how many times off).
-- Only test data existed, so the table is rebuilt rather than migrated.
DROP TABLE IF EXISTS guesses;
CREATE TABLE guesses (issue INTEGER NOT NULL, q_index INTEGER NOT NULL CHECK (q_index BETWEEN 0 AND 2), question TEXT NOT NULL, player TEXT NOT NULL, guess REAL NOT NULL, factor REAL NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (issue, q_index, player));
CREATE INDEX IF NOT EXISTS guesses_by_question ON guesses (issue, q_index);
