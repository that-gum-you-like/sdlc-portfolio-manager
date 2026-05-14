-- 0002_mentions_notifications: tables for mentions, notifications, and per-comment evidence linking

CREATE TABLE IF NOT EXISTS mentions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  source_type TEXT NOT NULL CHECK (source_type IN ('comment', 'question')),
  source_id TEXT NOT NULL,
  work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
  mentioned_handle TEXT NOT NULL,
  resolved_user_id TEXT,
  resolved_agent_name TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mentions_source ON mentions (source_type, source_id);
CREATE INDEX IF NOT EXISTS mentions_recipient ON mentions (resolved_user_id, resolved_agent_name);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mention', 'question', 'answer')),
  source_id TEXT NOT NULL,
  work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread ON notifications (recipient, read_at);

CREATE TABLE IF NOT EXISTS evidence_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  acceptance_criterion_id TEXT NOT NULL,
  criterion_text_snapshot TEXT,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_links_work_item ON evidence_links (work_item_id);
CREATE INDEX IF NOT EXISTS evidence_links_criterion ON evidence_links (work_item_id, acceptance_criterion_id);
