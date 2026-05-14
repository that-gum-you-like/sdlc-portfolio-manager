# Getting started

## Prerequisites

- Node.js ≥ 22 (Node 25 also works)
- pnpm ≥ 10
- A C++ toolchain for the better-sqlite3 native bindings: `make`, `g++`,
  `python3`. On Linux: `sudo apt-get install build-essential python3`. On
  macOS: `xcode-select --install`.

## First run

```bash
git clone https://github.com/that-gum-you-like/sdlc-portfolio-manager
cd sdlc-portfolio-manager
pnpm install
pnpm rebuild better-sqlite3   # one-time: builds the native SQLite binding
pnpm dev                      # starts Next.js on http://localhost:3737
```

On first request the server runs migrations, creates `~/.sdlc-portfolio-manager/data.sqlite`,
and seeds:

- a `personal` portfolio
- a `general` project under it
- the 4 validator entries (`quality`, `security`, `bugs`, `user-story-acceptance`)
- the 3 automation entries (`weekly-security-review`, `weekly-bug-triage`,
  `discovery-default-pipeline`)
- the 2 rule entries (`agent-protocol`, `work-item-discipline`)

Open http://localhost:3737. Click **Portfolios** in the top nav. You'll see
the default `personal` portfolio with the `general` project inside.

## Install the `pc` CLI globally

Cursor agents call `pc` from inside your repo. Make it globally available:

```bash
cd packages/cli
pnpm build
pnpm link --global
pc --help
```

After this, `pc` is on your PATH from any directory.

## Wire your first real project

1. **Create a portfolio** at <http://localhost:3737/portfolios/new> (e.g.
   "Work" or "Personal").
2. **Create a project** at <http://localhost:3737/projects/new> inside that
   portfolio. The **target repo path** field is important — it's the absolute
   path on this machine to the codebase you're working in. Set it to the
   folder you open in Cursor.
3. **Publish the seeded rules** to your target repo:
   - Open <http://localhost:3737/library?type=rule>
   - Click `agent-protocol` → Publish to your project → tick "Overwrite if file
     already exists" → Publish. The file lands at
     `<your-repo>/.cursor/rules/agent-protocol.mdc`.
   - Repeat for `work-item-discipline`.
4. **Open your repo in Cursor.** The agents will pick up the rules and start
   following the protocol — they'll call `pc next`, `pc ask`, `pc done`,
   `pc ship` as documented.

## Daily use

| You want to | Do this |
|---|---|
| Talk out loud and have the system file user stories | <http://localhost:3737/discoveries/new> |
| See what's waiting on you | <http://localhost:3737/inbox> |
| See the Kanban for a specific project | `/projects/<slug>/board` |
| Move things around the backlog | `/projects/<slug>/backlog` |
| Edit a rule or validator | <http://localhost:3737/library> |

## Data + backups

Everything lives in **`~/.sdlc-portfolio-manager/data.sqlite`** (and the
sibling `data.sqlite-wal` + `data.sqlite-shm` while the server is running).

User-edited library entries live in **`~/.sdlc-portfolio-manager/library/`**.

To back up: stop the server, copy both directories somewhere safe, restart.
SQLite writes are atomic per transaction so consistent backups while
running are also possible by issuing `VACUUM INTO`.

To start fresh: stop the server, `rm -rf ~/.sdlc-portfolio-manager`, restart
— first-run seed runs again.

To use a non-default data directory, set `SDLC_DATA_DIR=/path/to/dir` before
starting.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `3737` | Next.js port |
| `SDLC_DATA_DIR` | `~/.sdlc-portfolio-manager` | Where SQLite + user library live |
| `SDLC_TEMPLATES_DIR` | (auto-detected from cwd) | Where seeded library lives (`cursor-templates/` in this repo) |
| `PC_API_URL` | `http://localhost:3737` | Where `pc` talks to |
| `PC_AGENT` | `cursor-bg` | Agent identity recorded on claim/comment/ask |
| `PC_PROJECT` | (none) | Project slug to scope `pc` against |

## Trust model — read before turning on validators

The validation pipeline runs **shell commands you (or other agents) put into
validator entries**. Validators are stored in your library and run as the
user running the dev server, in the project's target repo path, with a
whitelisted environment (PATH, HOME, LANG, LC_ALL, NODE_ENV).

This means:

- Anyone who can write to your library can run arbitrary code on your
  machine. At MVP it's just you + your agents — fine. If you ever expose the
  UI to others, **disable validators** or sandbox them properly.
- Per-validator timeouts are enforced (default 300s) but a malicious command
  can still touch your filesystem within that window. Audit any validator
  you didn't write.
- Agents calling `pc` cannot directly write validator entries — they go
  through the library editor, which a human controls.

## What's next

- Read [cursor-setup.md](./cursor-setup.md) for Cursor Automations setup
- Read [design-principles.md](./design-principles.md) for the UI rules I
  use when adding features
- Open `openspec/changes/` for the active spec and roadmap
