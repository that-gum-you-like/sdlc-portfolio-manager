## Context

`~/agentic-sdlc/` contains the user's accumulated agentic-SDLC framework: agent personas, memory protocol, maturity model, validation layers, testing tiers, quality systems, and procedural cycles. The sibling change `initial-portfolio-manager` builds the foundation (work items, UI, library, CLI, persistence, Cursor Automations integration). This change ports the framework's content and supporting systems onto that foundation.

The port is a one-way operation. We are not building bidirectional sync with `agentic-sdlc`. After this change archives, `sdlc-portfolio-manager` becomes the canonical home for these assets in Cursor-native form. `agentic-sdlc` remains the canonical Claude-Code-native version.

## Goals / Non-Goals

**Goals:**
- Seed library is useful on first run — empty product is worse than opinionated product
- Agent persona content survives the port: routing rules, capabilities, memory references, escalation behavior
- Memory protocol is functionally equivalent to agentic-sdlc's (5 layers, REM sleep, per-agent isolation)
- Framework knowledge (maturity model, tiers, layers, cycles) lives in the library so users can read it inside the tool and target-repo agents can be taught it via publish
- Quality systems (capability checklist, drift detection, maturation, defeat allowlist, done checklist, bottleneck detection) are enforceable by the API — not just docs

