-- 0013_guardrails: P4 — pre-action policy gate runs. Library gains a sixth
-- type 'guardrail'. The library_entries CHECK constraint update is handled
-- by re-creating the constraint (SQLite quirk: can't ALTER a CHECK in place).

-- Recreate library_entries with the expanded type enum.
PRAGMA foreign_keys = OFF;

CREATE TABLE library_entries_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rule', 'skill', 'automation', 'validator', 'doc', 'guardrail')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO library_entries_new
  (id, user_id, project_id, type, slug, name, description, file_path, frontmatter_json, created_at, updated_at)
SELECT id, user_id, project_id, type, slug, name, description, file_path, frontmatter_json, created_at, updated_at
FROM library_entries;

DROP TABLE library_entries;
ALTER TABLE library_entries_new RENAME TO library_entries;

PRAGMA foreign_keys = ON;

-- Same update for publish_history: allow 'guardrail' kind so we can publish
-- guardrails into target repos like other library entries.
PRAGMA foreign_keys = OFF;

CREATE TABLE publish_history_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('rule', 'skill', 'automation', 'validator', 'doc', 'guardrail')),
  entry_slug TEXT NOT NULL,
  target_repo_path TEXT NOT NULL,
  written_path TEXT NOT NULL,
  source_path TEXT NOT NULL,
  overwrote INTEGER NOT NULL DEFAULT 0,
  written_by TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO publish_history_new
  (id, user_id, project_id, entry_type, entry_slug, target_repo_path, written_path, source_path, overwrote, written_by, created_at)
SELECT id, user_id, project_id, entry_type, entry_slug, target_repo_path, written_path, source_path, overwrote, written_by, created_at
FROM publish_history;

DROP TABLE publish_history;
ALTER TABLE publish_history_new RENAME TO publish_history;

PRAGMA foreign_keys = ON;

-- Records every time a guardrail evaluated an action.
CREATE TABLE IF NOT EXISTS guardrail_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT REFERENCES work_items(id) ON DELETE CASCADE,
  guardrail_slug TEXT NOT NULL,
  action TEXT NOT NULL,
  agent_name TEXT,
  verdict TEXT NOT NULL CHECK (verdict IN ('allow', 'warn', 'block')),
  reason TEXT,
  evaluated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS guardrail_runs_agent ON guardrail_runs (agent_name, evaluated_at);
