## Context

The user has Cursor at work (approved tool) but no Claude Code CLI access, and lacks a portfolio/orchestration layer comparable to Paperclip. The new repo `sdlc-portfolio-manager` is greenfield, will run locally on the user's machine only at first, and must be architected so a future shift to a multi-user team-shared instance is a configuration change, not a rewrite.

The product has two coupled pillars:
1. A work-item system (Azure DevOps Boards-like) that humans and Cursor agents share.
2. A library of Cursor rules/skills the user can curate and publish into target repos.

Cursor's Background Agents are the execution layer; this repo is the management layer.

## Goals / Non-Goals

**Goals:**
- Run end-to-end on a single laptop with no network dependency
- Provide a REST API + CLI surface stable enough for a Cursor agent to script against via `.cursor/rules/`
- Persist all state in one SQLite file so backups are trivial
- Make multi-user a stub-swap: identity scoping, UUIDs, and API shape ready from day one
- Ship a seed set of rules in `cursor-templates/` so a new target repo can be wired up in one publish action

**Non-Goals:**
- Multi-user auth, team review/approval flows, or hosted deployment (this change)
- Direct integration with Cursor Background Agents via webhook (deferred — first version uses the agent pulling work via `pc next`)
- MCP server exposure (deferred — CLI is simpler and doesn't require IT approval at work)
- Sprint planning, velocity charts, dependency graphs, attachments (backlog)
- Replacing Paperclip for the LinguaFlow project — this is a separate product

## Decisions

### Decision 1: Next.js (App Router) + better-sqlite3 + Drizzle ORM

**Chosen**: Next.js App Router for both UI and REST API, with `better-sqlite3` as the driver and `drizzle-orm` for queries and migrations.

**Considered**: Tauri desktop app; FastAPI + static frontend; Electron; Rails.

**Rationale**: Next.js gives the UI + API in one process with one toolchain, runs anywhere Node runs (work laptop included), and the user is already in the Next.js mental model from LinguaFlow. `better-sqlite3` is synchronous and fast for single-process local apps. Drizzle keeps migrations and types honest without an ORM-runtime tax.

### Decision 2: UUIDv4 keys + `user_id` scoping from day one

**Chosen**: All primary keys are UUIDv4 strings; every user-owned row carries a `user_id` column; the single auth helper returns the constant `local-user` in single-user mode.

**Considered**: Autoincrement integers with a future `user_id` migration; deferring identity entirely until multi-user.

**Rationale**: UUIDs make future cross-instance merging safe and make IDs URL-safe and globally unique today. Scoping queries by `user_id` from the start means swapping the auth helper is the only change required for multi-user — no schema migration, no API refactor. The cost (12 bytes per row, ugly URLs) is negligible.

### Decision 3: CLI-pull, not webhook-push, for agent integration (MVP)

**Chosen**: Cursor agents call `pc next` to claim work; the system does not push work to agents.

**Considered**: Webhook to Cursor Background Agents API when an item moves to `ready`.

**Rationale**: Pull is simpler, requires no Cursor Cloud configuration, works identically in foreground Cursor agent mode and Background Agent mode, and removes one piece of "explain this to IT" surface area. Push-based integration is in the backlog for once the protocol is proven.

### Decision 4: Skills/rules library stored as files on disk, indexed in SQLite

**Chosen**: Each library entry is a `.mdc` file on disk under `data/library/<type>/<slug>.mdc`; SQLite holds an index (name, description, tags, publish history) regenerated from the files at startup.

**Considered**: Storing entry body as a blob in SQLite; storing only in git.

**Rationale**: Keeping the source-of-truth as files means users can grep, edit in their editor, diff, and check into git outside the app — none of which are possible if the body lives in SQLite. The SQLite index gives fast list/filter without scanning the filesystem on every request.

### Decision 5: Publish-to-target is a file write, not a symlink or package install

**Chosen**: "Publish" copies the selected `.mdc` files into the target repo's `.cursor/rules/` or `.cursor/skills/` directory and records the publish event in SQLite.

**Considered**: Symlinking so target repo always tracks library updates; building a real package + install command.

**Rationale**: A copy is what Cursor expects to find; symlinks break in repos shared across machines; packaging is over-engineering for a single-user MVP. The publish-history record gives us "this rule needs updating in 3 repos" callouts later without symlinks.

### Decision 6: Cursor Automations is the execution runtime for scheduled + auto-pickup work

**Chosen**: Cursor Automations (cron-scheduled prompts and event-triggered Background Agent runs configured in Cursor) drive (a) scheduled bug reviews, (b) scheduled security reviews, and (c) auto-pickup of items moved to `ready` in the manager UI. The portfolio manager exposes a stable contract endpoint (`GET /api/v1/work-items/next-ready` returning either an item to work or a 204) and stores automation definitions in the library so they can be edited in-UI and published into a target repo as `.cursor/automations/*.json` (or whatever Cursor's on-disk format is — confirm before locking).

**Considered**: Polling from a long-running local daemon; webhook out from the portfolio manager into Cursor's API; manual `pc next` invocation only.

**Rationale**: Cursor Automations is the user's available approved primitive at work, runs in Cursor's already-approved cloud sandbox, and removes the need for any local daemon or webhook plumbing. Manual `pc next` from a foreground agent remains supported (and is what humans / debug runs use), but Automations is what makes the system actually unattended. Modeling automation definitions as library entries means the same browse/edit/publish flow already specified for rules/skills also applies to automations — no new UI primitive.

### Decision 7: Default port `3737`

**Chosen**: Local server listens on `127.0.0.1:3737` by default. Configurable via `PORT` env var.

**Rationale**: Low collision (Next.js default is 3000, Vite is 5173, common dev tools cluster around 3000-3010), easy to remember (sdlc → 3737), four digits.

### Decision 8: Seed library ships with the IT-Crowd personas from `agentic-sdlc`

**Chosen**: The 16 execution-agent templates (Roy, Moss, Jen, Richmond, Denholm, Douglas, etc.) plus the 3 framework agents from `~/agentic-sdlc/agents/templates/execution-agents/` are ported into the seed library as `.cursor/rules/*.mdc` entries. Users can delete, edit, or fork them.

**Rationale**: Feature parity with the existing framework is a stated goal; opinionated seeds make first-run useful instead of empty. Persona content port lives in the follow-on `agentic-sdlc-framework-port` change.

### Decision 9: Portfolio > Project hierarchy, not flat project list

**Chosen**: Two-level hierarchy with `portfolios → projects → work items`. Every work item carries a `project_id` FK; every project carries a `portfolio_id` FK.

**Considered**: Flat list of projects with no grouping; folder/tag-based grouping; arbitrary-depth nesting.

**Rationale**: A user managing more than a handful of projects needs grouping (personal vs. work, side projects vs. paid client, etc.). Two levels match Azure DevOps's organizations-and-projects mental model — familiar from the user's stated reference. Arbitrary depth becomes a UI hairball and rarely pays for itself; we can revisit if real users hit the ceiling. Foreign keys go on every domain table from day one because retrofitting `project_id` later is a much larger migration than putting it in now.

### Decision 9a: Validation pipeline is enforced at the done transition with override-with-reason

**Chosen**: Four required gates (`quality`, `security`, `bugs`, `user-story-acceptance`) run automatically when a work item enters `in_review`, each implemented as a `validator` library entry executing a subprocess. The `in_review` → `done` transition is blocked unless all enabled gates have a most-recent `pass`. Failing gates can still pass via the existing override-with-reason path.

**Considered**: Soft enforcement (warnings only); a single monolithic validator runner; embedding lint/security/tests as built-ins.

**Rationale**: The agentic-sdlc case studies (especially "6600 tests / 6 browser bugs") show that documented expectations get skipped under pressure; structural enforcement is the only mechanism that holds up. Four discrete gates parallel the four acceptance dimensions the user explicitly asked for ("quality, security, bugs, and validate it achieves the attached user story") and let each be enabled / overridden / replaced independently. Library-entry-as-validator means users can browse, edit, swap validators in the same UI as rules — no new admin surface. Override-with-reason preserves human judgment over false positives without weakening the default.

### Decision 9b: HITL is async by default, with optional blocking wait

**Chosen**: `pc ask` returns immediately by default (fire-and-forget); agents that want to block call `pc ask --wait <seconds>` or `pc check-answer <id>`. The portfolio manager does not push answers to running agent processes — the agent decides whether to wait, poll, or pick up answers on its next `pc next` invocation.

**Considered**: Always-blocking ask (matches a sync RPC mental model); push via long-poll / SSE / websocket.

**Rationale**: Cursor Background Agents are short-lived processes that may not be alive when an answer arrives hours later. Sync would force the agent to hold the process open and burn cost waiting. The async default lets the agent finish what it can, exit, and pick up the answer on its next run. The `--wait` flag exists for foreground / interactive sessions where blocking is fine. Push-based delivery is deferred until there's a real use case it solves better than polling.

### Decision 9c: needs-human is a real status, not a flag

**Chosen**: `needs-human` is one of the work-item statuses, with its own Kanban column, restored to `previous_status` automatically when all open questions resolve.

**Considered**: A boolean `is_blocked` flag on top of the existing in_progress status.

**Rationale**: A column is visible at a glance — "I have 5 things waiting on me right now" is a more useful default view than "find items with is_blocked=true." A flag would also obscure the fact that an agent is paused, leading to "why isn't this moving?" questions. Restoring to the prior status on resolution means status history stays clean.

### Decision 10: Cursor skills format = `.cursor/skills/<name>/SKILL.md`

**Chosen**: Skills are folders with a `SKILL.md` containing YAML frontmatter + markdown body, matching the convention OpenSpec installed under `.cursor/skills/` at init.

**Rationale**: This is what Cursor produced when OpenSpec scaffolded skills, so it's the live convention. Schema parity with Claude Code's skill format is an accidental win — same content can serve both clients if we ever care.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| User runs the app on multiple machines, expects state to follow them | Document SQLite file location prominently; future cloud-sync change covers it |
| Cursor changes its `.cursor/rules/` format | Frontmatter validation lives in one module; update there, re-publish library |
| CLI protocol drifts from REST API | CLI is a thin wrapper around the REST API — no parallel logic |
| Single-user shortcuts leak into multi-user (e.g., a query forgets `WHERE user_id = ?`) | Lint rule and integration test verifying every query is scoped before merging |
| User installs Node version older than required | `package.json` engines field + clear error on startup |

## Migration Plan

No data migration — this is greenfield. Deployment is `npm install && npm run dev` on the user's laptop. Rollback is `git revert`.

## Open Questions

- Cursor Automations on-disk format — confirm whether automation defs live under `.cursor/automations/*.json` (or wherever Cursor actually writes them) before the publish path writes files. Implementation task 15.1 includes verification.
- Desktop launcher / "is the server running?" indicator — `npm run dev` is the only entry point at MVP. Tray icon, autostart on login, etc. are backlog.
