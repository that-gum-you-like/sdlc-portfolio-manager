-- 0004_automation_runs: record every execution of a Cursor Automation entry

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  automation_entry_id TEXT,
  automation_slug TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  summary TEXT,
  created_item_ids_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS automation_runs_status ON automation_runs (status);
CREATE INDEX IF NOT EXISTS automation_runs_project ON automation_runs (project_id, started_at);
