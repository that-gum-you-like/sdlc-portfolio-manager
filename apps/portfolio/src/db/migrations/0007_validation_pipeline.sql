-- 0007_validation_pipeline: validation_runs + overrides for the done gate

CREATE TABLE IF NOT EXISTS validation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  gate TEXT NOT NULL CHECK (gate IN ('quality', 'security', 'bugs', 'user-story-acceptance')),
  validator_slug TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'pass', 'fail', 'error', 'skipped')),
  exit_code INTEGER,
  stdout_snippet TEXT,
  stderr_snippet TEXT,
  findings_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS validation_runs_item_gate ON validation_runs (work_item_id, gate, started_at);

CREATE TABLE IF NOT EXISTS overrides (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  failing_gates_json TEXT NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS overrides_work_item ON overrides (work_item_id, submitted_at);
