-- 0011_handoffs: P2 — explicit agent→agent delegation records

CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  reason TEXT NOT NULL,
  context_blob TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT CHECK (resolution IN ('accepted', 'declined', 'reassigned', 'completed'))
);

CREATE INDEX IF NOT EXISTS handoffs_work_item ON handoffs (work_item_id, created_at);
CREATE INDEX IF NOT EXISTS handoffs_to_agent ON handoffs (to_agent, resolved_at);
