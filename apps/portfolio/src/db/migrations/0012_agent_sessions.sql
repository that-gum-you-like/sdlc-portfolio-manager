-- 0012_agent_sessions: P6 — track active agent sessions per work item with
-- heartbeats; crash detection on stale heartbeats so we can mark abandoned
-- work for human review or auto-recovery.

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  last_heartbeat_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'crashed', 'cancelled')),
  state_blob TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS agent_sessions_active ON agent_sessions (status, last_heartbeat_at);
CREATE INDEX IF NOT EXISTS agent_sessions_work_item ON agent_sessions (work_item_id, started_at);
