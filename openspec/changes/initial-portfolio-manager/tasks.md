## 1. Monorepo + toolchain

- [ ] 1.1 Root `package.json` with workspaces (`apps/*`, `packages/*`) and `engines.node >= 22`
- [ ] 1.2 Workspace config (pnpm or npm — pick at impl)
- [ ] 1.3 Shared TypeScript base config (`tsconfig.base.json`) + per-package extends
- [ ] 1.4 ESLint + Prettier configs wired into each workspace
- [ ] 1.5 Vitest config at root
- [ ] 1.6 Lint rule (or Drizzle wrapper) enforcing `user_id` and `project_id` scoping in every query

## 2. Database layer (`apps/portfolio/src/db/`)

- [ ] 2.1 Install `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `gray-matter`, `zod`, `uuid`
- [ ] 2.2 Drizzle schema for all tables in dependency order (see 2.4)
- [ ] 2.3 UUIDv4 default for all `id` columns; `user_id` default `local-user` on every user-owned row
- [ ] 2.4 Migration 0001 creates all tables in correct FK order: `portfolios` → `projects` → `library_entries` → `work_items` → `comments` → `questions` → `notifications` → `mentions` → `relationships` → `validation_runs` → `evidence_links` → `automation_runs` → `publish_history` → `discoveries` → `discovery_drafts` → `_migrations`
- [ ] 2.5 Migration runner records each applied migration; idempotent on restart
- [ ] 2.6 `auth.ts` with `currentUser()` returning `local-user` in single-user mode
- [ ] 2.7 Integration test: insert + read survives process restart; `user_id` and `project_id` always populated

## 3. Portfolio + project hierarchy

- [ ] 3.1 API: `GET/POST /api/v1/portfolios`, `GET/PATCH/DELETE /api/v1/portfolios/:id`
- [ ] 3.2 API: `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:slug`; slug unique per portfolio
- [ ] 3.3 First-run seed: `personal` portfolio + `general` project under `local-user`
- [ ] 3.4 Cascade delete: removing a project removes all dependent rows in one transaction (integration test)
- [ ] 3.5 Project settings JSON shape with Zod schema — validation toggles, done-checklist gates, default routing, target_repo_path
- [ ] 3.6 CLI: respect `--project <slug>` flag and `PC_PROJECT` env var, default to user's active project

## 4. Work-items API

- [ ] 4.1 Work-item type enum: `epic`, `story`, `task`, `bug`, `requirement`, `roadmap-item`, `parallelization-stream`, `devlog-entry`
- [ ] 4.2 Status enum: `backlog`, `ready`, `in_progress`, `needs-human`, `in_review`, `done`, `cancelled`
- [ ] 4.3 `GET /api/v1/work-items` with filters: `status`, `type`, `assignee`, `label`, `parent_id`, `project_id`
- [ ] 4.4 `POST /api/v1/work-items` with subtype-specific validation (e.g., `requirement` requires `acceptance_criteria`)
- [ ] 4.5 `GET /api/v1/work-items/:id` returns item + parent + children embedded
- [ ] 4.6 `PATCH /api/v1/work-items/:id` partial update with status-transition validator
- [ ] 4.7 `POST /api/v1/work-items/:id/claim` atomic ready → in_progress, sets assignee
- [ ] 4.8 Acceptance criteria array with stable ids (AC-1, AC-2, ...); evidence_refs optional
- [ ] 4.9 Devlog entries are append-only — PATCH on body rejected
- [ ] 4.10 Cycle detection on parent assignment
- [ ] 4.11 Standard error contract: `{ error, message, details }` with correct HTTP codes
- [ ] 4.12 Integration tests: each `specs/work-items/spec.md` scenario becomes a test

## 5. Relationships graph

- [ ] 5.1 Type enum: `parent_of`, `blocks`, `depends_on`, `duplicates`, `related_to`, `predecessor_of`
- [ ] 5.2 Composite unique index `(source_type, source_id, target_type, target_id, type)`
- [ ] 5.3 API: `POST /api/v1/relationships`, `DELETE /api/v1/relationships/:id`, `GET /api/v1/entities/:type/:id/relationships` (grouped + inverses + computed siblings)
- [ ] 5.4 Validators: reject self-rel; cycle detection on `parent_of` (BFS on insert); dedup symmetric `related_to`
- [ ] 5.5 Inverse-pair table in code for read-time inversion
- [ ] 5.6 Sibling computation: union of (a) shared canonical containment FK, (b) shared `parent_of` in relationships
- [ ] 5.7 Containment FKs not auto-mirrored into relationships table
- [ ] 5.8 Tests: cycle detection across 3+ node paths; inverse rendering; sibling union

## 6. Comments + mentions

- [ ] 6.1 `POST /api/v1/work-items/:id/comments` — author + markdown body + optional kind (`note` | `evidence`) + optional `criterion_id`
- [ ] 6.2 `GET /api/v1/work-items/:id/comments` — chronological listing
- [ ] 6.3 `@-mention` parser (regex + handle resolver against users + personas); shared across comments and questions
- [ ] 6.4 Mention extraction on every comment/question write — inserts `mentions` and `notifications` rows
- [ ] 6.5 Evidence comments (`kind=evidence`) linked to criterion via `evidence_links` table
- [ ] 6.6 Tests: mention parser handles code blocks, escapes, unknown handles

## 7. HITL — questions, notifications, inbox

- [ ] 7.1 `POST /api/v1/work-items/:id/questions` — files question, transitions to `needs-human`, records `previous_status`
- [ ] 7.2 `POST /api/v1/questions/:id/answer` — persists answer, on last open question resolve auto-restores to `previous_status`
- [ ] 7.3 `GET /api/v1/questions?recipient=<handle>&status=open` powers the inbox
- [ ] 7.4 `pc ask <id> <message>` async by default; `--wait <seconds>` blocking variant (exit 4 on timeout)
- [ ] 7.5 `pc check-answer <question-id>` returns answer or exit 5
- [ ] 7.6 `pc next` response payload extended with `pending_answers` array for the claiming agent
- [ ] 7.7 Notification channel interface — `in-app` impl now; webhook/email/WA later as no-op stubs
- [ ] 7.8 Tests: ask-answer round trip transitions status; multiple-questions hold needs-human; concurrent answers don't double-restore

## 8. Cursor Automations integration

- [ ] 8.1 Confirm Cursor Automations on-disk format (consult Cursor docs) — locks publish-writer schema; tracked as open question in design.md
- [ ] 8.2 Library entry type `automation`: frontmatter `prompt`, `cron`, `scope`, `resultHook`, validated with Zod
- [ ] 8.3 Cron expression validation in editor + on save
- [ ] 8.4 `GET /api/v1/work-items/next-ready` with atomic claim semantics (concurrency-tested)
- [ ] 8.5 `POST /api/v1/automation-results` accepts comments + new work items linked to a parent
- [ ] 8.6 `automation_runs` table records every execution
- [ ] 8.7 Publish flow extension: emit automation file(s) into target repo's `.cursor/automations/` (path per 8.1)
- [ ] 8.8 Automation detail page: prompt, next-fires, run history, "run now"
- [ ] 8.9 Seed two automations in `cursor-templates/automations/`: `weekly-security-review`, `weekly-bug-triage`

## 9. Validation pipeline

- [ ] 9.1 Library entry type `validator`: frontmatter `gate`, `command`, `pass_exit_codes`, `output_parser`, `timeout_seconds`
- [ ] 9.2 Runner service: subprocess sandbox — env whitelist, cwd = project target repo, captured + truncated stdout/stderr, kill on timeout
- [ ] 9.3 Parsers: `none`, `junit-xml`, `sarif`, `json-lines` — each producing structured `findings_json`
- [ ] 9.4 Auto-trigger gates on `in_progress` → `in_review` transition; each marked `running` until complete
- [ ] 9.5 Done transition validator: refuses `in_review` → `done` unless all enabled gates have most-recent `pass` (or `skipped`)
- [ ] 9.6 Override-with-reason: non-empty reason, transition proceeds, override record stores failing gate names + reason + user + timestamp
- [ ] 9.7 User-story-acceptance built-in matcher: walks `acceptance_criteria`, matches against test names containing criterion keywords OR `evidence_links`
- [ ] 9.8 `pc validate <id>` / `pc validate <id> --gate <gate>` CLI commands
- [ ] 9.9 `pc comment <id> --kind evidence --criterion <AC-id> <message>` CLI command
- [ ] 9.10 Seed default validators per gate in `cursor-templates/validators/`: `quality` (`npm run lint && npm run typecheck`), `security` (calls `security-review` skill), `bugs` (`npm test`, parser `junit-xml`), `user-story-acceptance` (built-in)
- [ ] 9.11 Validator publish path: `.cursor/validators/<gate>-<slug>.json` in project target repo
- [ ] 9.12 Tests: hung validator killed; failing gate blocks done; override records gates; acceptance matcher matches by keyword

## 10. Discovery workflow

- [ ] 10.1 Schema: `discoveries`, `discovery_drafts`; `source_discovery_id` FK on `work_items`
- [ ] 10.2 API: `POST /api/v1/discoveries`, `GET /api/v1/discoveries`, `GET /api/v1/discoveries/:id`, `PATCH /api/v1/discoveries/:id` (append-only to `raw_dump`), `POST /api/v1/discoveries/:id/generate`
- [ ] 10.3 API: `PATCH /drafts/:id` (edit), `POST /drafts/:id/accept`, `POST /drafts/:id/reject`
- [ ] 10.4 Generator dispatcher: `default` (built-in single-pass prompt, no persona dep) OR named persona (`bill-crouse`/`judy`/`barbara`/`april` if seeded via framework-port)
- [ ] 10.5 Generation execution model: Cursor Automation polls `GET /api/v1/discoveries?status=draft&generation_requested=true`, runs prompt against `raw_dump`, posts drafts via API (matches Decision 6 pull model)
- [ ] 10.6 Accept logic: build resulting work item from `draft_data`, set `source_discovery_id`, set `parent_id` if `parent_draft_id` already accepted; on accept of both ends of `relationship_drafts` entry, insert `relationships` row
- [ ] 10.7 HITL integration: persona files question against discovery → inbox → answer → resume generation
- [ ] 10.8 CLI: `pc discovery new`, `pc discovery generate <id> [--persona <name>]`, `pc discovery list`, `pc discovery show <id>`; supports stdin/pipe
- [ ] 10.9 Seed automation `cursor-templates/automations/discovery-default-pipeline.json`
- [ ] 10.10 Tests: accept-parent-then-children produces correct FK + relationships; regenerate marks pending drafts as superseded; HITL question pauses generation; voice-transcript source preserved

## 11. Skills & rules library — storage

- [ ] 11.1 `data/library/<type>/<slug>.<ext>` file layout under user data dir (`.mdc` for rules, `.md`/folder for skills, `.json` for automations + validators)
- [ ] 11.2 Frontmatter parser + validator (`gray-matter` + Zod schemas per type)
- [ ] 11.3 Library index in SQLite rebuilt from filesystem at startup + on save
- [ ] 11.4 Seed initial library from `cursor-templates/` on first run

## 12. Skills & rules library — UI

- [ ] 12.1 `/library` route browsing entries with name, description, tags, type filter
- [ ] 12.2 `/library/[slug]` route — markdown editor for body + structured form for frontmatter
- [ ] 12.3 Save: validate frontmatter as YAML + Zod, persist file, refresh index
- [ ] 12.4 "New rule" / "New skill" / "New automation" / "New validator" actions starting from per-type template
- [ ] 12.5 Inline validation errors prevent save without losing edits

## 13. Skills & rules library — publish

- [ ] 13.1 "Publish to project" modal: select project (auto-binds to `target_repo_path`), select entries, preview file writes
- [ ] 13.2 Overwrite detection requires per-file confirmation
- [ ] 13.3 Write files into the right `.cursor/<dir>/` per entry type
- [ ] 13.4 Record publish event in `publish_history`
- [ ] 13.5 Publish-history panel on entry detail view

## 14. Portfolio UI — board

- [ ] 14.1 `/board` (cross-project) and `/projects/:slug/board` (project-scoped) routes
- [ ] 14.2 Six columns: `backlog`, `ready`, `in_progress`, `needs-human`, `in_review`, `done` (and `cancelled` hidden behind a filter)
- [ ] 14.3 Card component: type icon, title, assignee, labels, 4-dot validation indicator, `needs-human` question-count badge
- [ ] 14.4 Drag-to-status with optimistic update + rollback; respects allowed transitions
- [ ] 14.5 Filter bar: label, assignee, type, project (top-level only)
- [ ] 14.6 "New item" modal with subtype-aware form

## 15. Portfolio UI — backlog

- [ ] 15.1 `/backlog` and `/projects/:slug/backlog` routes
- [ ] 15.2 Ordered list of `backlog` + `ready` items with drag-to-reorder
- [ ] 15.3 Rank column persisted on reorder
- [ ] 15.4 Bulk "move to ready" action

## 16. Portfolio UI — item detail

- [ ] 16.1 `/items/[id]` route showing all fields, parent link, children list
- [ ] 16.2 Inline edit for title, description (markdown), labels, assignee, acceptance criteria
- [ ] 16.3 Comments thread (markdown render + new-comment form) with mentions rendered as links
- [ ] 16.4 "Pending questions" section above comments thread; answered-questions collapsible
- [ ] 16.5 Status transition controls scoped to allowed next states (includes `needs-human`)
- [ ] 16.6 Validation panel: gate rows, last-run, "Run again", expandable findings
- [ ] 16.7 Related panel: relationships grouped by type with inline add-relationship
- [ ] 16.8 Optional graph view (2 hops default, no toggle clutter)

## 17. Portfolio UI — nav, dashboard, discovery surfaces

- [ ] 17.1 Top-level nav with active portfolio + project context, switcher dropdown
- [ ] 17.2 Breadcrumbs `Portfolio › Project › Item` on every detail page
- [ ] 17.3 `/portfolios` index + `/portfolios/:id` rollup view (project cards with summary stats)
- [ ] 17.4 `/projects/:slug` shell with `/board`, `/backlog`, `/dashboard`, `/settings` sub-routes
- [ ] 17.5 Project settings page (validation toggles, done-checklist gates, target repo path, published library summary)
- [ ] 17.6 `/dashboard` route — 4 sections (Today's focus, Active work, Health [validation pass-rate + bottlenecks], Recent activity); secondary metrics behind progressive disclosure
- [ ] 17.7 `/inbox` global route with grouped sections (questions, mentions, assignments); badge with unread count in nav
- [ ] 17.8 `/discoveries` list + `/discoveries/new` intake + `/discoveries/:id` review page (raw dump on left, drafts grouped by type on right, inline edit, accept/reject, regenerate, append-to-dump)
- [ ] 17.9 Live updates during discovery generation (polling at MVP per design open question)

## 18. `pc` CLI (`packages/cli/`)

- [ ] 18.1 CLI scaffold using `commander` or `citty`; binary registered as `pc`
- [ ] 18.2 Core commands: `pc next [--agent <name>]`, `pc done <id>`, `pc comment <id> <message>`, `pc file <type> <title>`
- [ ] 18.3 HITL commands: `pc ask`, `pc ask --wait`, `pc check-answer`
- [ ] 18.4 Validation commands: `pc validate <id> [--gate <gate>]`, `pc comment <id> --kind evidence --criterion <AC-id> <message>`
- [ ] 18.5 Discovery commands: `pc discovery new`, `pc discovery generate <id> [--persona <name>]`, `pc discovery list`, `pc discovery show <id>`
- [ ] 18.6 Config: `PC_API_URL` (default `http://localhost:3737`), `PC_PROJECT` (default active project), `--project <slug>` override
- [ ] 18.7 Exit codes documented: 0 success; 2 no ready work; 4 ask timeout; 5 unanswered; 1 generic error

