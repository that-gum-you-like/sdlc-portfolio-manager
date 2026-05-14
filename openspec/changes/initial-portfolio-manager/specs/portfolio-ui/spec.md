## ADDED Requirements

### Requirement: Kanban board view
The system SHALL render a Kanban board with one column per work-item status (`backlog`, `ready`, `in_progress`, `in_review`, `done`), showing work items as cards.

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
