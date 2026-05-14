## ADDED Requirements

### Requirement: Requirement work-item subtype
The system SHALL support work-item type `requirement` with REQ-xxx ids, acceptance criteria, complexity score, and value score.

#### Scenario: Create a requirement
- **WHEN** a user creates a work item with type `requirement`, title "User can export data", and three acceptance-criteria lines
- **THEN** the system SHALL persist it with a generated `REQ-<n>` id, store acceptance criteria as a structured array, and require `complexity` (1-13) and `value` (1-5) before save

#### Scenario: Requirements show priority matrix
- **WHEN** a user opens the requirements view
- **THEN** the system SHALL render a 2D chart of `value` vs `complexity` with each requirement plotted, and a sortable list view alongside

### Requirement: Roadmap-item subtype
The system SHALL support work-item type `roadmap-item` representing a phase or epic-level deliverable with a target window (`target_start`, `target_end`), status (`planned`, `active`, `completed`, `archived`), and child requirements.

#### Scenario: Roadmap shows active phase
- **WHEN** a user opens the roadmap view
- **THEN** the system SHALL render roadmap items grouped by status with timeline bars for `active` items showing target window

### Requirement: Parallelization-stream subtype
The system SHALL support work-item type `parallelization-stream` representing a parallel work stream with declared interface contracts and dependency on other streams.

#### Scenario: Create a stream with dependencies
- **WHEN** a user creates a parallelization-stream with `depends_on: [stream-a-uuid]` and `interface_contract` filled in
- **THEN** the system SHALL persist the dependency and surface a stream-graph view showing the DAG

### Requirement: Devlog-entry subtype
The system SHALL support append-only work-item type `devlog-entry` representing a progress journal entry (timestamp, agent author, task ref, free-form notes).

#### Scenario: Agent appends a devlog entry
- **WHEN** an agent runs `pc devlog "Implemented user export endpoint; tests passing"`
- **THEN** the CLI SHALL POST a new `devlog-entry` work item linked to the current task, with author = agent name

### Requirement: Planning artifacts use the same comments / labels / parent model
All planning-artifact subtypes SHALL inherit the work-item base behaviors (comments, labels, parent/child links, status) — adding subtype-specific fields only where needed.

#### Scenario: Comment on a requirement
- **WHEN** a user adds a comment to a requirement
- **THEN** the system SHALL accept the comment via the existing comments API

### Requirement: Export planning artifacts as markdown
The system SHALL provide an "Export to markdown" action per planning artifact that produces a markdown file in the format `agentic-sdlc` uses (requirements.md, roadmap.md, etc.) for compatibility.

#### Scenario: Export roadmap to markdown
- **WHEN** a user clicks "Export to markdown" on the roadmap view
- **THEN** the system SHALL produce a `roadmap.md` text matching the structure used in `~/agentic-sdlc/plans/roadmap.md` and offer it as a download
