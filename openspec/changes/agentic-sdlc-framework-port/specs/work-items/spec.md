## MODIFIED Requirements

### Requirement: Work-item types and lifecycle
The system SHALL support **eight** work-item types — `epic`, `story`, `task`, `bug`, `requirement`, `roadmap-item`, `parallelization-stream`, `devlog-entry` — each with a status of `backlog`, `ready`, `in_progress`, `in_review`, `done`, or `cancelled`. Additional subtype-specific fields are defined per subtype (see `planning-artifacts` spec).

#### Scenario: Create a story in the backlog
- **WHEN** a human or agent creates a new work item with type `story` and no explicit status
- **THEN** the system SHALL persist it with status `backlog` and a generated UUID

#### Scenario: Move a task from ready to in_progress
- **WHEN** an agent claims a `ready` task by setting status to `in_progress` and assignee to itself
- **THEN** the system SHALL accept the transition and record the timestamp

#### Scenario: Reject an invalid status transition
- **WHEN** a client attempts to set status `done` on a work item currently in `backlog`
- **THEN** the system SHALL reject the request with a 400 error explaining the allowed next states

#### Scenario: Create a requirement subtype
- **WHEN** a user creates a work item with type `requirement`
- **THEN** the system SHALL require `acceptance_criteria`, `complexity`, and `value` fields before save (see `planning-artifacts/spec.md`)

#### Scenario: Devlog entries are append-only
- **WHEN** a user attempts to PATCH the body of a `devlog-entry`
- **THEN** the system SHALL reject the modification with a 400 error explaining devlog entries are append-only

## ADDED Requirements

### Requirement: capability_required per work item
The system SHALL allow each work item to declare an array `capability_required` listing the capabilities an assignee must have to claim the item. Claim requests SHALL fail if the claiming agent's persona does not include all required capabilities.

#### Scenario: Block claim by under-capable agent
- **WHEN** an agent whose persona lacks the `database-migration` capability attempts to claim a work item requiring it
- **THEN** the system SHALL reject the claim with a 403 error naming the missing capability

### Requirement: Done-checklist on work item
The system SHALL store a `done_checklist` array per work item (defaulted from project config at create time) with entries `{ gate: string, completed: bool, completed_at: timestamp? }`. The `in_review` → `done` transition SHALL require all entries to be `completed: true` unless an override is provided (see `quality-systems`).

#### Scenario: Default checklist applied on create
- **WHEN** a work item is created in a project whose `done_checklist` config lists three gates
- **THEN** the new work item SHALL have those three gates copied into its checklist with `completed: false`
