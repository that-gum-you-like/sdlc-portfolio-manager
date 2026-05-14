## ADDED Requirements

### Requirement: Work item belongs to a project
Every work item SHALL have a `project_id` foreign key referencing a `projects` record. The work item inherits validation gates, done-checklist, default routing, and target-repo binding from its project.

#### Scenario: Create a work item with project_id
- **WHEN** a client creates a work item with `project_id` matching an existing project
- **THEN** the system SHALL persist the FK and apply the project's settings to the new item

#### Scenario: Reject missing project_id
- **WHEN** a client creates a work item without `project_id` and the user has more than one project
- **THEN** the system SHALL reject the request with a 400 error indicating `project_id` is required; if the user has only the default `personal/inbox` project, the system SHALL default to it

### Requirement: Work-item types and lifecycle
The system SHALL support four work-item types — `epic`, `story`, `task`, `bug` — each with a status of `backlog`, `ready`, `in_progress`, `needs-human`, `in_review`, `done`, or `cancelled`. The `needs-human` status indicates work is paused awaiting human input on one or more open questions (see `hitl` capability).

#### Scenario: Create a story in the backlog
- **WHEN** a human or agent creates a new work item with type `story` and no explicit status
- **THEN** the system SHALL persist it with status `backlog` and a generated UUID

#### Scenario: Move a task from ready to in_progress
- **WHEN** an agent claims a `ready` task by setting status to `in_progress` and assignee to itself
- **THEN** the system SHALL accept the transition and record the timestamp

#### Scenario: Reject an invalid status transition
- **WHEN** a client attempts to set status `done` on a work item currently in `backlog`
- **THEN** the system SHALL reject the request with a 400 error explaining the allowed next states

#### Scenario: needs-human is a valid transition from in_progress
- **WHEN** an in_progress work item has a question filed against it
- **THEN** the system SHALL transition status to `needs-human` and store `previous_status: in_progress` for restoration when all questions resolve

### Requirement: Parent/child links
The system SHALL allow any work item to declare a parent work item, forming a tree (epic → stories → tasks/bugs).

#### Scenario: Attach a task to a parent story
- **WHEN** a client creates a task with `parent_id` set to an existing story's UUID
- **THEN** the system SHALL persist the relationship and surface the child under the parent in item-detail views

#### Scenario: Prevent self-parenting and cycles
- **WHEN** a client attempts to set a work item's parent to itself or to one of its descendants
- **THEN** the system SHALL reject the request with a 400 error

### Requirement: Assignee may be human or agent
The system SHALL record an assignee on each work item, identified by a string that may reference either a human user id or an agent name (e.g., `cursor-background-agent`).

#### Scenario: Agent self-assigns when claiming work
- **WHEN** an agent calls the claim endpoint identifying itself as `cursor-background-agent`
- **THEN** the system SHALL set `assignee` to `cursor-background-agent` and `status` to `in_progress` atomically

### Requirement: Comments
The system SHALL allow humans and agents to append comments (markdown text) to a work item, ordered chronologically.

#### Scenario: Agent posts progress comment
- **WHEN** an agent POSTs a comment to a work item
- **THEN** the system SHALL persist it with author = agent name, timestamp, and the markdown body

### Requirement: Labels
The system SHALL allow zero or more string labels per work item for ad-hoc tagging (e.g., `frontend`, `urgent`, `tech-debt`).

#### Scenario: Add and filter by label
- **WHEN** a client lists work items filtered by label `frontend`
- **THEN** the system SHALL return only items whose label set contains `frontend`

### Requirement: source_discovery_id link
The system SHALL allow a work item to record `source_discovery_id` referencing the `discoveries` row whose accepted draft produced it. This FK is nullable (work items created directly without going through discovery have null).

#### Scenario: Accepted draft produces a linked work item
- **WHEN** a user accepts a draft from discovery D-123
- **THEN** the resulting work item's `source_discovery_id` SHALL equal `D-123`

#### Scenario: Manual work item has no source discovery
- **WHEN** a user creates a work item directly from the board
- **THEN** the resulting work item's `source_discovery_id` SHALL be null

### Requirement: Acceptance criteria
The system SHALL allow a work item to carry an ordered array of acceptance criteria, each with a stable id (e.g., `AC-1`, `AC-2`), a text body, and an optional `evidence_refs` array linking to test names or evidence comments. Acceptance criteria are required for type `requirement` and optional for other types.

#### Scenario: Requirement requires at least one criterion
- **WHEN** a client creates a `requirement`-type work item with an empty `acceptance_criteria` array
- **THEN** the system SHALL reject with a 400 error requiring at least one criterion

#### Scenario: Criteria visible on item detail
- **WHEN** a user opens an item with three acceptance criteria
- **THEN** the system SHALL render them as a numbered checklist with each criterion's evidence status (matched / unmatched) populated from the acceptance-pipeline validator