**Non-Goals:**
- Bidirectional sync with `agentic-sdlc/`
- Porting agentic-sdlc's LLM adapter system (Cursor selects the model)
- Porting voice intake (Cursor has dictation)
- Porting Matrix/WhatsApp/Paperclip comms (out of scope for a portfolio manager)
- Porting pattern hunt review mining (deferred to backlog)
- Porting setup.mjs wizard semantics (we have library publish; that's enough)
- Token-level cost tracking (Cursor handles billing)

## Decisions

### Decision 1: Personas are ported as `rule`-type library entries, not new persona-type entities

**Chosen**: Each agent persona becomes a single `.mdc` rule with a structured frontmatter (`name`, `role`, `model_tier`, `capabilities`, `routing_globs`, `memory_dir`, `escalation_policy`) and a markdown body that is the agent's instructions. The list is browsable in the library under filter `type=rule, role=persona`.

**Considered**: A separate `personas` table and UI; nested skills under personas; one rule per (persona × project).

**Rationale**: Reusing the existing library entity keeps the data model small. Personas ARE rules — they are what a Cursor agent reads to know who it is. A dedicated table buys nothing functional and doubles the publish path. Filtering by frontmatter (`role: persona`) gives a clean persona-browsing UX without new tables.

### Decision 2: Memory is per-target-repo, written to `.cursor/memory/<agent>/`

**Chosen**: Memory layers (`core.json`, `long-term.json`, `medium-term.json`, `recent.json`, `compost.json`) live in the *target repo* under `.cursor/memory/<agent-name>/`. The portfolio manager stores a *mirror copy* in its SQLite for cross-repo views (e.g., "what has Roy learned across all my repos this week?") but the target repo is source of truth.

**Considered**: Centralizing memory only in the portfolio manager (target repos are dumb consumers); centralizing in target repos only (no cross-repo view).

**Rationale**: Target-repo storage matches `agentic-sdlc`'s model and means a Cursor agent running in a sandbox can read its memory without network calls to localhost. The mirror in the portfolio manager pays for itself the first time a user wants "show me all of Jen's recent memories across my five frontend repos." Sync is one-way (target → portfolio) on agent task completion via `pc memory sync`.

### Decision 3: Framework knowledge is shipped as `doc`-type entries, not docs-folder markdown

**Chosen**: The maturity model, testing tiers, validation layers, iteration cycles, routing decision tree, and lifecycle guide are each a library entry of type `doc`. Browsable, editable, publishable into target repos exactly like rules.

**Considered**: Static markdown under `docs/` in this repo; an external docs site.

**Rationale**: Putting framework knowledge in the library means (a) users can read it in-app, (b) it can be published into a target repo so the Cursor agent there knows the framework, (c) team contributions/edits flow through the same path as rules. Docs-folder is fine for repo-level docs (architecture, contributing) but framework theory belongs to the library because that's where it's consumed.

### Decision 4: Quality systems are enforced at the API, not just documented

**Chosen**: The portfolio manager validates capability declarations, refuses status → `done` transitions that fail the done-checklist, surfaces bottleneck warnings in the UI, and writes capability-log entries on every API write. None of this is opt-in — it's part of the foundation.

**Considered**: Treating quality systems as documentation only (agents are expected to comply but nothing enforces).

**Rationale**: The agentic-sdlc lesson set (especially the 6600-tests-but-6-browser-bugs case study) is that documented expectations get skipped under pressure. Enforcement at the API costs little (it's read-side cheap, write-side a few extra columns + a checklist run) and means the next "wrote the code but never deployed" failure mode is structurally impossible.

### Decision 5: Maturation level is on an `agent_assignment` join, not on the persona

**Chosen**: An `agent_assignment` row links a persona (library entry) to a target repo with fields `maturation_level`, `last_evolved_at`, `corrections_received`. The persona itself is shared template content; the assignment is the per-repo instance.

**Considered**: Maturation on the persona entry directly; cloning the persona per repo.

**Rationale**: Personas evolve at different rates in different repos. A persona stored once with per-assignment maturation matches how a human developer accumulates context per project, and means improvements to the persona template can flow to all assignments without losing per-repo state.

### Decision 6: Defeat-test allowlist lives in the target repo, indexed in the portfolio manager

**Chosen**: `defeat-allowlist.json` lives at the target repo root (or `.cursor/defeat-allowlist.json`) and is the source of truth. The portfolio manager reads it via the CLI when scoring work items but does not own it.

**Rationale**: The allowlist is about *this codebase*'s known anti-pattern exceptions. It must live with the code. Portfolio manager's job is to surface it, not own it.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Porting 19 personas verbatim ships agentic-sdlc's quirks (Claude-Code-specific phrasing, tools references) | Each ported persona gets a Cursor-native review pass; tool names normalized; Claude-only assumptions stripped |
| 5-layer memory protocol is heavy for single-agent / single-repo use | Memory layers are optional per agent — only `recent.json` is required; others auto-create on first write |
| Framework knowledge as library entries means it's editable and could be diverged from "canonical" | Add `source_url` frontmatter pointing back to `agentic-sdlc`'s file; "reset to template" action on each entry |
| Maturation level on `agent_assignment` means a fresh repo gets a fresh agent | Document this clearly; provide "import maturation from repo X" action as a future affordance |
| Quality-system enforcement could block users who don't want it | All enforcement is per-project config; disable via `quality.enabled: false` in repo-level config; default is on |
| Done-checklist enforcement could trap items in `in_review` forever | "Override with reason" action records who/why and lets the transition proceed; surfaced in dashboard |

## Migration Plan

No data to migrate — we are seeding fresh from `agentic-sdlc` files. Implementation order:
1. Schema changes for `library_entries.type` enum, `agent_assignment`, `maturation_events`, `capability_log`, `defeat_allowlist_entries`, `agent_memory`
2. Port persona files (one PR per persona group? Or one bulk import script — see tasks)
3. Port framework knowledge entries
4. Wire quality systems into the API
5. Build `/dashboard` route

## Open Questions

- Should personas use Cursor's `alwaysApply: true` (always loaded) or glob-scoped loading? Need to test how Cursor handles multiple always-on persona rules before locking.
- Where does `agent_assignment` get created — automatically on first publish-to-repo, or explicit user action?
- Capability log is JSONL append-only in agentic-sdlc. Mirror in SQLite (`capability_log` table) or keep as JSONL file?
- `rem-sleep` cron interval — weekly per agentic-sdlc default, or configurable per project?
