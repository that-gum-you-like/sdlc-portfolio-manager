## ADDED Requirements

### Requirement: SQLite as the durable store
The system SHALL persist all work items, comments, labels, library entries, and publish-history records in a single SQLite database file stored under a per-user data directory (e.g., `~/.sdlc-portfolio/data.sqlite`).

#### Scenario: Data survives restart
- **WHEN** the user creates a work item, stops the server, and restarts it
- **THEN** the work item SHALL still be present and unchanged on the next API call

### Requirement: Migrations are versioned and forward-only
The system SHALL run forward-only migrations on startup, tracked in a `_migrations` table, applying any not-yet-applied migrations in order.

#### Scenario: First-run creates schema
- **WHEN** the server starts against an empty data directory
- **THEN** the system SHALL create the database file, apply all migrations, and record each in `_migrations`

#### Scenario: Subsequent runs apply only new migrations
- **WHEN** the server starts against a database that has applied migrations 0001 and 0002, and migration 0003 exists
- **THEN** the system SHALL apply only 0003 and leave existing data intact

### Requirement: Identity model is multi-user-ready
The system SHALL include a `user_id` column on every user-owned row (work items, comments, library entries, publish records) and resolve the current user via a single auth function that, in single-user mode, returns a constant `local-user` identity.

#### Scenario: All rows carry user_id at insert time
- **WHEN** any row is inserted in single-user mode
- **THEN** the row's `user_id` SHALL equal `local-user`

#### Scenario: Swap-in auth requires no schema change
- **WHEN** the auth function is replaced to return a real authenticated user id
- **THEN** new inserts SHALL record the real user id with no migration required

### Requirement: UUIDs for all primary keys
The system SHALL use UUIDv4 strings (not autoincrement integers) for all primary keys to enable safe future merging across multi-user instances.

#### Scenario: Generated IDs are UUIDv4
- **WHEN** a new work item is created
- **THEN** its `id` SHALL match the UUIDv4 regex pattern

### Requirement: API scopes queries by user_id
The system SHALL scope all list/read API queries by the current user's `user_id`.

#### Scenario: Default single-user list returns only local-user rows
- **WHEN** any list endpoint is called in single-user mode
- **THEN** the query SHALL include `WHERE user_id = 'local-user'`

### Requirement: Project-scoped foreign keys
Every user-owned table holding domain rows (work items, comments, questions, library entries, publish history, validation runs, automation runs) SHALL include a `project_id` foreign key (nullable only for library entries, which may be cross-project). Cascading deletes from a project SHALL remove dependent rows.

#### Scenario: Cascade delete on project removal
- **WHEN** a user deletes a project containing 50 work items and their comments
- **THEN** the system SHALL remove the project, all 50 work items, and all dependent comments / questions / validation runs / automation runs in a single transaction

#### Scenario: Library entries can be cross-project
- **WHEN** a library entry is created without specifying `project_id`
- **THEN** the system SHALL persist it as cross-project (NULL), making it visible from every project's library view
