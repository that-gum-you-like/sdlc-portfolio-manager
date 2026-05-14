-- 0003_questions: HITL question/answer thread

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  asked_by TEXT NOT NULL,
  addressed_to TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'cancelled')),
  previous_status TEXT NOT NULL,
  asked_at TEXT NOT NULL,
  answered_at TEXT,
  answer_id TEXT REFERENCES comments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS questions_work_item ON questions (work_item_id, status);
CREATE INDEX IF NOT EXISTS questions_addressed_to ON questions (addressed_to, status);
