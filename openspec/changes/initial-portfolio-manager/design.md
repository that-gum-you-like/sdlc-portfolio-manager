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

- Port number convention for local dev (default `3737`?)
- Should the library ship with the IT-Crowd agent personas (Roy, Moss, Jen, etc.) from agentic-sdlc as seed entries, or stay neutral?
- Cursor "skills" vs "rules": the OpenSpec install created `.cursor/skills/` and `.cursor/commands/`, so Cursor does have a skills primitive — confirm exact format before the library editor commits to a schema
- Where does the desktop launcher / "is the server running?" indicator live? Tray icon out of scope, but `npm run dev` is the only entry point at MVP — okay?
