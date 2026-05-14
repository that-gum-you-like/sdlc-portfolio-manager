-- 0010_work_item_links: P5 — link work items to their external artifacts
-- (branches, commits, PRs/MRs, deployment URLs). Lets us answer
-- "was this work item actually shipped?" instead of trusting status alone.

CREATE TABLE IF NOT EXISTS work_item_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket', 'local-git', 'other')),
  kind TEXT NOT NULL CHECK (kind IN ('branch', 'commit', 'pr', 'mr', 'deploy', 'doc')),
  ref TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS work_item_links_item ON work_item_links (work_item_id);
CREATE INDEX IF NOT EXISTS work_item_links_url ON work_item_links (url);
