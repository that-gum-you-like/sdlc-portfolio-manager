## ADDED Requirements

### Requirement: Four required validation gates
Each work item SHALL be subject to four validation gates before the `done` transition is allowed: `quality`, `security`, `bugs`, `user-story-acceptance`. Each gate is independently enable-able per project via project settings; disabled gates SHALL be skipped (`status: skipped`) rather than treated as passing.

#### Scenario: All four gates enabled, all pass
- **WHEN** a work item completes validation with all four gates returning `pass`
- **THEN** the system SHALL allow the `in_review` → `done` transition

#### Scenario: One gate fails, done blocked
- **WHEN** the `security` gate returns `fail` while the other three pass
- **THEN** the system SHALL reject any `in_review` → `done` transition with a 400 error naming the failed gate(s) and a link to the failed run

#### Scenario: Gate disabled at project level
- **WHEN** a project has `validation.security.enabled = false` and a work item is validated
- **THEN** the system SHALL record `status: skipped` for the security gate and not block `done` on its absence

### Requirement: Validators are first-class library entries
Validators SHALL be `library_entries` of type `validator` with frontmatter describing how to run them: `gate` (`quality`|`security`|`bugs`|`user-story-acceptance`), `command` (shell command template with `{repo}`, `{item_id}`, `{acceptance_criteria_path}` placeholders), `pass_exit_codes` (default `[0]`), `output_parser` (enum: `none`|`junit-xml`|`sarif`|`json-lines`), `timeout_seconds`.

#### Scenario: Create a quality validator
- **WHEN** a user creates a library entry with type `validator`, gate `quality`, command `npm run lint && npm run typecheck`, pass_exit_codes `[0]`, parser `none`, timeout 300
- **THEN** the system SHALL persist it; on validation runs, the runner SHALL execute the command in the project's target repo with the placeholders substituted

#### Scenario: Validator command sandboxing
- **WHEN** the runner executes a validator command
- **THEN** the command SHALL run only against the project's `target_repo_path` with environment variables limited to a whitelist (`PATH`, `HOME`, project-defined vars), and SHALL be killed if it exceeds `timeout_seconds`

### Requirement: Validation run records
The system SHALL persist a `validation_runs` row per (work_item, gate) execution: `id`, `work_item_id`, `gate`, `validator_entry_id`, `started_at`, `completed_at`, `status` (`pass`|`fail`|`error`|`skipped`|`running`), `exit_code`, `stdout_snippet`, `stderr_snippet`, `findings_json` (parser-specific structured output).

#### Scenario: Run records persist across sessions
- **WHEN** a validation gate runs and the server is later restarted
- **THEN** the run record SHALL remain queryable with all fields intact

#### Scenario: Most recent run per gate is authoritative
- **WHEN** a work item has had the security gate run three times with results fail, fail, pass
- **THEN** the system SHALL treat the most recent (`pass`) as authoritative for the done transition check

### Requirement: Validation triggers on in_review entry
The system SHALL fire all enabled gates automatically when a work item transitions to `in_review`. Agents and humans MAY also trigger a re-run manually via the UI or `pc validate <id>` CLI command.

#### Scenario: Auto-fire on in_review entry
- **WHEN** a work item transitions from `in_progress` to `in_review`
- **THEN** the system SHALL enqueue runs for every enabled gate and mark each gate's run `status: running` until completion

#### Scenario: Manual re-run via CLI
- **WHEN** an agent runs `pc validate <id> --gate security`
- **THEN** the CLI SHALL trigger only the security gate run and print the result when complete

### Requirement: User-story-acceptance validator semantics
The `user-story-acceptance` gate SHALL validate that the work item's implementation evidence (test cases, agent-provided "evidence" comments, linked PR description) addresses each acceptance criterion in the work item. The seeded acceptance validator SHALL match each acceptance criterion against (a) at least one test name containing keywords from the criterion, OR (b) at least one comment of kind `evidence` referencing the criterion id.

#### Scenario: All acceptance criteria mapped to tests
- **WHEN** a `requirement`-type work item has three acceptance criteria and three tests whose names contain matching keywords
- **THEN** the acceptance validator SHALL return `pass` with `findings_json.matches` showing the mapping

#### Scenario: One criterion has no evidence
- **WHEN** a work item has three acceptance criteria and the third has no matching test or evidence comment
- **THEN** the acceptance validator SHALL return `fail` with `findings_json.unmatched` naming the missing criterion

#### Scenario: Agent files explicit evidence
- **WHEN** an agent posts a comment via `pc comment <id> --kind evidence --criterion AC-3 "Verified by Playwright test login.spec.ts"`
- **THEN** the system SHALL record the comment with `kind: evidence` and link it to acceptance criterion `AC-3`; the acceptance validator SHALL count it as satisfying that criterion

### Requirement: Validator runner isolation
The runner SHALL execute each validator as a separate subprocess with its own working directory, environment, and timeout. A panicking or hung validator SHALL NOT take down the portfolio manager process.

#### Scenario: Validator hangs and is killed
- **WHEN** a validator command runs longer than its `timeout_seconds`
- **THEN** the system SHALL kill the subprocess, record `status: error, exit_code: -1`, capture partial stdout/stderr, and continue running other gates

### Requirement: Validation status surfaced on work item
The work-item detail page SHALL display the current status of each enabled gate (last run result, when last ran, "run again" action), and the board card SHALL show a compact gate-status indicator (e.g., 4 dots colored pass/fail/running/skipped).

#### Scenario: Item card shows gate indicators
- **WHEN** a user views the board with an item whose runs were pass, pass, fail, skipped
- **THEN** the card SHALL render four dots in green, green, red, gray respectively

### Requirement: Override path retained
The system SHALL allow `in_review` → `done` overrides via the existing override-with-reason mechanism (see `quality-systems`); the override SHALL be recorded with the failing gate(s) named in the override record.

#### Scenario: Override a failed security gate
- **WHEN** a user submits an override with reason "Known false positive — internal-only dependency" while the `security` gate has status `fail`
- **THEN** the system SHALL allow the transition and persist an override record naming the security gate and the reason

### Requirement: Validators publishable like other library entries
Validators SHALL be publishable into a target repo (the project's `target_repo_path`) so the runner script lives with the project. Default publish path: `.cursor/validators/<gate>-<slug>.json`.

#### Scenario: Publish quality validator to project repo
- **WHEN** a user publishes a `validator` entry for the `quality` gate to a project
- **THEN** the system SHALL write the entry into the target repo at `.cursor/validators/quality-<slug>.json` and record the publish event

### Requirement: Seeded default validators per gate
The system SHALL seed the library on first run with one default validator per gate:
- `quality`: `npm run lint && npm run typecheck` (Node/TS-friendly default — disabled if project is not a Node project)
- `security`: invokes the `security-review` skill via `pc skill run security-review --repo {repo}` (defers actual scanning to a Cursor-published skill)
- `bugs`: `npm test` (parser: `junit-xml` if available)
- `user-story-acceptance`: built-in matcher (no external command), runs the test-name/evidence-comment matching described above

#### Scenario: Fresh install ships four working defaults
- **WHEN** a user installs the system and creates their first work item in a Node-project-shaped repo
- **THEN** all four default validators SHALL be present in the library and usable without further configuration
