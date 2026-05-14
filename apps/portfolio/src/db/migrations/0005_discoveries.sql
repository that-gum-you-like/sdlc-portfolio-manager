-- 0005_discoveries: discovery workflow — raw_dump + draft artifacts

CREATE TABLE IF NOT EXISTS discoveries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  raw_dump TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'text' CHECK (source IN ('text', 'voice-transcript', 'meeting-notes', 'email')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'reviewing', 'accepted', 'archived')),
  generation_requested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  accepted_at TEXT
);

CREATE INDEX IF NOT EXISTS discoveries_project_status ON discoveries (project_id, status);
CREATE INDEX IF NOT EXISTS discoveries_generation_queue ON discoveries (status, generation_requested);

CREATE TABLE IF NOT EXISTS discovery_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  discovery_id TEXT NOT NULL REFERENCES discoveries(id) ON DELETE CASCADE,
  draft_type TEXT NOT NULL CHECK (draft_type IN (
    'epic', 'story', 'task', 'bug',
    'requirement', 'roadmap-item', 'parallelization-stream', 'devlog-entry'
  )),
  draft_data TEXT NOT NULL DEFAULT '{}',
  parent_draft_id TEXT,
  relationship_drafts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'edited')),
  resulting_work_item_id TEXT REFERENCES work_items(id) ON DELETE SET NULL,
  generated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS discovery_drafts_discovery ON discovery_drafts (discovery_id, status);

-- Add source_discovery_id FK to existing work_items table for back-references.
-- SQLite doesn't allow ALTER TABLE ADD COLUMN with REFERENCES + ON DELETE clauses,
-- so we add a plain column; the FK is enforced by app code (and a migration-time
-- check that the referenced discovery exists).
ALTER TABLE work_items ADD COLUMN source_discovery_id_real TEXT REFERENCES discoveries(id) ON DELETE SET NULL;

-- Backfill any pre-existing source_discovery_id values into the new column
UPDATE work_items SET source_discovery_id_real = source_discovery_id WHERE source_discovery_id IS NOT NULL;
