# Backlog

Parking-lot for ideas, future capabilities, and stretch features. Items here are NOT in the active change scope — promote to a real OpenSpec change when ready to design.

## Multi-user & team collaboration

- Real auth (replace `local-user` stub) — pick provider (passkeys, magic links, oauth)
- Roles: viewer, contributor, maintainer
- Team-owned vs personal work items
- Library: team contributions, review/approval flow, "draft → published" lifecycle
- Library: version history per entry, diff view, rollback
- Library: cross-instance sharing (subscribe a target repo to a library entry so updates flow automatically)
- Audit log of who changed what, when
- Webhook events out (Slack, Teams, email digest)

## Cursor Background Agents integration (push model)

- Webhook on item status → `ready` triggers Cursor Background Agent run
- Cursor agent run status reflected on work item ("agent running", "PR opened")
- Cost telemetry: track cost per work item from Background Agent metering
- Auto-create work items from Background Agent failures

## Work-item model expansion

- Epics with rollup status from children
- Sprints / iterations
- Velocity & burndown charts
- Dependency graph view (DAG of parent/child + explicit `blocks`/`blocked_by`)
- Attachments (images, log files)
- Custom fields per work-item type
- Saved views / queries
- Bulk operations

## Portfolio views

- Calendar view
- Timeline / Gantt view
- "My work" personalized landing
- Search across all work items + comments
- Markdown rendering: GitHub-flavored, syntax highlighting, mermaid diagrams

## Library expansion

- MCP server export (publish library entries as MCP tools)
- Claude Code skills support (separate target dir convention)
- Skill scaffolding: starter SKILL.md + scripts dir
- Cross-tool publishing: one entry → both `.cursor/` and `.claude/` formats
- Linting: rule-level lints (e.g., "globs covers no files in target repo")
- "Effective rules" preview — show what a Cursor agent would actually see in a given target repo

## Operations & deployment

- Optional team-shared instance: same codebase, run on a small VPS with Postgres backend
- Postgres adapter alongside SQLite (Drizzle supports both)
- Cloud sync of SQLite file (litestream?)
- Tray icon / desktop launcher
- Auto-update mechanism
- Backup/restore commands in `pc` CLI

## Integrations (one-way at first)

- Import from Azure DevOps / GitHub Issues / Linear
- Export to those same systems
- Read-only embed in Notion/Confluence

## Quality & ops

- E2E tests with Playwright
- Visual regression tests
- Performance budget per route
- Telemetry (local-only, no third party)
- Crash reporting (local-only)
