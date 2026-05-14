## Why

The user has Cursor at work but lacks an Azure-DevOps-style portfolio/work-item layer that both humans and AI agents can share, plus a managed library of Cursor rules/skills that team members can curate together. Existing options (Paperclip, full ADO) require infrastructure the user cannot run at work. A local-first, Cursor-native tool fills the gap immediately and survives any future move to multi-user/team use.

## What Changes

- **NEW** Local Next.js + SQLite application (`apps/portfolio/`) serving both a REST API and a web UI on `http://localhost:<port>`
- **NEW** Work-item model: epics, stories, tasks, bugs with status, assignee, parent/child links, labels, comments
- **NEW** Three portfolio views: Kanban board, ordered backlog, item detail page
- **NEW** Skills & rules library: browse, in-app markdown editor (with frontmatter validation), publish-to-target-repo action
- **NEW** `pc` CLI in `packages/cli/` invoked by Cursor agents via `.cursor/rules/*.mdc` to pick up work, update status, file new items
- **NEW** Seed `.cursor/rules/` templates in `cursor-templates/` that wire Cursor Background Agents into the protocol
- **NEW** Data model uses UUIDs and `user_id` scoping from day one; auth stubbed to a `local-user` constant so multi-user is a stub-swap, not a rewrite
- **NEW** Cursor Automations integration: the portfolio manager exposes endpoints for Cursor Automations to (a) auto-claim work items moved to `ready` and (b) trigger scheduled prompts (recurring bug reviews, security reviews). Automation definitions are stored in the library so the user can manage them in-UI.
- **NEW** Human-in-the-loop (HITL) thread: agents can tag the user with questions / decisions / blockers, the user can tag agents back, and the work item visibly enters a `needs-human` state until answered. Comments support `@username` and `@agent-name` mentions; an inbox surfaces all open questions across all items.
- **NEW** Portfolio > Project hierarchy: top-level `portfolios` group `projects` group work items. Each project links to a target repo, has its own settings (validation gates, done-checklist, automations, published personas), and gets dedicated detail/board/backlog/dashboard views. Portfolio view rolls up across projects.
- **NEW** Enforced validation pipeline gating the `done` transition: each work item must pass four configurable gates — **quality** (lint + type-check), **security** (security review), **bugs** (tests pass), and **user-story-acceptance** (implementation matches the item's acceptance criteria). Each gate is run by a `validator` entry in the library (a first-class library type) with a defined command, parser, and pass/fail contract. Gate runs produce records visible on the item; failing gates block `done`; the override path remains available with a reason.
- **NEW** Cross-entity relationship web: a generic `relationships` table connects any two entities (portfolio, project, or work item) with typed edges — `parent_of`, `blocks`, `depends_on`, `duplicates`, `related_to`, `predecessor_of`. Containment FKs (`portfolio_id`, `project_id`, work-item `parent_id`) remain the canonical hierarchy; the relationships table adds the cross-container web (siblings, cross-project blocks, related portfolios, etc.). Each entity gets a "Related" panel and a graph view.
- **NEW** Discovery workflow: the user dumps unstructured thoughts (text now, voice transcripts later) and the system — via the seeded planning personas (Bill Crouse / Judy / Barbara / April from agentic-sdlc) — produces *draft* user stories, requirements, epics, and parallelization analyses with acceptance criteria, value/complexity scores, and inter-draft links. The user reviews each draft, edits in place, accepts or rejects. Accepted drafts become real work items wired up via the relationships table.

## Capabilities

### New Capabilities

- `work-items`: Domain model and lifecycle for stories, bugs, tasks, epics — CRUD, status transitions, parent/child links, labels, comments, assignee (human or agent)
- `portfolio-ui`: Web UI surfaces — Kanban board, ordered backlog, item detail page, basic filters
- `skills-rules-library`: Curated library of Cursor rules and skills — browse, edit with frontmatter validation, publish into target repo's `.cursor/` directory
- `agent-protocol`: REST API contract + `pc` CLI used by Cursor agents to discover, claim, update, and file work items
- `local-persistence`: SQLite schema, migrations, and identity model designed single-user-first / multi-user-ready
- `cursor-automations`: First-class integration with Cursor Automations — endpoint contract for "give me the next ready item," scheduled prompts (bug/security review crons) defined in-library and registered with Cursor, and a UI surface for managing automation definitions
- `hitl`: Human-in-the-loop thread — structured question/answer model that agents and humans use to unblock each other, with `@-mention` parsing in comments, a unified inbox, `needs-human` work-item state, and async/blocking CLI commands for agents
- `portfolio-projects`: Two-level hierarchy of `portfolios → projects → work items` with per-project settings (target repo path, validation gates, done-checklist, published personas/rules/automations), portfolio rollup view, and per-project board/backlog/dashboard
- `validation-pipeline`: Enforced validation gating the `done` transition — quality, security, bugs, and user-story-acceptance gates each run by a configurable library-entry validator that produces a pass/fail record. Per-project enable/disable, override-with-reason path, and full run history surfaced in the UI.
- `relationships`: Generic cross-entity relationship graph — portfolios, projects, and work items connected by typed edges (`parent_of`, `blocks`, `depends_on`, `duplicates`, `related_to`, `predecessor_of`), with sibling computation, cycle prevention on hierarchical types, and a "Related" panel + optional graph view per entity
- `discovery-workflow`: Braindump → draft user stories / requirements / epics flow — user dumps unstructured thoughts (text, future voice), the system invokes the planning personas to produce drafts with acceptance criteria + value/complexity + inter-draft links, user reviews and accepts; accepted drafts become real work items with their relationships persisted

### Modified Capabilities

(none — this is the founding change)

## Impact

- **New repo**: `~/sdlc-portfolio-manager` → `github.com/that-gum-you-like/sdlc-portfolio-manager`
- **Dependencies (planned)**: Next.js (App Router), better-sqlite3, Drizzle ORM, Tailwind, Zod
- **External systems**: None at MVP. Future hook into Cursor Background Agents via webhook (out of scope for this change)
- **Target repos**: Any repo where you want Cursor agents to follow the protocol receives a `.cursor/rules/` set published from the library
- **Schema**: every user-owned table additionally scoped by `project_id` (and transitively `portfolio_id`), not just `user_id`
- **Library types**: extended to include `validator` alongside `rule`, `skill`, `automation` (and `doc` from framework-port)
- **Backlog (deferred)**: Multi-user auth, team contributions/review for the library, versioning/history for rules, MCP server, webhook into Cursor Background Agents, dependency graph + sprint planning, attachments
