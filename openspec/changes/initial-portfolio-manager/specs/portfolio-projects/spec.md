## ADDED Requirements

### Requirement: Two-level hierarchy
The system SHALL model a two-level hierarchy: every `project` belongs to exactly one `portfolio`, and every work item belongs to exactly one `project`. A user MAY own multiple portfolios; a portfolio MAY contain zero or more projects.

#### Scenario: Create a portfolio with two projects
- **WHEN** a user creates a portfolio "Side projects" and then two projects "todo-app" and "habit-tracker" within it
- **THEN** the system SHALL persist `portfolios` with `id, name` and `projects` with `id, portfolio_id, name, slug`, and each project SHALL reference the portfolio via foreign key

#### Scenario: Work item belongs to a project
- **WHEN** a user or agent creates a work item without specifying `project_id`
- **THEN** the system SHALL reject the request with a 400 error requiring `project_id`

### Requirement: Project record schema
A project record SHALL contain at minimum: `id` (UUID), `portfolio_id` (FK), `name`, `slug` (URL-safe, unique within portfolio), `description`, `target_repo_path` (absolute or relative path on the user's machine, optional), `settings` (JSON: validation gates enabled, done-checklist gates, default routing, etc.), `created_at`, `updated_at`.

#### Scenario: Project slug uniqueness within portfolio
- **WHEN** a user attempts to create a second project with slug "todo-app" within a portfolio that already has a project with that slug
- **THEN** the system SHALL reject the request with a 409 conflict error

#### Scenario: Same slug allowed across portfolios
- **WHEN** a user has two portfolios and creates a project "todo-app" in each
- **THEN** both SHALL succeed because slug uniqueness is per-portfolio, not global

### Requirement: Portfolio detail view rolls up project state
The system SHALL provide a `/portfolios/<id>` route showing all projects in the portfolio with summary stats per project: open items count, items by status, % of items with passing validation, items currently in `needs-human`, recent activity.

#### Scenario: Portfolio shows project rollups
- **WHEN** a user opens `/portfolios/<id>` for a portfolio with three projects
- **THEN** the system SHALL render three project cards, each showing the summary stats listed above

### Requirement: Project detail view with own board / backlog / dashboard
The system SHALL provide a `/projects/<slug>` route that scopes the existing board, backlog, item-detail, and dashboard surfaces to that project's items only. The route SHALL also surface the project's settings (validation gates, done-checklist, target repo, published library entries).

#### Scenario: Open a project and see only its items
- **WHEN** a user opens `/projects/todo-app/board`
- **THEN** the system SHALL render the Kanban board filtered to items whose `project_id` matches `todo-app`

#### Scenario: Project settings editable in-app
- **WHEN** a user opens `/projects/todo-app/settings` and toggles the `security` validation gate to enabled
- **THEN** the system SHALL persist the change to the project's `settings` JSON and apply it to subsequent work items

### Requirement: Cross-portfolio top-level views remain available
The board, backlog, and inbox SHALL remain accessible at top-level routes (`/board`, `/backlog`, `/inbox`) showing items across all projects, while the project-scoped routes provide the focused subset.

#### Scenario: Top-level inbox shows mentions across all projects
- **WHEN** a user opens `/inbox` while they have open questions in two different projects
- **THEN** the system SHALL list both, with each item annotated with its portfolio + project breadcrumb

### Requirement: Breadcrumbs everywhere
Every work-item detail, board card, and list row SHALL render a breadcrumb of the form `Portfolio › Project › Item` (with each segment a link to its detail view).

#### Scenario: Click breadcrumb to navigate up
- **WHEN** a user clicks the project segment of a breadcrumb on a work-item detail page
- **THEN** the system SHALL navigate to that project's detail view

### Requirement: Default portfolio and project on first run
The system SHALL create a default portfolio (`personal`) and a default project (`inbox`) on first run so that single-user / no-setup interaction works immediately. Subsequent work items SHALL default to `project_id = inbox` if not specified explicitly.

#### Scenario: First-time user creates a work item without configuring anything
- **WHEN** a fresh-install user creates a work item via the UI without choosing a project
- **THEN** the system SHALL place the item in the `personal/inbox` portfolio/project

### Requirement: Project target_repo binds publish flow
The library publish flow SHALL accept a `project_id` and use that project's `target_repo_path` as the destination, removing the need to type the path each publish.

#### Scenario: Publish to a project's bound repo
- **WHEN** a user publishes a curated set of library entries selecting target project "todo-app" (whose `target_repo_path` is `/home/user/code/todo-app`)
- **THEN** the system SHALL write the entries into `/home/user/code/todo-app/.cursor/...` without re-prompting for path

### Requirement: API scoping by project_id
All work-item and library-entry list/read endpoints SHALL accept a `project_id` query parameter and scope results accordingly; absent `project_id` returns items across all projects the user has access to.

#### Scenario: List items in a specific project
- **WHEN** a client calls `GET /api/v1/work-items?project_id=<uuid>`
- **THEN** the response SHALL contain only items whose `project_id` matches
