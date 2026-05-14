## 0. Portfolio > Project hierarchy (foundational — comes before work-items table)

- [ ] 0.1 Schema: `portfolios` table (`id`, `user_id`, `name`, `description`, `created_at`, `updated_at`)
- [ ] 0.2 Schema: `projects` table (`id`, `portfolio_id`, `name`, `slug`, `description`, `target_repo_path`, `settings_json`, `created_at`, `updated_at`); unique index on `(portfolio_id, slug)`
- [ ] 0.3 Add `project_id` FK to `work_items`, `comments`, `questions`, `library_entries` (nullable for cross-project), `publish_history`, `validation_runs`, `automation_runs`, `notifications`, `mentions`
- [ ] 0.4 Migration 0001 creates portfolios + projects + all FK additions in correct order
- [ ] 0.5 First-run seeds `personal` portfolio and `inbox` project under `local-user`
- [ ] 0.6 API routes: `GET/POST /api/v1/portfolios`, `GET/PATCH/DELETE /api/v1/portfolios/:id`, `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/:slug`
- [ ] 0.7 Cascade delete: removing a project removes all dependent rows in a single transaction (integration test)
- [ ] 0.8 UI: `/portfolios` index, `/portfolios/:id` detail with project cards, `/projects/:slug` shell with sub-routes (`/board`, `/backlog`, `/dashboard`, `/settings`)
- [ ] 0.9 UI: top-level nav with active portfolio + project, switcher dropdown
- [ ] 0.10 UI: breadcrumbs `Portfolio › Project › Item` on every relevant page
- [ ] 0.11 UI: project settings page (validation toggles, done-checklist gates, target repo path, published library entries summary)
- [ ] 0.12 API client (used by CLI): respect a `--project <slug>` flag and/or `PC_PROJECT` env var

## 1. Monorepo + toolchain

- [ ] 1.1 Add root `package.json` with workspaces (`apps/*`, `packages/*`) and `engines.node >= 22`
- [ ] 1.2 Add `pnpm-workspace.yaml` or npm workspaces config; choose package manager
- [ ] 1.3 Configure shared TypeScript base config (`tsconfig.base.json`) and per-package extends
- [ ] 1.4 Add ESLint + Prettier configs at root; wire into each workspace
- [ ] 1.5 Add `vitest` config at root for shared test setup

## 2. Database layer (`apps/portfolio/src/db/`)

- [ ] 2.1 Install `better-sqlite3`, `drizzle-orm`, `drizzle-kit`
- [ ] 2.2 Define Drizzle schema: `work_items`, `comments`, `labels`, `work_item_labels`, `library_entries`, `publish_history`, `_migrations`
- [ ] 2.3 Add `user_id` column with default `local-user` on every user-owned table
- [ ] 2.4 Configure UUIDv4 default for all `id` columns
- [ ] 2.5 Write migration 0001 (initial schema) and migration runner that records to `_migrations`
- [ ] 2.6 Add `auth.ts` with `currentUser()` returning constant `local-user` in single-user mode
- [ ] 2.7 Integration test: insert + read survives process restart, `user_id` always populated

## 3. Work-items API (`apps/portfolio/src/app/api/v1/work-items/`)

- [ ] 3.1 `GET /api/v1/work-items` with filters: `status`, `type`, `assignee`, `label`, `parent_id`
- [ ] 3.2 `POST /api/v1/work-items` — create with type, title, description, parent_id (optional), labels, assignee
- [ ] 3.3 `GET /api/v1/work-items/:id` — single item with parent + children embedded
- [ ] 3.4 `PATCH /api/v1/work-items/:id` — partial update, validate status transitions
- [ ] 3.5 `POST /api/v1/work-items/:id/claim` — atomic claim transitioning ready → in_progress
- [ ] 3.6 Cycle detection on parent assignment (self + descendant rejection)
- [ ] 3.7 Standard error contract: `{ error, message, details }` with appropriate HTTP codes
- [ ] 3.8 Integration tests: each scenario in `specs/work-items/spec.md` becomes a test

## 4. Comments API

- [ ] 4.1 `POST /api/v1/work-items/:id/comments` — append comment with author + markdown body
- [ ] 4.2 `GET /api/v1/work-items/:id/comments` — chronological listing
- [ ] 4.3 Integration test: comment from agent author persists with timestamp

## 5. Portfolio UI — board

- [ ] 5.1 `/board` route rendering five columns (`backlog`, `ready`, `in_progress`, `in_review`, `done`)
- [ ] 5.2 Card component showing type icon, title, assignee, labels
- [ ] 5.3 Drag-and-drop between columns triggering PATCH; optimistic update + rollback on error
- [ ] 5.4 Filter bar: by label, assignee, type
- [ ] 5.5 "New item" modal posting to API

## 6. Portfolio UI — backlog

- [ ] 6.1 `/backlog` route rendering ordered list of `backlog` + `ready` items
- [ ] 6.2 Rank field on work items; drag-to-reorder persists new rank
- [ ] 6.3 Bulk "move to ready" action

