# sdlc-portfolio-manager

A local, single-user-first portfolio + work-item + library manager for agentic SDLC workflows. Designed to plug into [Cursor](https://cursor.com) as the orchestration layer for both you and your agents.

Azure DevOps Boards mental model + Paperclip control-plane ergonomics, but local, lightweight, Cursor-native.

## Status

Pre-alpha. Spec-driven via [OpenSpec](https://github.com/Fission-AI/OpenSpec).

- **`initial-portfolio-manager`** — founding change, 11 capabilities, ships standalone
- **`agentic-sdlc-framework-port`** — additive change that ports 19 agent personas, the 5-layer memory protocol, framework knowledge, planning artifacts, and quality systems from `~/agentic-sdlc/`

See `openspec/changes/<change-id>/` for proposal, design, specs, and task lists.

## Concept

Three coupled pillars, one UI:

### 1. Portfolio + projects + work items

Two-level hierarchy: **portfolios → projects → work items**. Each project binds to a target repo; humans and Cursor agents share the work-item store and tag each other for help via HITL questions and `@-mentions`. A unified inbox surfaces everything awaiting your attention.

### 2. Library

A managed library of Cursor rules, skills, automations, validators, and framework docs. Browse, edit, publish into any project's target repo. Treat agent behavior like reusable, versionable assets — not snippets scattered across repos.

### 3. Discovery + validation

Discovery: dump unstructured thoughts; the system generates draft user stories with acceptance criteria, value/complexity scores, parallelization sketches — you review, edit, accept; accepted drafts become real work items wired up via the relationships graph.

Validation: every work item must pass four configurable gates before `done` — **quality**, **security**, **bugs**, **user-story-acceptance**. Each gate is a sandboxed validator from the library. Override with a reason if you need to.

## Architecture (planned)

```
sdlc-portfolio-manager/
├── apps/portfolio/       # Next.js (App Router) + SQLite (better-sqlite3 + Drizzle)
├── packages/cli/         # `pc` CLI invoked by Cursor agents
├── cursor-templates/     # Seed rules / skills / automations / validators
│   ├── rules/
│   ├── skills/
│   ├── automations/
│   └── validators/
├── docs/                 # design-principles.md, getting-started, agent-protocol
└── openspec/             # Spec-driven change history
```

## Design principles

UI decisions follow eight principles in `docs/design-principles.md` — drawn from Jony Ive's restraint at Apple, the Linear / Notion / Things 3 product design school, and accessibility good practice. In one line each:

1. **Quiet by default** — restrained color, generous whitespace, type carries hierarchy
2. **One canonical surface per concept** — no same-data-three-ways
3. **Progressive disclosure** — essentials on first paint, depth on intent
4. **Direct manipulation over modal dialogs** — drag, inline-edit, side panels
5. **Keyboard-first** — every action reachable from the keyboard
6. **Honest materials** — web conventions, not fake desktop chrome
7. **Care in every empty state and every error** — empty states explain the next step
8. **Consistency over novelty** — same widget for the same concept everywhere

## Engineering principles

- **Local-first** — SQLite, no network, no SaaS dependency
- **Single-user now, multi-user later** — UUIDs, `user_id` and `project_id` scoping from day one; auth stubbed to `local-user`
- **Cursor-native, not Cursor-only** — Rules, Skills, Automations, and Background Agents are first-class; clean REST + CLI surface allows other clients (Claude Code, raw API)
- **OpenSpec-driven** — every change goes through proposal → design → specs → tasks → implement → archive
- **Standalone shippable** — `initial-portfolio-manager` is self-contained; `agentic-sdlc-framework-port` is additive value, never a hard dependency

## Getting started

```bash
pnpm install
pnpm rebuild better-sqlite3   # one-time: builds the native SQLite binding
pnpm dev                       # starts Next.js on http://localhost:3737
```

First request runs migrations and seeds the `personal` portfolio + `general` project automatically. Data lives at `~/.sdlc-portfolio-manager/data.sqlite` (override with `SDLC_DATA_DIR`).

### Running tests

```bash
pnpm test         # vitest, one shot
pnpm test:watch
```

### Current status

| Section | State |
|---------|-------|
| 1. Monorepo + toolchain | ✅ |
| 2. Database layer (schema, migrations, auth) | ✅ partial — foundational tables (portfolios, projects, work_items, comments, library_entries, relationships, \_migrations) |
| 3. Portfolio + project hierarchy API | ✅ CRUD + first-run seed + health endpoint |
| 4–21 | tracked in `openspec/changes/initial-portfolio-manager/tasks.md` |

Implementation tracked task-by-task in `openspec/changes/initial-portfolio-manager/tasks.md`.

## License

TBD
