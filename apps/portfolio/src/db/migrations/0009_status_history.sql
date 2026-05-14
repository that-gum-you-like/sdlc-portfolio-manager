-- 0009_status_history: record every work-item status transition so the
-- trajectory timeline (P1) can show the full lifecycle, not just the current
-- state + previous_status. Also gives us future analytics (lead time,
-- time-in-status, throughput) without retrofitting.

CREATE TABLE IF NOT EXISTS work_item_status_changes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  override_id TEXT REFERENCES overrides(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS work_item_status_changes_item ON work_item_status_changes (work_item_id, changed_at);
