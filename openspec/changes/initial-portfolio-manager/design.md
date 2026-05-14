## Context

The user has Cursor at work (approved tool) but no Claude Code CLI access, and lacks a portfolio/orchestration layer comparable to Paperclip. `sdlc-portfolio-manager` is greenfield, runs locally only at first, and is architected so a shift to multi-user team-shared use is a configuration change, not a rewrite.

The product has three coupled pillars:
1. **Portfolio + project hierarchy** containing work items that humans and Cursor agents share (Azure DevOps Boards-like)
2. **Library** of Cursor rules, skills, automations, validators, and docs that the user curates and publishes into target repos
3. **Discovery + HITL loop** where the user braindumps unstructured thoughts, the system generates draft user stories with acceptance criteria, and agents and humans tag each other to resolve ambiguity

Cursor Background Agents and Cursor Automations are the execution layer; this repo is the management and orchestration layer.

## Goals / Non-Goals

**Goals:**
- Run end-to-end on a single laptop with no network dependency
- REST API + `pc` CLI stable enough that Cursor agents can script against it via `.cursor/rules/`
- One SQLite file holds all state (trivial backup, trivial reset)
- Multi-user is a stub-swap: UUIDs, `user_id` scoping, `project_id` scoping, and API shapes ready from day one
- Seed library produces a useful first-run experience without requiring `agentic-sdlc-framework-port` to land first
- Clean simple UI in the spirit of Jony Ive's restraint — quiet, focused, progressive disclosure (see Decision 18)

**Non-Goals:**
- Multi-user auth, team review/approval flows, or hosted deployment (backlog)
- Direct webhook push to Cursor Background Agents (backlog — Cursor Automations pull is enough)
- MCP server exposure (backlog — CLI is simpler, lower IT-friction)
- Sprint planning, velocity charts, attachments (backlog)
- Replacing Paperclip for the LinguaFlow project — this is a separate product

## Decisions

### Decision 1: Next.js (App Router) + better-sqlite3 + Drizzle ORM

**Chosen**: Next.js App Router for both UI and REST API, with `better-sqlite3` as the driver and `drizzle-orm` for queries and migrations.

**Considered**: Tauri desktop app; FastAPI + static frontend; Electron; Rails.

**Rationale**: One process, one toolchain, Node-everywhere. `better-sqlite3` is synchronous and fast for single-process local apps. Drizzle keeps migrations and types honest without an ORM-runtime tax.

### Decision 2: UUIDv4 keys + `user_id` + `project_id` scoping from day one

**Chosen**: All primary keys are UUIDv4 strings; every user-owned row carries `user_id`; every domain row also carries `project_id` (nullable only for cross-project library entries). The auth helper returns the constant `local-user` in single-user mode.

**Considered**: Autoincrement integers + future `user_id` migration; deferring scoping until multi-user.

**Rationale**: Retrofitting identity and project scoping later is a far larger migration than putting both in now. UUIDs make cross-instance merging safe. Swapping the auth helper is the only change required for multi-user — no schema migration, no API refactor.

### Decision 3: CLI-pull, not webhook-push, for agent integration (MVP)

**Chosen**: Cursor agents and Cursor Automations call `pc next` / `GET /api/v1/work-items/next-ready` to claim work. The system does not push to agents.

**Considered**: Webhook to Cursor Background Agents API when an item moves to `ready`.

**Rationale**: Pull is simpler, works identically in foreground Cursor mode and Background Agent mode, requires no Cursor Cloud webhook configuration, and removes a piece of "explain this to IT" surface area. Push-based integration is in the backlog once the protocol is proven.

### Decision 4: Library entries are files on disk, indexed in SQLite

**Chosen**: Each library entry is a file under `data/library/<type>/<slug>.mdc` (or `.md`/`.json` for some types); SQLite holds an index regenerated from disk at startup and on save.

**Considered**: Storing entry body as a blob in SQLite; storing only in git.

**Rationale**: Files-on-disk means users can grep, edit in their editor, diff, and check into git outside the app. The SQLite index gives fast list/filter without scanning the filesystem on every request.

### Decision 5: Publish-to-target is a file copy

**Chosen**: "Publish" copies the selected library entries into the target repo's `.cursor/rules/`, `.cursor/skills/`, `.cursor/automations/`, `.cursor/validators/`, or `.cursor/framework/` directory and records the event in `publish_history`.

**Considered**: Symlinking; building a package + install command.

**Rationale**: A copy is what Cursor expects to find. Symlinks break across machines. Packaging is over-engineering for single-user MVP. Publish-history records enable "this rule needs updating in 3 repos" callouts later without symlinks.

### Decision 6: Cursor Automations is the execution runtime for scheduled + auto-pickup work

**Chosen**: Cursor Automations (cron + event-triggered Background Agent runs configured in Cursor) drive (a) scheduled bug/security reviews, (b) auto-pickup of items moved to `ready`, (c) discovery generation runs. The portfolio manager exposes contract endpoints (`GET /api/v1/work-items/next-ready`, etc.) and stores automation definitions in the library so they can be edited in-UI and published.

