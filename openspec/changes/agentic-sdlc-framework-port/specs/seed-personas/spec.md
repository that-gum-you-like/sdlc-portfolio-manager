## ADDED Requirements

### Requirement: 19 personas seeded on first run
The system SHALL seed the library on first run with 19 agent personas — 16 execution agents and 3 framework agents — sourced from `~/agentic-sdlc/agents/templates/execution-agents/` and `~/agentic-sdlc/agents/`.

#### Scenario: First-run produces 19 persona entries
- **WHEN** the system runs first-time setup against an empty data directory
- **THEN** the library SHALL contain exactly 19 entries with frontmatter `role: persona`, browsable via filter

#### Scenario: Personas list
- **WHEN** a user filters the library by `role=persona`
- **THEN** the list SHALL include at minimum: cto-orchestrator, code-reviewer, release-manager, backend-developer, frontend-developer, ai-engineer, documentarian, security-engineer, qa-engineer, integration-tester, ethics-advisor, architect, dependency-auditor, performance-sentinel, platform-maturity-sentinel, research-agent, SDLC Reviewer, SDLC Documentarian, SDLC Developer

### Requirement: Persona frontmatter schema
Each persona entry SHALL have YAML frontmatter with fields: `name`, `role: persona`, `model_tier` (`opus`|`sonnet`|`haiku`), `capabilities` (array of strings), `routing_globs` (array of glob patterns), `memory_dir` (string, path under target repo), `escalation_policy` (string), `description`.

#### Scenario: Validate persona on save
- **WHEN** a user saves a persona entry missing the `routing_globs` field
- **THEN** the system SHALL reject the save with a frontmatter validation error naming the missing field

### Requirement: Persona body is the agent's instructions
The markdown body of each persona entry SHALL be the agent's system prompt — the content a Cursor agent reads to know its role, responsibilities, and conventions.

#### Scenario: Publish persona to target repo
- **WHEN** a user publishes the `frontend-developer` persona to a target repo
- **THEN** the target repo SHALL receive `.cursor/rules/frontend-developer.mdc` containing the frontmatter + markdown body verbatim

### Requirement: "Reset to template" action
The system SHALL provide a "Reset to template" action on each persona entry that restores it to the seeded content, with a confirmation dialog.

#### Scenario: User edits then resets a persona
- **WHEN** a user edits the `code-reviewer` persona body and then clicks "Reset to template"
- **THEN** the system SHALL restore the original seeded content after confirmation, and record the reset in the entry's history

### Requirement: Persona routing rules
The system SHALL use each persona's `routing_globs` to suggest which persona to assign when a work item is created with a file-path hint.

#### Scenario: Suggest persona based on file path
- **WHEN** a user creates a work item with `affected_paths: ["src/components/Button.tsx"]`
- **THEN** the system SHALL suggest `frontend-developer` as the assignee based on its `routing_globs` matching `.tsx` files
