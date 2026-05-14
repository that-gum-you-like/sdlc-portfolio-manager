-- 0006_publish_history: track every library publish into a target repo

CREATE TABLE IF NOT EXISTS publish_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('rule', 'skill', 'automation', 'validator', 'doc')),
  entry_slug TEXT NOT NULL,
  target_repo_path TEXT NOT NULL,
  written_path TEXT NOT NULL,
  source_path TEXT NOT NULL,
  overwrote INTEGER NOT NULL DEFAULT 0,
  written_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS publish_history_entry ON publish_history (entry_type, entry_slug, created_at);
CREATE INDEX IF NOT EXISTS publish_history_repo ON publish_history (target_repo_path, created_at);