**Considered**: Long-running local daemon polling; webhook out from portfolio manager into Cursor's API; manual `pc next` only.

**Rationale**: Cursor Automations is the user's available approved primitive at work, runs in Cursor's already-approved cloud sandbox, and removes the need for any local daemon. Manual `pc next` from a foreground agent remains supported for humans / debug runs.

### Decision 7: Cursor skills format = `.cursor/skills/<name>/SKILL.md`

**Chosen**: Skills are folders with a `SKILL.md` containing YAML frontmatter + markdown body, matching the convention OpenSpec installed under `.cursor/skills/` at init.

**Rationale**: This is what Cursor produced when OpenSpec scaffolded skills, so it's the live convention. Schema parity with Claude Code's skill format is an accidental win.

### Decision 8: Default port `3737`

**Chosen**: `127.0.0.1:3737` by default. Configurable via `PORT` env var.

**Rationale**: Low collision (Next.js default 3000, Vite 5173). Easy to remember (sdlc → 3737).

### Decision 9: Seed library ships with the IT-Crowd personas from `agentic-sdlc`

**Chosen**: All 19 personas (16 execution + 3 framework) are ported as `.cursor/rules/*.mdc` entries via `agentic-sdlc-framework-port`. The 4 planning personas (Bill Crouse, Judy, Barbara, April) used by Discovery are *referenced* by initial-portfolio-manager but not required for MVP — see Decision 17.

**Rationale**: Opinionated seeds make first-run useful instead of empty. The full content port lives in the follow-on framework-port change to keep this change shippable on its own.

### Decision 10: Portfolio > Project two-level hierarchy

**Chosen**: Two levels. Every project has `portfolio_id`; every work item has `project_id`. Default `personal` portfolio and `general` project seeded on first run.

**Considered**: Flat list with no grouping; folder/tag grouping; arbitrary-depth nesting.

**Rationale**: Two levels match Azure DevOps's organizations-and-projects mental model — the user's stated reference. Arbitrary depth becomes a UI hairball and rarely pays for itself; revisit if real users hit the ceiling.

### Decision 11: Relationships are a generic typed graph, not per-entity FKs

**Chosen**: A single `relationships` table holds typed edges (`parent_of`, `blocks`, `depends_on`, `duplicates`, `related_to`, `predecessor_of`) between any two entities (portfolio, project, work item). Containment FKs (`portfolio_id`, `project_id`, work-item `parent_id`) remain the canonical hierarchy; the relationships table holds the non-canonical web.

**Considered**: Per-relationship-type tables (six × three entity types = 18 lookalike tables); cross-entity nullable FKs everywhere.

**Rationale**: Polymorphic table is queryable as a graph in one SQL union. Store the directional side, compute the inverse — keeps the table small and avoids drift between an `A blocks B` row and a stale `B blocked_by A` row. Containment FKs not duplicated as `parent_of` rows — pulling project children stays a fast `WHERE project_id = ?`.

### Decision 12: Validation pipeline enforced at the done transition with override-with-reason

**Chosen**: Four required gates (`quality`, `security`, `bugs`, `user-story-acceptance`) run automatically when a work item enters `in_review`, each implemented as a `validator` library entry executing a subprocess. The `in_review` → `done` transition is blocked unless all enabled gates have a most-recent `pass`. The override path is part of this capability — submit a non-empty reason, the transition proceeds, the override is recorded with the failing gate(s) named and surfaced on the dashboard.

**Considered**: Soft enforcement (warnings only); a single monolithic runner; built-in lint/security/tests instead of pluggable validators.

**Rationale**: Documented expectations get skipped under pressure (per the agentic-sdlc "6600 tests / 6 browser bugs" case study); structural enforcement is the only mechanism that holds up. Four discrete gates parallel the four acceptance dimensions explicitly named ("quality, security, bugs, and validate it achieves the attached user story"). Library-entry-as-validator means users browse, edit, swap validators in the same UI as rules. Override-with-reason preserves human judgment over false positives. Owning the override path inside this capability (rather than deferring to `quality-systems` in framework-port) lets this change ship standalone — see Decision 17.

### Decision 13: HITL is async by default, with optional blocking wait

**Chosen**: `pc ask` returns immediately by default. Agents that need to block call `pc ask --wait <seconds>` or `pc check-answer <id>`. The portfolio manager does not push answers to running agent processes — the agent decides whether to wait, poll, or pick up answers on its next `pc next` call.

**Considered**: Always-blocking ask; push via long-poll/SSE/websocket.

**Rationale**: Cursor Background Agents are short-lived; sync would force the process to stay alive (and bill) waiting for human responses hours later. Async lets the agent finish what it can, exit, and pick up answers on the next run. `--wait` is for foreground sessions where blocking is fine.

### Decision 14: `needs-human` is a real status, not a flag

**Chosen**: `needs-human` is one of the work-item statuses with its own Kanban column; it stores `previous_status` and auto-restores when all open questions resolve.

**Considered**: A boolean `is_blocked` flag on top of `in_progress`.

