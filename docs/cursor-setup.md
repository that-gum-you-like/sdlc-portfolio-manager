# Cursor setup

This explains how to wire Cursor agents to talk to the local
sdlc-portfolio-manager.

## Foreground Cursor agents

These are the agents you trigger from the Cursor sidebar / chat. They run
locally in your environment.

1. **Make sure `pc` is on PATH** (see [getting-started.md](./getting-started.md))
2. **Set per-project env vars.** In your repo's `.cursor/env` or the
   project's environment settings:
   ```
   PC_API_URL=http://localhost:3737
   PC_PROJECT=<your-project-slug>
   PC_AGENT=cursor-fg
   ```
   `<your-project-slug>` is the slug you chose at
   <http://localhost:3737/projects/new>.
3. **Publish the rules** from the library into your repo. From
   <http://localhost:3737/library?type=rule>:
   - Open `agent-protocol` → Publish to your project (or to an explicit path
     `<your-repo>`)
   - Open `work-item-discipline` → Publish similarly
4. **Test it.** In Cursor, ask the agent: *"What work is ready for me?"* —
   the agent should run `pc next` and tell you what it claimed.

## Cursor Background Agents

Cursor's Background Agents run in cloud sandboxes. They can call your
local sdlc-portfolio-manager only if your manager is reachable from
Cursor's cloud. Two ways:

### A) Tunnel option (recommended for personal use)

Use `cloudflared`, `ngrok`, or similar to expose
`http://localhost:3737` over a stable HTTPS URL:

```bash
cloudflared tunnel --url http://localhost:3737
```

Then set `PC_API_URL` to that tunnel URL on the Background Agent runner.

**Security**: anyone with the URL can read/write your work items. Use
cloudflared's Access policy or a long random subdomain. Don't expose
validator endpoints (`/api/v1/work-items/:id/validate`) over the public
tunnel without auth — they execute shell commands.

### B) Local-only mode (recommended for work)

Don't use Background Agents. Use only foreground agents. Trade-off:
unattended work via cron is off, but everything is local-private. Bonus:
nothing to explain to IT.

## Cursor Automations (cron-scheduled prompts)

Cursor Automations run prompts on a schedule. Wire them to the manager:

1. **Find the Cursor Automations setup UI** in Cursor's settings (the exact
   path is in flux — check Cursor's docs for the current location).
2. **Create a new automation** with the prompt + cron from one of your
   seeded entries. Example for `weekly-security-review`:
   - Prompt: paste the body from
     <http://localhost:3737/automations/weekly-security-review>
   - Schedule: `0 9 * * MON`
   - Working directory: your target repo path
   - Post-run hook: tell the automation to `POST` results back to
     `http://localhost:3737/api/v1/automation-results` with
     `automationSlug=weekly-security-review` and `parentWorkItemId=<id>`
3. **Verify** by triggering a manual run and watching
   <http://localhost:3737/automations/weekly-security-review> for the
   recorded run.

The on-disk format Cursor expects for automations is in flux as of writing
— check the open question in `openspec/changes/initial-portfolio-manager/design.md`
under Decision 6. Once we confirm the format, the library publish flow
will write automation files directly into the target repo.

## Identifying which project an agent is working in

In Cursor's interface, every agent is associated with a workspace (folder).
You bind that folder to a project in this UI via the project's
`target_repo_path`. Agents calling `pc` will:

1. Use `PC_PROJECT` if set (preferred — explicit)
2. Otherwise, call `GET /api/v1/projects/resolve?repoPath=<cwd>` to find the
   matching project automatically

Either way, the manager UI's **breadcrumb shows the active project context**
on every `/projects/<slug>/...` page so you (the human) always know what
project a work item belongs to when you click in.

## Troubleshooting

| Symptom | Likely cause + fix |
|---|---|
| `pc next` returns `agent_required` | Set `PC_AGENT=<name>` or pass `--agent <name>` |
| `pc next` returns 404 `project_not_found` | Set `PC_PROJECT=<slug>` or bind `target_repo_path` in Project → Settings |
| `pc ship` returns `validation_gates_failing` | Run `pc validation-status <id>` to see which gates failed; fix them or override with `--override-reason "..."` |
| Background agent can't reach `localhost:3737` | Set up a tunnel (see above) or use foreground-only |
| UI shows wrong project when item created via `pc file` | Pass `--project <slug>` to the CLI, or set `PC_PROJECT` |
