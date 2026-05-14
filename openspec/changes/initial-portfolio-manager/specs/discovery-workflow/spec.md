## ADDED Requirements

### Requirement: Discovery entity
The system SHALL persist `discoveries` with columns: `id` (UUID), `project_id` (FK), `user_id`, `raw_dump` (text, may be very long), `source` (enum: `text` | `voice-transcript` | `meeting-notes` | `email`), `status` (enum: `draft` | `generating` | `reviewing` | `accepted` | `archived`), `created_at`, `updated_at`, `accepted_at` (nullable).

#### Scenario: Create a discovery from a braindump
- **WHEN** a user POSTs `/api/v1/discoveries` with `{ project_id, raw_dump: "I want users to be able to export their data...", source: "text" }`
- **THEN** the system SHALL persist a discovery with `status: draft` and return its id

#### Scenario: Voice transcript as source
- **WHEN** a user pastes a Cursor dictation transcript into the discovery intake form and submits
- **THEN** the system SHALL persist the discovery with `source: voice-transcript` (no transcription performed in-app — Cursor handles dictation upstream)

### Requirement: Draft generation invokes a planning persona
The system SHALL provide `POST /api/v1/discoveries/:id/generate` accepting `{ generator: "bill-crouse" | "judy" | "barbara" | "april" | "default" }` that produces draft artifacts by calling the named planning persona (or a default pipeline that runs all four in sequence).

#### Scenario: Generate via Bill Crouse (requirements)
- **WHEN** a user triggers generation on a discovery with `generator: "bill-crouse"`
- **THEN** the system SHALL invoke a Cursor automation (or seeded generation prompt) using the `bill-crouse` persona prompt to transform `raw_dump` into REQ-xxx requirement drafts with acceptance criteria

#### Scenario: Default pipeline runs all four planning personas
- **WHEN** a user triggers generation with `generator: "default"`
- **THEN** the system SHALL run, in order: Bill Crouse (requirements), Judy (value/complexity scoring on those requirements), Barbara (packages requirements into user stories with parent epic), April (parallelization analysis producing dependency drafts); each persona's output SHALL feed the next

#### Scenario: Generation is async
- **WHEN** generation is triggered
- **THEN** the system SHALL set `status: generating` immediately, return the discovery id, and produce drafts asynchronously; the UI SHALL poll or stream for updates

### Requirement: Draft artifact model
The system SHALL persist drafts in `discovery_drafts` with columns: `id` (UUID), `discovery_id` (FK), `draft_type` (enum: `epic` | `story` | `requirement` | `task` | `bug` | `parallelization-stream`), `draft_data` (JSON: type-specific fields including title, description, acceptance_criteria, value, complexity, suggested_assignee), `parent_draft_id` (nullable FK to another draft in the same discovery), `relationship_drafts` (JSON array of `{ target_draft_id, type }` for inter-draft links), `status` (enum: `pending` | `accepted` | `rejected` | `edited`), `resulting_work_item_id` (nullable FK, set on accept), `generated_by` (string: persona name or `manual`), `created_at`, `updated_at`.

#### Scenario: Story draft has acceptance criteria
- **WHEN** Barbara generates a story draft from a Bill-Crouse requirement
- **THEN** the draft's `draft_data.acceptance_criteria` SHALL be a non-empty array of `{ id: "AC-1", text: "..." }` entries

#### Scenario: Drafts can reference each other before acceptance
- **WHEN** Bill Crouse generates REQ-1, REQ-2, REQ-3 and April generates a parallelization stream that depends on REQ-1
- **THEN** the parallelization draft's `relationship_drafts` SHALL include `{ target_draft_id: "<REQ-1 draft id>", type: "depends_on" }`

### Requirement: Review UI
The system SHALL provide `/discoveries/:id` displaying the raw dump alongside the generated drafts, grouped by `draft_type` (Epics, Stories, Requirements, Tasks, Streams). Each draft SHALL be inline-editable, with explicit Accept and Reject actions.

#### Scenario: User edits a draft inline before accepting
- **WHEN** a user edits a story draft's acceptance criteria and clicks Accept
- **THEN** the system SHALL persist the edits to `draft_data`, mark the draft `status: accepted`, create a real work item with those fields, set `resulting_work_item_id`, and re-render the row as accepted with a link to the new work item

