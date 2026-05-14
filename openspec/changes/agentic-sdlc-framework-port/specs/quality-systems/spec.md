## ADDED Requirements

### Requirement: Per-persona capability checklist
Each persona entry SHALL declare a `capabilities` checklist in frontmatter with three lists: `required`, `conditional`, `notExpected`. The system SHALL store and validate this on save.

#### Scenario: Validate capability checklist on persona save
- **WHEN** a user saves a persona whose `capabilities.required` includes a string not in the known-capabilities vocabulary
- **THEN** the system SHALL reject the save with an "unknown capability" error naming the offending string

### Requirement: Capability log
The system SHALL append a `capability_log` row on every API write (work-item create/update, comment post, automation result) recording `agent_name`, `capability_used`, `work_item_id`, `timestamp`.

#### Scenario: Agent action logged
- **WHEN** an agent posts a comment via the API
- **THEN** the system SHALL append a `capability_log` row with `capability_used = comment` and the agent's name

### Requirement: Capability drift detection
The system SHALL produce a drift report per agent comparing `capability_log` actual usage against the persona's declared `capabilities`. Capabilities used but not in `required` or `conditional`, or in `notExpected`, SHALL be flagged.

#### Scenario: Detect drift for an agent
- **WHEN** a user opens an agent's detail page after that agent has used a capability listed in `notExpected`
- **THEN** the system SHALL display a drift warning naming the capability and the work-item ids where it occurred

### Requirement: Maturation tracking
The system SHALL track per-`agent_assignment` maturation level transitioning through: `new` → `corrected` → `remembering` → `teaching` → `autonomous` → `evolving`. Transitions SHALL be recorded in a `maturation_events` table with `from_level`, `to_level`, `triggered_by`, `at`.

#### Scenario: Auto-promote from new to corrected on first review feedback
- **WHEN** an agent assignment at level `new` receives its first correction-type memory write
- **THEN** the system SHALL transition the assignment to `corrected` and record the event

#### Scenario: Maturation visible on dashboard
- **WHEN** a user opens `/dashboard`
- **THEN** the system SHALL show a maturation snapshot listing each (agent × target-repo) with current level and most recent transition

### Requirement: Defeat-test allowlist surfaced from target repo
The system SHALL read `defeat-allowlist.json` from the target repo (path: repo root or `.cursor/defeat-allowlist.json`) and surface its current contents on the target-repo detail view.

#### Scenario: View allowlist for a repo
- **WHEN** a user opens a target repo's detail view
- **THEN** the system SHALL render the allowlist entries with `anti_pattern`, `exception_reason`, `granted_by`, `granted_at`

### Requirement: Done-checklist enforcement
The system SHALL enforce a per-project `done_checklist` (configurable list of required gates: tests, review, deploy, verify, notify) by refusing `in_review` → `done` transitions until all gates are checked.

#### Scenario: Block done transition with incomplete checklist
- **WHEN** a user attempts to mark an item `done` while its `done_checklist` has unchecked entries
- **THEN** the system SHALL refuse the transition with a 400 error listing the unchecked gates

#### Scenario: Override with reason
- **WHEN** a user submits the override action with a non-empty reason text
- **THEN** the system SHALL allow the transition, record the override (user, reason, timestamp) in the item history, and surface it on the dashboard's "overrides" list

### Requirement: Bottleneck detection
The system SHALL flag any human-assigned work item that has been in a non-terminal status for > 24h with no comments or status changes as a bottleneck and surface it on the dashboard.

#### Scenario: Bottleneck appears on dashboard
- **WHEN** a work item assigned to a human has been idle for 25 hours
- **THEN** the dashboard SHALL list it under "Bottlenecks" with the elapsed time, current status, and a "ping assignee" action

### Requirement: Per-project quality config
The system SHALL accept per-project quality configuration toggling each quality system on/off, stored in the portfolio manager's project record.

#### Scenario: Disable done-checklist for a project
- **WHEN** a user sets `quality.done_checklist.enabled = false` on a project
- **THEN** subsequent `in_review` → `done` transitions for that project SHALL succeed without checklist enforcement