## 7. Portfolio UI — item detail

- [ ] 7.1 `/items/[id]` route showing all fields, parent link, children list
- [ ] 7.2 Inline edit for title, description (markdown), labels, assignee
- [ ] 7.3 Comments thread with markdown rendering + new-comment form
- [ ] 7.4 Status transition controls scoped to allowed next states

## 8. Skills & rules library — storage

- [ ] 8.1 `data/library/<type>/<slug>.mdc` file layout under user data dir
- [ ] 8.2 Frontmatter parser/validator (`gray-matter` + `zod` schema for known fields)
- [ ] 8.3 Library index in SQLite rebuilt from filesystem at startup + on save
- [ ] 8.4 Seed initial library from `cursor-templates/` on first run

## 9. Skills & rules library — UI

- [ ] 9.1 `/library` route browsing entries with name, description, tags
- [ ] 9.2 `/library/[slug]` route with markdown body editor + structured frontmatter form
- [ ] 9.3 Save action: validate frontmatter as YAML, persist file, refresh index
- [ ] 9.4 "New rule" / "New skill" actions starting from template
- [ ] 9.5 Inline validation errors that prevent save without losing edits

## 10. Skills & rules library — publish

- [ ] 10.1 "Publish to repo" modal: select target repo path, select entries, preview file writes
- [ ] 10.2 Detect overwrites and require per-file confirmation
- [ ] 10.3 Write `.mdc` files into target's `.cursor/rules/` or `.cursor/skills/`
- [ ] 10.4 Record publish event in `publish_history` (entry id, target path, timestamp)
- [ ] 10.5 Publish-history panel on entry detail view

## 11. `pc` CLI (`packages/cli/`)

- [ ] 11.1 CLI scaffold using `commander` or `citty`; binary registered as `pc`
- [ ] 11.2 `pc next --agent <name>` — claim next ready task, print parseable summary
- [ ] 11.3 `pc done <id>` — set status to in_review
- [ ] 11.4 `pc comment <id> <message>` — post comment (stdin supported for long bodies)
- [ ] 11.5 `pc file <type> <title>` — create work item, print new id
- [ ] 11.6 Config: `PC_API_URL` env var, default `http://localhost:3737`
- [ ] 11.7 Exit codes documented; `pc next` exits 2 on no-ready-work

## 12. Seed Cursor rules in `cursor-templates/`

- [ ] 12.1 `cursor-templates/rules/agent-protocol.mdc` — teaches agent to call `pc next`, work the task, `pc done`
- [ ] 12.2 `cursor-templates/rules/work-item-discipline.mdc` — file new bugs/follow-ups as work items, not as TODO comments
- [ ] 12.3 `cursor-templates/skills/<seed-skill>/` — at least one example skill, with SKILL.md + scripts if needed (pending confirmation of Cursor skill format)

## 13. Docs

- [ ] 13.1 `docs/getting-started.md` — install, run, connect Cursor
- [ ] 13.2 `docs/agent-protocol.md` — how Cursor agents interact with the system
- [ ] 13.3 `docs/multi-user-roadmap.md` — what changes when we switch off single-user mode
- [ ] 13.4 Top-level `README.md` updated to point at all of the above

## 14. Local dev experience

- [ ] 14.1 `npm run dev` starts Next.js on `:3737` and watches CLI build
- [ ] 14.2 First-run: create data dir, run migrations, seed library
- [ ] 14.3 Health-check endpoint `GET /api/v1/health` returning version + db status

## 14b. Validation pipeline

- [ ] 14b.1 Schema: `validation_runs` (`id`, `work_item_id`, `project_id`, `gate`, `validator_entry_id`, `started_at`, `completed_at`, `status`, `exit_code`, `stdout_snippet`, `stderr_snippet`, `findings_json`)
- [ ] 14b.2 Schema: `evidence_links` (`id`, `comment_id`, `acceptance_criterion_id`, `criterion_text_snapshot`) — connects evidence comments to specific acceptance criteria
- [ ] 14b.3 Extend `library_entries.type` enum: add `validator` alongside `rule`, `skill`, `automation`
- [ ] 14b.4 Validator frontmatter schema with Zod: `gate` enum, `command` template, `pass_exit_codes` array, `output_parser` enum, `timeout_seconds` int
- [ ] 14b.5 Runner service: subprocess with timeout, env whitelist, working dir = project target repo, captured stdout/stderr (truncated to N KB), parsed output per `output_parser`
- [ ] 14b.6 Parsers: `none`, `junit-xml`, `sarif`, `json-lines` — each producing a structured `findings_json` shape
- [ ] 14b.7 Auto-trigger gates on `in_progress` → `in_review` transition; mark each `running` until complete
- [ ] 14b.8 `pc validate <id>` / `pc validate <id> --gate <gate>` CLI commands
- [ ] 14b.9 `pc comment <id> --kind evidence --criterion <AC-id> <message>` CLI command writing an evidence-linked comment
- [ ] 14b.10 Done transition validator: enabled gates must have most-recent status `pass` (or `skipped`); else 400 with gate names
- [ ] 14b.11 Override path: existing override-with-reason mechanism records the failing gate(s)
- [ ] 14b.12 User-story-acceptance built-in matcher: walk acceptance_criteria, match against (a) test names containing criterion keywords, (b) evidence comments linked via `evidence_links`
- [ ] 14b.13 Seed default validators per gate (quality, security, bugs, user-story-acceptance) in `cursor-templates/validators/`
- [ ] 14b.14 Validator publish path: write to project target repo at `.cursor/validators/<gate>-<slug>.json`
- [ ] 14b.15 UI: validation panel on item detail page with gate rows, last-run, "Run again" actions, expandable run detail
- [ ] 14b.16 UI: board card gate-status indicator (four colored dots)
- [ ] 14b.17 Tests: hung validator killed at timeout; failing gate blocks done; override records gate names; acceptance matcher matches by keyword

