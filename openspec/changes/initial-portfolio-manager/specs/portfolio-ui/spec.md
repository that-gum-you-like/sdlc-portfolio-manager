## ADDED Requirements

### Requirement: Kanban board view
The system SHALL render a Kanban board with one column per work-item status (`backlog`, `ready`, `in_progress`, `needs-human`, `in_review`, `done`), showing work items as cards. The `needs-human` column SHALL visually distinguish cards (e.g., colored border or icon) and show the count of open questions on each.

#### Scenario: Board reflects current state
- **WHEN** a user opens the board view
- **THEN** the system SHALL fetch all non-`cancelled` work items and render each in the column matching its current status

#### Scenario: Drag-and-drop changes status
- **WHEN** a user drags a card from `ready` to `in_progress`
- **THEN** the system SHALL PATCH the work item's status and re-render optimistically; if the API rejects the transition, the card SHALL snap back and an error toast SHALL appear

### Requirement: Backlog view
The system SHALL render an ordered list view of work items with status `backlog` or `ready`, supporting manual ordering by the user.

#### Scenario: Reorder items in backlog
- **WHEN** a user drags item B above item A in the backlog list
- **THEN** the system SHALL persist a new `rank` for B such that subsequent loads preserve B-before-A ordering

### Requirement: Item detail page
The system SHALL provide a per-item detail page showing the item's fields, parent link, children list, comments thread, and edit controls.

#### Scenario: View an item and post a comment
- **WHEN** a user opens `/items/<uuid>` and submits a comment in the comments form
- **THEN** the system SHALL persist the comment and append it to the visible thread without a full-page reload

### Requirement: Create work item
The system SHALL provide a "New item" UI accessible from board and backlog views that captures type, title, description (markdown), parent (optional), labels, and assignee.

#### Scenario: Create a bug from the board
- **WHEN** a user clicks "New item" on the board, selects type `bug`, enters title and description, and submits
- **THEN** the system SHALL POST to the work-items API and append the new card to the `backlog` column on success

### Requirement: Basic filtering
The system SHALL allow filtering the board and backlog by label, assignee, and item type.

#### Scenario: Filter by assignee = cursor-background-agent
- **WHEN** a user selects "assignee: cursor-background-agent" in the filter bar
- **THEN** the system SHALL re-render the board to show only items assigned to that agent

### Requirement: Portfolio + project navigation surfaces
The system SHALL render a top-level navigation showing the active portfolio + project context and a switcher to change either. The board, backlog, and dashboard SHALL be available both at top-level (across all projects) and scoped per project (`/projects/<slug>/board`, etc.).

#### Scenario: Switch project from the nav
- **WHEN** a user opens the project switcher and selects "habit-tracker"
- **THEN** the system SHALL navigate to `/projects/habit-tracker/board` and persist the active-project preference

#### Scenario: Portfolio rollup view
- **WHEN** a user opens `/portfolios/<id>`
- **THEN** the system SHALL render a card per project with summary stats (open count, in_progress count, needs-human count, validation pass rate %)

### Requirement: Validation pipeline UI
The system SHALL render validation gate results on the work-item detail page: a "Validation" panel listing each enabled gate with its current status (pass / fail / running / skipped / error), last-run timestamp, "Run again" action, and (on click) full output / findings.

#### Scenario: View failing gate detail
- **WHEN** a user clicks the failed `security` gate row on an item detail page
- **THEN** the system SHALL expand to show stdout snippet, stderr snippet, findings JSON, and exit code from the most recent run

### Requirement: Board cards show validation indicator
Each board card SHALL include a compact gate-status indicator (e.g., four dots colored pass=green, fail=red, running=yellow, skipped=gray) so the validation state is visible without opening the item.

#### Scenario: Validation indicator on board
- **WHEN** a user views the board with an item whose four gates resolved to pass, pass, fail, skipped
- **THEN** the card SHALL render four dots in green, green, red, gray with a tooltip naming each gate

### Requirement: Item detail page renders questions thread
The item detail page SHALL render any open and recently-answered questions as a distinct thread above (or visually separated from) the general comments — open questions prominent with an inline answer form, answered questions collapsible.

#### Scenario: Open item with two open questions
- **WHEN** a user opens an item with two open questions and four comments
- **THEN** the system SHALL render the two questions in a "Pending questions" section at the top with answer forms, and the four comments in the standard comments thread below

### Requirement: Mentions render as interactive links
The system SHALL render `@<name>` mentions in comment and question bodies as clickable links to the mentioned user's or agent's detail page, and SHALL visually distinguish them from plain text.

#### Scenario: Click an @-mention
- **WHEN** a user clicks an `@frontend-developer` mention in a rendered comment
- **THEN** the system SHALL navigate to `/agents/frontend-developer` (or `/users/<id>` for human mentions)