## 19. Seed `cursor-templates/`

- [ ] 19.1 `cursor-templates/rules/agent-protocol.mdc` — teaches agent: `pc next` → work → `pc done`
- [ ] 19.2 `cursor-templates/rules/work-item-discipline.mdc` — file new bugs/follow-ups as work items, not TODO comments
- [ ] 19.3 `cursor-templates/skills/` — at least one example skill in proper format (pending 8.1 Cursor docs review)
- [ ] 19.4 `cursor-templates/validators/` — 4 default validators per gate (see 9.10)
- [ ] 19.5 `cursor-templates/automations/` — `discovery-default-pipeline`, `weekly-security-review`, `weekly-bug-triage`

## 20. Docs

- [ ] 20.1 `docs/getting-started.md` — install, run, connect Cursor
- [ ] 20.2 `docs/agent-protocol.md` — how Cursor agents interact with the system
- [ ] 20.3 `docs/multi-user-roadmap.md` — what changes when single-user mode flips
- [ ] 20.4 `docs/design-principles.md` — UI principles per Decision 18
- [ ] 20.5 Top-level `README.md` updated to point at all of the above

## 21. Local dev experience

- [ ] 21.1 `npm run dev` starts Next.js on `:3737`, watches CLI build
- [ ] 21.2 First-run wizard: create data dir, run migrations, seed library, create default portfolio + project
- [ ] 21.3 Health-check endpoint `GET /api/v1/health` returning version + db status
- [ ] 21.4 Clear error on Node version mismatch (per `engines` field)
