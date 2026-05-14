-- 0001_initial: portfolios, projects, library_entries, work_items, comments, relationships

CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  target_repo_path TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_portfolio_slug_unique
  ON projects (portfolio_id, slug);

CREATE TABLE IF NOT EXISTS library_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rule', 'skill', 'automation', 'validator', 'doc')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  frontmatter_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT,
  type TEXT NOT NULL CHECK (type IN (
    'epic', 'story', 'task', 'bug',
    'requirement', 'roadmap-item', 'parallelization-stream', 'devlog-entry'
  )),
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN (
    'backlog', 'ready', 'in_progress', 'needs-human', 'in_review', 'done', 'cancelled'
  )),
  previous_status TEXT,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  rank INTEGER NOT NULL DEFAULT 0,
  labels TEXT NOT NULL DEFAULT '[]',
  acceptance_criteria TEXT NOT NULL DEFAULT '[]',
  subtype_data TEXT NOT NULL DEFAULT '{}',
  source_discovery_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS work_items_project_status
  ON work_items (project_id, status);

CREATE INDEX IF NOT EXISTS work_items_parent
  ON work_items (parent_id);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'evidence')),
  criterion_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS comments_work_item ON comments (work_item_id);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  source_type TEXT NOT NULL CHECK (source_type IN ('portfolio', 'project', 'work_item')),
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('portfolio', 'project', 'work_item')),
  target_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'parent_of', 'blocks', 'depends_on', 'duplicates', 'related_to', 'predecessor_of'
  )),
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  CHECK (NOT (source_type = target_type AND source_id = target_id))
);

CREATE UNIQUE INDEX IF NOT EXISTS relationships_edge_unique
  ON relationships (source_type, source_id, target_type, target_id, type);

CREATE INDEX IF NOT EXISTS relationships_source
  ON relationships (source_type, source_id);

CREATE INDEX IF NOT EXISTS relationships_target
  ON relationships (target_type, target_id);