#### Scenario: User rejects a draft
- **WHEN** a user clicks Reject on a draft
- **THEN** the system SHALL mark it `status: rejected` and hide it from the active drafts list (still queryable via "Show rejected")

### Requirement: Accept creates real work item and persists inter-draft relationships
When a user accepts a draft, the system SHALL create a real work item populated from `draft_data` (linked to the discovery via `source_discovery_id`). When any related draft is also accepted, the system SHALL create corresponding `relationships` rows reflecting the `relationship_drafts` and `parent_draft_id` graph.

#### Scenario: Parent epic accepted before children
- **WHEN** a user accepts an epic draft, then accepts three story drafts whose `parent_draft_id` references the epic
- **THEN** the system SHALL create the epic work item first, then create each story with its `parent_id` FK set to the epic; the relationships table SHALL NOT contain duplicate `parent_of` rows for these (canonical containment per `relationships` spec)

#### Scenario: Cross-draft blocks relationship realized on accept
- **WHEN** two drafts have a `relationship_drafts` entry of type `blocks` between them, and both are accepted
- **THEN** the system SHALL create a `relationships` row of type `blocks` between the resulting work items

#### Scenario: Accept one side of a relationship — pending until both
- **WHEN** only one of two drafts in a `blocks` pair is accepted
- **THEN** the system SHALL NOT yet create a relationships row; when the second is accepted later, the row SHALL be created at that point

### Requirement: Iterative regeneration and append
The system SHALL allow the user to append additional text to a discovery's `raw_dump` and to trigger regeneration; existing accepted drafts SHALL be preserved, pending drafts MAY be replaced, and rejected drafts SHALL remain rejected.

#### Scenario: Append and regenerate
- **WHEN** a user appends "Also, we need email digest support" to a discovery's `raw_dump` and clicks Regenerate
- **THEN** the system SHALL produce new drafts addressing both the original and appended content, marking superseded pending drafts as `rejected` with a system-generated reason "superseded by regeneration"

### Requirement: HITL during generation
If a planning persona encounters ambiguity, it SHALL invoke the HITL question mechanism (`POST /api/v1/work-items/:source_id/questions`) against the discovery (treating the discovery id as a work-item-like target with type `discovery`), pausing generation until the question is answered.

#### Scenario: Bill Crouse asks a clarifying question
- **WHEN** Bill Crouse's generation pass encounters an unclear requirement and POSTs a question against the discovery
- **THEN** the system SHALL set the discovery `status: reviewing`, surface the question in the user's `/inbox`, and resume generation upon answer

### Requirement: Discovery CLI
The `pc` CLI SHALL provide `pc discovery new --project <slug>` (opens an editor for the dump or reads from stdin), `pc discovery generate <discovery-id> --persona <name>`, `pc discovery list --project <slug>`, `pc discovery show <discovery-id>`.

#### Scenario: Pipe transcript from clipboard
- **WHEN** a user runs `pbpaste | pc discovery new --project todo-app --source voice-transcript`
- **THEN** the CLI SHALL create a discovery with the piped text as `raw_dump` and `source: voice-transcript`, then print the new id

### Requirement: Discovery dashboard surface
The portfolio-manager dashboard SHALL include a "Recent discoveries" section showing the five most recent discoveries with their status, draft counts (pending / accepted / rejected), and quick-jump links.

#### Scenario: Dashboard shows a discovery mid-review
- **WHEN** the dashboard is loaded and there is a discovery in `reviewing` status with 7 pending drafts and 2 accepted
- **THEN** the Recent Discoveries section SHALL render that discovery with status badge, "7 pending / 2 accepted" counts, and a link to its detail view

### Requirement: Seed discovery automation
The system SHALL seed an automation entry `discovery-default-pipeline` in `cursor-templates/automations/` that codifies the Bill → Judy → Barbara → April default pipeline so users can publish it into a target repo for use without manual configuration.

#### Scenario: Publish discovery pipeline to a project
- **WHEN** a user publishes `discovery-default-pipeline` to a project
- **THEN** the project's target repo SHALL receive the automation definition under the Cursor-Automations on-disk format, and triggering a discovery via the UI SHALL execute through that pipeline
