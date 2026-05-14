## Why

The sibling repo `~/agentic-sdlc/` has accumulated substantial framework value: 19 agent personas, a 5-layer memory protocol, a 7-level maturity model, a 5-tier testing taxonomy, a 5-layer validation pipeline, defined iteration cycles, and a set of quality-enforcement systems. The founding portfolio-manager change (`initial-portfolio-manager`) covers infrastructure (work items, UI, library, CLI, persistence, Cursor Automations integration) but not this content/framework parity. Without porting it, `sdlc-portfolio-manager` starts empty and re-derives years of accumulated practice from scratch.

This change explicitly does NOT bring over things Cursor itself handles (LLM adapter selection, voice intake, model intelligence routing) or things scoped out (Matrix/WhatsApp/Paperclip comms, pattern hunt review mining, autonomous setup wizard). Those go to backlog.

## What Changes

- **NEW** Seed library with all 19 agent personas as `.cursor/rules/*.mdc` entries (16 execution agents + 3 framework agents from `~/agentic-sdlc/agents/templates/execution-agents/` and `~/agentic-sdlc/agents/`)
- **NEW** Per-agent **5-layer memory protocol**: `core.json`, `long-term.json`, `medium-term.json`, `recent.json`, `compost.json` — stored under the target repo's `.cursor/memory/<agent>/`, read/written by agents via the `pc memory` CLI command
- **NEW** Framework knowledge corpus shipped as seed library entries of type `doc`: maturity model (7 levels), testing tiers (T1–T5), validation layers (L1–L5), iteration cycles (micro/daily/weekly/monthly), agent routing decision tree, lifecycle guide
- **NEW** Planning-artifact work-item subtypes: `requirement` (REQ-xxx with Acceptance Criteria, Complexity, Value), `roadmap-item`, `parallelization-stream`, `devlog-entry`
- **NEW** Quality systems baked into the data and API layer:
  - **Capability checklist** per agent persona — `expected: required | conditional | notExpected` capabilities, validated against actual usage
  - **Capability drift detection** — flags when agent's used capabilities diverge from declared
  - **Maturation tracking** — per-agent levels (New → Corrected → Remembering → Teaching → Autonomous → Evolving) with transitions logged
  - **Defeat-test allowlist** — per-repo `defeat-allowlist.json` for known anti-pattern exceptions
  - **Done-checklist enforcement** — per-project doneness rules block status → done until satisfied
  - **Bottleneck detection** — surface work items blocked by humans for > 24h
- **NEW** Cron-runnable maintenance jobs (defined as automation entries, executed by Cursor Automations):
  - `rem-sleep` — weekly memory consolidation across all agents
  - `daily-review` — dashboard refresh, bottleneck scan
  - `weekly-review` — maturation report, capability-drift summary
- **NEW** PM Dashboard route (`/dashboard`) — daily progress, bottlenecks, maturation snapshot, capability log

## Capabilities

### New Capabilities

- `seed-personas`: 19 agent personas (16 execution + 3 framework) ported into the seed library with consistent frontmatter, routing rules, capabilities declared, and memory-protocol references
- `agent-memory`: 5-layer per-agent memory storage and CLI/API contract for read/write, with weekly REM-sleep consolidation job
- `framework-knowledge`: Maturity model, testing tiers, validation layers, iteration cycles, routing/lifecycle guides — shipped as `doc`-type library entries
- `planning-artifacts`: Work-item subtypes for requirements, roadmap items, parallelization streams, and devlog entries with the schema each needs
- `quality-systems`: Capability checklist, drift detection, maturation tracking, defeat-test allowlist, done-checklist enforcement, bottleneck detection

### Modified Capabilities

- `work-items`: Extend type enum to include `requirement`, `roadmap-item`, `parallelization-stream`, `devlog-entry`; add `maturation_level` field on assignee-agent rows; add `capability_required` array per item
- `skills-rules-library`: Extend `type` enum to include `doc` (knowledge entries) alongside `rule`, `skill`, `automation`
- `portfolio-ui`: Add `/dashboard` route surfacing daily summary, bottlenecks, maturation, capability log

## Impact

- **Depends on**: `initial-portfolio-manager` (extends its data model and capabilities)
- **Source content**: `~/agentic-sdlc/agents/templates/execution-agents/`, `~/agentic-sdlc/framework/`, `~/agentic-sdlc/docs/`
- **New tables**: `agent_memory`, `automation_runs` (also touched by `cursor-automations`), `maturation_events`, `capability_log`, `defeat_allowlist_entries`
- **New API routes**: `/api/v1/agents`, `/api/v1/agents/:name/memory`, `/api/v1/dashboard`, `/api/v1/maturation`, `/api/v1/capabilities`
- **Deferred to backlog**: LLM adapter system, voice intake, Matrix/WhatsApp/Paperclip comms, pattern hunt, token-level cost tracking, model intelligence database, schema validator for inter-agent contracts, autonomous setup wizard, agent prompt evolution / version snapshots
