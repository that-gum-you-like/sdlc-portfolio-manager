## ADDED Requirements

### Requirement: Five-layer memory model
Each agent SHALL have five distinct memory layers, each a JSON file in the target repo at `.cursor/memory/<agent-name>/`:
- `core.json` — permanent identity, values, failure memories, evolved operating rules
- `long-term.json` — patterns learned, corrections received, architectural decisions
- `medium-term.json` — current sprint context, in-progress notes
- `recent.json` — what happened this session (last 5 tasks, observations)
- `compost.json` — failed ideas, deprecated approaches, anti-patterns to avoid

#### Scenario: New agent assignment creates memory dir
- **WHEN** an agent persona is first published into a target repo
- **THEN** the system SHALL create `.cursor/memory/<agent>/` with all five files, each initialized as `{ "entries": [] }`

### Requirement: Memory CLI commands
The `pc` CLI SHALL provide `pc memory read <layer>`, `pc memory write <layer> <json>`, and `pc memory promote <from> <to> <entry-id>` for agents to interact with their memory.

#### Scenario: Agent records a correction
- **WHEN** an agent runs `pc memory write long-term '{"type": "correction", "topic": "...", "note": "..."}'`
- **THEN** the CLI SHALL append the entry with a generated id and timestamp to `long-term.json` and mirror to the portfolio manager's `agent_memory` table

#### Scenario: Promote from recent to long-term
- **WHEN** an agent runs `pc memory promote recent long-term <entry-id>`
- **THEN** the CLI SHALL move the entry between layers and record the promotion in the portfolio manager

### Requirement: Memory mirror for cross-repo views
The portfolio manager SHALL maintain a read-only mirror of agent memory in its SQLite (`agent_memory` table: `agent_name`, `target_repo`, `layer`, `entry_id`, `entry_json`, `created_at`) updated whenever an agent calls `pc memory write` or `pc memory sync`.

#### Scenario: Cross-repo memory view
- **WHEN** a user opens the agent detail page for `frontend-developer`
- **THEN** the system SHALL display a list of recent memory entries across all target repos that agent has been assigned to, with target repo + layer indicated

### Requirement: REM-sleep memory consolidation
The system SHALL ship a `rem-sleep` automation entry that, on a weekly cron, runs across all agents in all target repos to (a) dedupe near-identical entries, (b) promote frequently-referenced `medium-term` entries to `long-term`, (c) move stale `recent` entries to `compost`.

#### Scenario: Weekly REM-sleep runs
- **WHEN** the `rem-sleep` automation fires
- **THEN** the system SHALL process each agent's memory, log a `rem_sleep_run` row with counts (deduped, promoted, composted), and produce a summary comment on a dashboard work item

### Requirement: Memory layers are optional
The system SHALL allow agents to operate with only `recent.json` populated; other layers SHALL auto-create empty on first write.

#### Scenario: Minimal memory use
- **WHEN** a new agent writes only to `recent.json` and never to others
- **THEN** the system SHALL not error and SHALL show empty (not missing) for other layers in the UI
