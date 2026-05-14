## ADDED Requirements

### Requirement: Seed framework knowledge entries
The system SHALL seed the library on first run with `doc`-type entries covering the framework's theory, sourced from `~/agentic-sdlc/framework/` and `~/agentic-sdlc/docs/`:
- `maturity-model` — 7-level pyramid (Foundation → Automation → Scale → Quality → Evolution → Continuous Improvement → Mastery)
- `testing-tiers` — T1 Unit, T2 Integration, T3 Defeat, T4 Behavior, T5 Browser E2E
- `validation-layers` — L1 Research, L2 Critique, L3 Code, L4 Statistics, L5 Browser Verification
- `iteration-cycles` — Micro, Daily, Weekly, Monthly cycles + done-checklist
- `agent-routing` — decision tree for which persona handles which task type
- `agent-lifecycle` — create/specialize/terminate decisions, CTO mindset
- `prompt-playbook` — ready-to-use prompts for planning, execution, delegation
- `parallelization-guide` — dependency graphs, work-stream contracts
- `case-studies` — citation crisis, NaN fallback, 150 Math.random, 6600 tests / 6 browser bugs
- `memory-protocol` — how the 5-layer memory works in practice

#### Scenario: First-run seeds framework docs
- **WHEN** the system completes first-run seeding
- **THEN** the library SHALL contain at minimum the 10 framework knowledge entries listed above, filterable as `type=doc, category=framework`

### Requirement: `source_url` frontmatter for traceability
Each seeded framework knowledge entry SHALL include a `source_url` frontmatter field pointing back to the corresponding file in `~/agentic-sdlc/`.

#### Scenario: View source for a framework entry
- **WHEN** a user opens the `testing-tiers` entry detail
- **THEN** the system SHALL display the `source_url` and a "Diff against source" action that shows differences if any

### Requirement: Publish framework docs to target repo
The publish flow SHALL support publishing framework knowledge entries into a target repo at `.cursor/framework/<entry-slug>.md` so agents in that repo can read them.

#### Scenario: Publish testing-tiers to a target repo
- **WHEN** a user publishes the `testing-tiers` entry to a target repo
- **THEN** the target repo SHALL receive `.cursor/framework/testing-tiers.md` and a publish event SHALL be recorded

### Requirement: Framework category filter and dedicated view
The library UI SHALL provide a "Framework" category filter that scopes to seeded knowledge entries and renders them with a curriculum-style ordering (level 1 → level 7).

#### Scenario: Browse framework in curriculum order
- **WHEN** a user clicks "Framework" in the library navigation
- **THEN** the system SHALL render entries grouped by `category` and ordered by `level` frontmatter ascending
