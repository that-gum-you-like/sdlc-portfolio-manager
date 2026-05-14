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

---

## Explicitly deferred from agentic-sdlc parity (Cursor handles or scope-out)

The following exist in `~/agentic-sdlc/` and are **not** being ported to `sdlc-portfolio-manager`. Reasons noted per item.

### Handled by Cursor itself
- **LLM adapter system** (anthropic, azure-foundry, azure-openai, openai, gemini, groq, cerebras, ollama) — Cursor selects the model
- **Model intelligence database / cost-aware routing / predictive model swaps / fallback chains** — Cursor handles
- **Voice intake** (Groq Whisper, voice-intake.sh, voice-config.json) — Cursor has dictation
- **Token-level cost tracking** (`cost-tracker.mjs`) — Cursor bills directly; we only see work-item-level outcomes

### Scope-out for portfolio manager
- **Matrix protocol communication** (`matrix-client/matrix-cli.mjs`) — out of scope for a portfolio manager
- **WhatsApp ↔ OpenClaw bridge** (`mailbox-sync.mjs`) — out of scope; Bryce's personal setup
- **Paperclip orchestration adapter** (`paperclip.mjs`, `paperclip-sync.mjs`) — sister product, not absorbed
- **Setup wizard for new target repos** (`setup.mjs` 37K-line interactive scaffolder) — publish-to-repo flow covers the MVP need
- **Autonomous launcher** (`autonomous-launcher.sh`) — Claude-Code-specific

### Deferred to follow-up (post-MVP) openspec changes
- **Pattern hunt** (`pattern-hunt.mjs`) — review-comment clustering, defeat-test proposals. High value but needs ML infra (sentence-transformers embeddings); revisit after MVP usage
- **Inter-agent schema validator** (`schema-validator.mjs`) — JSON Schema validation of inter-agent data contracts; defer until multi-agent contracts emerge
- **Agent prompt version snapshots** (`version-snapshot.mjs`) — full evolution history of AGENT.md changes; backlog until library has version history capability
- **AST anti-pattern scanner** (`four-layer-validate.mjs`, `ast-analyzer.mjs`) — defer; project-side concern, not portfolio-manager concern
- **Behavior testing harness** (`test-behavior.mjs`) — agent prompt quality / maturation regression tests; revisit when persona authoring becomes routine
- **Migrate-memory tool** (`migrate-memory.mjs`) — needed once persona prompt schemas evolve; build when needed
- **Semantic memory index** (`semantic-index.mjs`, `embed.py`) — vector search over memory; defer until memory volume justifies it
- **Roadmap gardening** (`garden-roadmap.mjs`) — auto-archive completed roadmap items; trivial to add post-MVP
- **Wellness checks / human ergonomics** — session hours, wellness mailbox commands; backlog
- **PM model performance JSONL** — token-level decision log; backlog (depends on cost-tracker which is out of scope)