**Rationale**: A column is visible at a glance — "I have 5 things waiting on me" is a more useful default view than a filter expression. A flag would obscure that an agent is paused.

### Decision 15: Discovery is its own workflow, not a special epic

**Chosen**: A separate `discoveries` + `discovery_drafts` data model and `/discoveries/:id` review surface. Generation produces drafts; user reviews, edits, accepts; accepted drafts become real work items wired to a `source_discovery_id` FK and (when relevant) `relationships` rows.

**Considered**: Treating a "discovery" as an `epic`-type work item with notes; running planning inline at work-item-create.

**Rationale**: The talk-out-loud → user-stories flow is *generative* with a review step in the middle. Drafts must be reviewable, editable, rejectable without polluting the real work-item table; the discovery groups them; `source_discovery_id` preserves provenance.

### Decision 16: Discovery generation is async with HITL fallback when ambiguous

**Chosen**: Triggering generation marks the discovery `status: generating` and returns immediately. Generation runs through a Cursor Automation that polls for pending generations, runs the persona prompt, and posts drafts back via API. If the persona encounters ambiguity, it files a question via HITL; on answer, generation resumes.

**Considered**: Sync block; silent assumptions; ban HITL during generation.

**Rationale**: Generation is too slow for sync UX, and ambiguity is the rule with braindumps. Reusing the HITL plumbing means no new notification surface.

### Decision 17: Initial change ships standalone — framework-port is additive

**Chosen**: `initial-portfolio-manager` is self-contained at MVP. The 4 planning personas referenced by Discovery (`bill-crouse`, `judy`, `barbara`, `april`) are available *if* `agentic-sdlc-framework-port` is also installed; otherwise the `default` generator runs a built-in single-pass prompt producing the same draft types (requirement, story, epic, parallelization-stream) without the four-persona sequence. The override-with-reason path on validation gates is defined inside this change (not in `quality-systems`).

**Rationale**: A user who installs only `initial-portfolio-manager` must get a complete product. Cross-change soft dependencies are fine (named personas, richer maturation tracking, capability drift detection) — those upgrade the experience without gating it. Hard cross-change dependencies (override path, work-item types referenced by Discovery) are owned by this change.

### Decision 18: UI design principles — Jony-Ive-influenced restraint

**Chosen**: Eight principles govern every UI decision in this change. Full text in `docs/design-principles.md`.

1. **Quiet by default** — restrained color, generous whitespace, type carries hierarchy
2. **One canonical surface per concept** — the board is the board; we don't show it three ways with different chrome
3. **Progressive disclosure** — essentials on first paint, depth on intent
4. **Direct manipulation over modal dialogs** — drag to reorder, drag to status, inline edit; modals are a fallback
5. **Keyboard-first** — every action reachable from the keyboard; no required mouse paths
6. **Honest materials** — web conventions, not fake desktop chrome
7. **Care in every empty state and every error** — empty states explain the next step; errors include a fix path
8. **Consistency over novelty** — same widget for the same concept everywhere

**Rationale**: The user explicitly requested "clean simple UI" in the lineage of Apple's Jony Ive. These principles are concrete enough to settle design disagreements during implementation. They also shape decisions that look minor in isolation but compound: dashboard limited to 4 sections (Decision-adjacent — see `portfolio-ui` spec); graph view defaults to 2 hops, not 3, with no toggle clutter; status indicators use color sparingly with shape backup for color-blind users; default empty state on `/discoveries` says "Start with a braindump" not "No discoveries found."

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| User runs the app on multiple machines, expects state to follow | Document SQLite file location; future cloud-sync change covers it |
| Cursor changes its `.cursor/rules/` format | Frontmatter validation lives in one module; update there, re-publish |
| CLI drifts from REST API | CLI is a thin wrapper around REST — no parallel logic |
| Multi-user shortcuts leak (a query forgets `WHERE user_id = ?` or `WHERE project_id = ?`) | Drizzle wrapper or lint rule verifying every query is scoped before merge |
| User installs older Node | `package.json` engines field + clear error on startup |
| Discovery generation takes minutes — users wonder if it's stuck | Live progress UI (SSE or polling); show which persona is currently working |
| Failed validator hangs and blocks queue | Per-validator timeout, kill on exceed, record error status |

## Migration Plan

No data migration — greenfield. Deployment is `npm install && npm run dev`. Rollback is `git revert`.

## Open Questions

- **Cursor Automations on-disk format** — confirm the exact path and JSON schema (`.cursor/automations/*.json`?) before the publish writer is locked. Task 8.1 includes verification.
- **Desktop launcher** — `npm run dev` is the only entry point at MVP. Tray icon, autostart on login, etc. are backlog.
- **Graph view library** — cytoscape.js, react-flow, or a simpler hand-rolled SVG? Decide at implementation time; default keep it minimal.
- **Live updates strategy** — SSE vs. polling vs. websocket for the inbox badge, discovery generation progress, and validation run progress. Pick the simplest sufficient mechanism (likely polling at MVP).