## 15. Human-in-the-loop (HITL) thread

- [ ] 15a.1 Schema: `questions` table (`id`, `work_item_id`, `asked_by`, `addressed_to`, `body`, `status`, `asked_at`, `answered_at`, `answer_id`, `previous_status`)
- [ ] 15a.2 Schema: `notifications` table (`id`, `recipient`, `kind`, `source_id`, `work_item_id`, `created_at`, `read_at`)
- [ ] 15a.3 Schema: `mentions` table (`id`, `source_type`, `source_id`, `mentioned_handle`, `resolved_user_id`, `resolved_agent_name`)
- [ ] 15a.4 Status enum extended with `needs-human`; transition validator handles entering + restoring
- [ ] 15a.5 `POST /api/v1/work-items/:id/questions` — file a question; transition item to needs-human
- [ ] 15a.6 `POST /api/v1/questions/:id/answer` — answer; auto-restore work item to `previous_status` when all open questions on the item resolve
- [ ] 15a.7 `GET /api/v1/questions?recipient=<handle>&status=open` — power the inbox
- [ ] 15a.8 `@-mention` parser (regex + handle resolver against users + personas); shared across comments and questions
- [ ] 15a.9 Mention extraction runs on every comment/question write; inserts `mentions` and `notifications` rows
- [ ] 15a.10 CLI `pc ask <id> <message>` (with `--wait <seconds>` blocking variant, exit code 4 on timeout)
- [ ] 15a.11 CLI `pc check-answer <question-id>` (exit code 5 if unanswered)
- [ ] 15a.12 `pc next` response payload extended with `pending_answers` for the claiming agent
- [ ] 15a.13 UI: Kanban board adds `needs-human` column with question-count badge per card
- [ ] 15a.14 UI: item detail page renders "Pending questions" section + answered-questions collapsible
- [ ] 15a.15 UI: mentions rendered as clickable links to user/agent detail pages
- [ ] 15a.16 UI: `/inbox` route with grouped sections (questions, mentions, assignments)
- [ ] 15a.17 UI: global nav inbox badge with unread count, polled or via SSE/websocket (pick simplest first)
- [ ] 15a.18 Notification channel interface — `in-app` impl now; webhook/email/WA later as no-op stubs
- [ ] 15a.19 Tests: ask-answer round trip transitions status correctly; multiple-questions hold needs-human; mention parser handles edge cases (code blocks, escape, unknown handle)

## 16. Cursor Automations integration

- [ ] 16.1 Confirm Cursor Automations on-disk format (consult Cursor docs); document the file path + JSON schema before locking the publish writer
- [ ] 16.2 Extend `library_entries.type` enum to include `automation` alongside `rule` and `skill`
- [ ] 16.3 Automation frontmatter schema: `prompt` (markdown), `cron` (string), `scope` (repo/labels/globs), `resultHook` (enum: `file-findings-as-bugs` | `comment-only` | `custom`)
- [ ] 16.4 Cron expression validation in the editor + on save
- [ ] 16.5 `GET /api/v1/work-items/next-ready` with atomic claim semantics (see specs/cursor-automations)
- [ ] 16.6 `POST /api/v1/automation-results` accepting comments + new work items linked to a parent
- [ ] 16.7 `automation_runs` table: `id`, `automation_entry_id`, `started_at`, `completed_at`, `status`, `summary`, `created_item_ids`
- [ ] 16.8 Publish flow extension: emit Cursor Automation file(s) into target repo and record `publish_history` row
- [ ] 16.9 Automation-detail page: prompt, cron next-fires, run history list, manual "run now" trigger (sends the prompt to Cursor via documented mechanism — TBD in 16.1)
- [ ] 16.10 Seed two automations in `cursor-templates/`: `weekly-security-review` and `weekly-bug-triage`
- [ ] 16.11 Concurrency test: two `next-ready` calls vs one ready item — exactly one wins
