## ADDED Requirements

### Requirement: REST API for work items
The system SHALL expose a REST API rooted at `/api/v1` providing CRUD on work items, comments, and labels, accepting and returning JSON.

#### Scenario: List ready tasks via API
- **WHEN** a client GETs `/api/v1/work-items?status=ready&type=task`
- **THEN** the system SHALL respond with a JSON array of matching work items including `id`, `type`, `title`, `status`, `assignee`, `parent_id`, `labels`, `created_at`, `updated_at`

#### Scenario: Claim a task atomically via API
- **WHEN** a client POSTs to `/api/v1/work-items/<id>/claim` with `{ "agent": "cursor-background-agent" }`
- **THEN** the system SHALL set status to `in_progress` and assignee to the agent atomically, returning the updated item; if the item is not in `ready`, the system SHALL respond 409

### Requirement: `pc` CLI for agent invocation
The system SHALL ship a `pc` CLI in `packages/cli/` providing at minimum: `pc next` (claim next ready task), `pc done <id>` (mark in_review), `pc comment <id> <message>`, `pc file <type> <title>` (create a work item), `pc ask <id> <message>` (file a question to a human, see `hitl` capability), `pc check-answer <question-id>` (poll for an answer).

#### Scenario: Agent picks up next task via CLI
- **WHEN** a Cursor agent runs `pc next --agent cursor-background-agent`
- **THEN** the CLI SHALL call the claim API, print the claimed item's id/title/description to stdout in a stable, parseable format, and exit 0; if no `ready` task exists, exit code 2

#### Scenario: Agent files a new bug from the CLI
- **WHEN** an agent runs `pc file bug "Login form rejects valid email"` with a description piped on stdin
- **THEN** the CLI SHALL POST the new bug to the API and print the created item's id to stdout

### Requirement: Cursor rules template wires Background Agents into the protocol
The system SHALL ship a `cursor-templates/rules/` directory containing `.mdc` rules that teach a Cursor agent the protocol: read assigned task, implement, write tests, file new bugs as work items, mark in_review when done.

#### Scenario: Target repo receives the protocol rules
- **WHEN** a user publishes the "agent-protocol" rules from the library to a target repo
- **THEN** the target repo's `.cursor/rules/` directory SHALL contain rules that, when read by a Cursor Background Agent, cause it to call `pc next`, work the task, and call `pc done <id>`

### Requirement: Stable error contract
The system SHALL return JSON error responses with `{ "error": <code>, "message": <human-readable>, "details": <optional> }` and HTTP status codes consistent with REST conventions (400/404/409/500).

#### Scenario: Invalid status transition returns 400 with code
- **WHEN** a client requests an invalid status transition
- **THEN** the response SHALL be HTTP 400 with body `{ "error": "invalid_transition", "message": "...", "details": { "from": "...", "to": "...", "allowed": [...] } }`
