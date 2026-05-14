# sdlc-portfolio-manager

A local, single-user-first portfolio and work-item manager for agentic SDLC workflows — designed to plug into [Cursor](https://cursor.com) (and other AI coding agents) as the orchestration layer.

Think Azure DevOps boards + Paperclip control plane, but local, lightweight, and Cursor-native.

## Status

Pre-alpha. Spec-driven via [OpenSpec](https://github.com/Fission-AI/OpenSpec) — see `openspec/changes/initial-portfolio-manager/` for the founding proposal.

## Concept

Two stacked capabilities, one UI:

### 1. Work-item portfolio

You and your Cursor agents share a single work-item store. Humans and agents both:

- File user stories, bugs, and tasks
- Pick up work, update status, leave comments
- Link parent/child items, label, prioritize

Cursor's **Background Agents** drain the queue autonomously. You watch progress on a local Kanban board.

### 2. Skills & Rules library

A managed library of Cursor **rules** (`.cursor/rules/*.mdc`) and **skills** that you (and eventually teammates) can browse, edit, version, and publish into target repos from the UI. Think of it as a package manager + editor for agent behavior:

- Browse the library by tag, glob, or persona
- Edit rules in-app with markdown + frontmatter validation
- Publish a curated set into any target repo (writes the `.cursor/rules/` directory)
- (Backlog) Team contributions, review/approval, versioning, sharing across repos

## Architecture (planned)

```
sdlc-portfolio-manager/
├── apps/portfolio/       # Next.js + SQLite — UI + REST API
│   ├── work-items/       # Stories, bugs, tasks, board, backlog
│   └── library/          # Skills & rules editor + publisher
├── packages/cli/         # `pc` CLI invoked by Cursor agents
├── cursor-templates/     # Seed rules/skills shipped with the product
├── docs/                 # Architecture, usage, migration notes
└── openspec/             # Spec-driven change history
```

## Design principles

- **Local-first**: SQLite, no network, no SaaS dependency
- **Single-user now, multi-user later**: UUIDs and `user_id` scoping from day one; auth stubbed
- **Cursor-native**: Rules + Background Agents are first-class; other clients (Claude Code, CLI, raw API) are second-class
- **OpenSpec-driven**: Every change goes through proposal → design → specs → tasks → implement

## Getting started

Not yet — see the initial OpenSpec change for the bootstrap plan.

## License

TBD
