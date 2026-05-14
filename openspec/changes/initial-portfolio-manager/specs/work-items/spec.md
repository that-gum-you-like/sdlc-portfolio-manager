## ADDED Requirements

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
