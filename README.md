# sdlc-portfolio-manager

A local, single-user-first portfolio + work-item + library manager for agentic SDLC workflows. Designed to plug into [Cursor](https://cursor.com) as the orchestration layer for both you and your agents.

Azure DevOps Boards mental model + Paperclip control-plane ergonomics, but local, lightweight, Cursor-native.

## Getting started

> Full guide: **[docs/getting-started.md](./docs/getting-started.md)**

```bash
pnpm install
pnpm rebuild better-sqlite3       # one-time: builds the native SQLite binding
pnpm dev                          # starts Next.js on http://localhost:3737

# install the pc CLI globally so Cursor agents can call it from anywhere:
cd packages/cli && pnpm build && npm link
pc --help
```

Open <http://localhost:3737> → click **Portfolios** in the top nav → create your first portfolio + project. Set the project's **target repo path** to the folder you open in Cursor. Then publish the seeded `agent-protocol` rule into that repo via **Library → agent-protocol → Publish**. Open the repo in Cursor; agents will start calling `pc` automatically.

## What's seeded on first run

| Type | Count | What they are |
|---|---|---|
| Rules | 2 | `agent-protocol`, `work-item-discipline` — teach Cursor agents to use `pc` |
| Automations | 3 | `weekly-security-review`, `weekly-bug-triage`, `discovery-default-pipeline` |
| Validators | 4 | `quality`, `security`, `bugs`, `user-story-acceptance` |
| Portfolio | 1 | `personal` (default) |
| Project | 1 | `general` (under `personal`) |

Plus four validation gates that fire automatically when a work item enters `in_review`.

## Status

| Capability | State |
|---|---|
| Portfolio + project hierarchy with creation UI | ✅ |
| Work-items API + Kanban board + item detail | ✅ |
| Relationships graph + "Related" panel | ✅ |
| Comments + `@-mentions` (with autocomplete) | ✅ |
| HITL questions + `/inbox` | ✅ |
| Discovery workflow (braindump → draft user stories) | ✅ |
| Library with editor + publish to target repo | ✅ |
| Cursor Automations API contract | ✅ |
| **Validation pipeline gating done** | ✅ |
| `pc` CLI (next, done, ship, comment, file, ask, validate) | ✅ |
| Dashboard with 4 focused sections | ✅ |
| Project-scoped routes (`/projects/<slug>/board`, etc.) | ✅ |

## Concept

Three coupled pillars, one UI:

### 1. Portfolio + projects + work items

Two-level hierarchy: **portfolios → projects → work items**. Each project binds to a target repo; humans and Cursor agents share the work-item store and tag each other for help via HITL questions and `@-mentions`. A unified inbox surfaces everything awaiting your attention.

### 2. Library

A managed library of Cursor rules, skills, automations, validators, and framework docs. Browse, edit, publish into any project's target repo. Agent behavior as a curated, versionable asset — not snippets scattered across repos.

### 3. Discovery + validation

**Discovery:** dump unstructured thoughts; the system generates draft user stories with acceptance criteria, value/complexity scores, parallelization sketches. Review, edit, accept; accepted drafts become real work items wired up via the relationships graph.

**Validation:** every work item must pass four configurable gates before `done` — **quality**, **security**, **bugs**, **user-story-acceptance**. Each gate is a sandboxed validator from the library. Override with a reason if you need to (recorded with audit trail).

## Architecture

```
sdlc-portfolio-manager/
├── apps/portfolio/       # Next.js (App Router) + SQLite (better-sqlite3 + Drizzle)
├── packages/cli/         # `pc` CLI invoked by Cursor agents (and humans)
├── cursor-templates/     # Seeded library content
│   ├── rules/            # agent-protocol, work-item-discipline
│   ├── skills/           # (placeholder)
│   ├── automations/      # weekly-security-review, weekly-bug-triage, discovery-default-pipeline
│   └── validators/       # quality, security, bugs, user-story-acceptance
├── docs/
│   ├── getting-started.md       # ← start here
│   ├── cursor-setup.md          # wire Cursor agents to talk to this
│   └── design-principles.md     # UI rules (Jony Ive-influenced restraint)
└── openspec/             # Spec-driven change history
```

## Design principles

Eight principles in [docs/design-principles.md](./docs/design-principles.md) — drawn from Jony Ive's restraint at Apple, the Linear / Notion / Things 3 product design school, and accessibility good practice:

1. Quiet by default
2. One canonical surface per concept
3. Progressive disclosure
4. Direct manipulation over modal dialogs
5. Keyboard-first
6. Honest materials
7. Care in every empty state and every error
8. Consistency over novelty

## Engineering principles

- **Local-first** — SQLite at `~/.sdlc-portfolio-manager/data.sqlite`, no network, no SaaS dependency
- **Single-user now, multi-user later** — UUIDs, `user_id` + `project_id` scoping from day one; auth stubbed to `local-user`
- **Cursor-native, not Cursor-only** — Rules, Skills, Automations, and Background Agents are first-class; clean REST + CLI surface allows other clients
- **OpenSpec-driven** — every change goes through proposal → design → specs → tasks → implement → archive
- **Standalone shippable** — `initial-portfolio-manager` is self-contained; `agentic-sdlc-framework-port` (port of 19 personas + 5-layer memory + framework docs) is additive value, never a hard dependency

## Trust + security

The validation pipeline runs shell commands you (or other agents) define in validator entries. **Anyone who can edit your library can execute code on your machine** when validation fires. At MVP that's just you. If you ever expose the UI beyond your machine, disable validators or sandbox properly. See [docs/getting-started.md](./docs/getting-started.md#trust-model--read-before-turning-on-validators).

## License

TBD
