# Multi-agent orchestrator research → proposals

**Date**: 2026-05-14
**Lens**: What can `sdlc-portfolio-manager` borrow from the broader multi-agent ecosystem? The vision is **ADO meets Paperclip** — we already have the boards + control-plane shape; this doc surveys what's hot elsewhere and proposes concrete additions.

---

## 1 / Vendor scan (May 2026)

### Microsoft Foundry Agent Service (formerly Azure AI Foundry)

The 800-pound enterprise gorilla. Reached GA in early 2026 with **Multi-Agent Workflows** (stateful orchestration layer that maintains context across agents) and **Connected Agents** (point-to-point delegation). Ships a **visual workflow builder** and a **Microsoft Agent Framework** SDK (Python + .NET, unified across Azure). Notable: **hosted agents in isolated sandboxes with persistent filesystems, Entra identities, scale-to-zero pricing** — and explicit support for plugging in LangGraph, Claude Agent SDK, OpenAI Agents SDK, GitHub Copilot SDK as the underlying agent runtime.

### AWS Bedrock Multi-Agent Collaboration

GA in 2025. **Supervisor pattern**: designate one agent as supervisor, attach N collaborators with non-overlapping responsibilities. Two modes: **routing mode** (simple queries → straight to specialist), **supervisor mode** (complex queries → plan + decompose + delegate). Each agent has its own tools, action groups, knowledge bases, and guardrails. Parallel sub-agent execution is first-class.

### OpenAI Agents SDK + AgentKit

Swarm was educational; the **OpenAI Agents SDK** (released Mar 2025) is the production successor. Three primitives: `Agents` (LLM + instructions + tools), `Handoffs` (explicit agent-to-agent delegation), `Guardrails` (pre/post-action policy enforcement). **AgentKit** layers on: **Agent Builder** (visual canvas + versioning), **Connector Registry** (central admin of how data/tools connect), **ChatKit** (embeddable agent chat UI).

### HuggingFace smolagents

Open-source, <1000 LOC core. Single `MultiStepAgent` class implementing **ReAct** (Reason → Act loop). Two action styles: **CodeAgent** (writes Python; natural composability via loops/conditionals/function-nesting) vs **ToolCallingAgent** (JSON tool calls). **Hub-shared tools** — a marketplace of reusable agent tools. Multi-agent = orchestrator agent + specialized sub-agents. Sandboxed execution via E2B / Modal / Docker.

### LangGraph (LangChain)

Graph-based state machines for agents. **Checkpointing at every super-step** with thread_id-keyed persistence. Enables **time-travel debugging**, **human-in-the-loop interrupts**, **fault-tolerant resume after failure**. Pluggable checkpointers (Postgres, DynamoDB, SQLite). **LangSmith** is the observability companion — captures full trajectory (every LLM call, tool invocation, retrieval, reasoning) with replay + evaluation. Highest-rated production-readiness among open-source frameworks.

### CrewAI

**Role-based agent teams** with intuitive task delegation. Fastest prototype path (2-3 engineer-days). Best for mostly-linear workflows. Medium production readiness, growing ecosystem, limited checkpointing.

### Microsoft AutoGen

**Conversational** model: agents interact through multi-turn chat. `GroupChat` is primary coordination pattern — many agents in a shared conversation, a selector decides who speaks next. **Moving to maintenance mode** in favor of the unified Microsoft Agent Framework.

### Cognition Devin

Async-by-design. **Spins up its own cloud VM** with terminal/editor/browser; works autonomously until done. Opens PRs, runs tests, QAs itself via computer vision. **Devin can schedule recurring Devins** — Friday-afternoon QA pass that spins one sub-Devin per page, compiles a Slack report. Full REST API; sessions triggered programmatically from Sentry/CI/etc.

### Cursor (our deploy target)

Cursor 2.0 is **agent-first**. Background Agents in isolated Ubuntu VMs with internet + branch isolation. Up to 8 parallel agents via Git worktrees. **`.cursor/rules/*.mdc`** is the rules format (version-controlled, file-scoped). **Skills** (folder + `SKILL.md` + scripts) are the packaged-expertise primitive. **MCP** is the integration substrate — ~5000 community servers, but with a 40-active-tool ceiling per workspace.

### Anthropic Claude Agent SDK

The same loop that powers Claude Code, programmable in Python/TypeScript. **Subagents-by-default** — spin up parallel sub-agents each with an isolated context window, only returning relevant info to the orchestrator. **Skills** (beta) — folders of instructions + scripts + resources dynamically loaded when relevant. **"Dreaming"** (2026 addition) — agents review past sessions to find patterns and self-improve.

---

## 2 / Patterns that recur

Stripped of branding, the same primitives show up everywhere:

| Pattern | Our state | Who has it | Should we? |
|---|---|---|---|
| **Supervisor / orchestrator** | CTO persona spec'd but not seeded yet | Bedrock, CrewAI, smolagents, AgentKit, Claude Agent SDK | ✅ via framework-port |
| **Explicit handoff** primitive (agent → agent delegation) | None | OpenAI Agents SDK, AutoGen, Foundry Connected Agents | 🟡 high value |
| **Guardrails** (pre/post-action) | Validation gates run only at done | OpenAI Agents SDK, Bedrock | 🟡 high value |
| **Trace / replay** of an agent's reasoning | None — we have run records but not step-by-step traces | LangSmith, AgentKit traces | 🟡 high value |
| **Durable execution** w/ checkpoint resume | None | LangGraph, Foundry | 🟢 medium |
| **Visual workflow builder** | None | Foundry, AgentKit, CrewAI Studio | 🔴 expensive, low priority |
| **Subagents w/ isolated context** | None — we have agent identities but they share context | Claude Agent SDK, Devin | 🟢 medium |
| **Sandboxed code execution** | Validator subprocess w/ timeout + env whitelist | Bedrock, E2B, Devin VMs | 🟢 incremental upgrade |
| **MCP server expose** | None — we're a REST + CLI client to others | Cursor, ~5000 community MCPs | 🟡 high value |
| **Tool / connector registry** | Our library is rules/skills/automations/validators | AgentKit Connector Registry, HF Hub tools | 🟢 already partial |
| **Scheduled recurring agents** | We have Cursor Automations w/ cron | Devin schedules Devins | ✅ already |
| **PR-as-artifact** workflow | None — we track work items, not commits/PRs | Devin, Cursor BG Agents | 🟡 high value |
| **Multi-turn agent conversations / GroupChat** | We have comments thread which approximates this | AutoGen | 🔴 unclear if needed |
| **Skills as discoverable expertise** | Library has `skill` type, browse + edit + publish | Claude Agent SDK, smolagents Hub | ✅ already |
| **"Dreaming" / memory consolidation** | Spec'd in framework-port as REM-sleep | Anthropic | ✅ planned |
| **Routing mode** (simple → specialist directly) | None — every work item goes through normal flow | Bedrock | 🟢 medium |
| **Agent identities + scale-to-zero** | We track assignee strings | Foundry hosted agents | 🔴 over-engineered for local |

**Legend**: ✅ already covered · 🟡 high-value proposal · 🟢 medium · 🔴 defer / out of scope

---

## 3 / Concrete proposals (ranked by leverage)

### 🟡 P1 — Agent trace timeline ("see what the agent did")

**Inspired by**: LangSmith traces, Anthropic Claude Code's tool-use log, AgentKit Tracing.

**Gap**: We record `validation_runs`, `comments`, `automation_runs`, `mentions`, `notifications` — but they're separate tables and there's no per-work-item, time-ordered "what happened step-by-step" view. When a Cursor agent does 47 things on one work item, there's no good way to audit the trajectory.

**Proposal**:
- New unified `agent_events` table — one row per event with `kind` enum (claim, comment, tool_call, validation_run, question_asked, question_answered, status_transition, file_opened, command_run, override).
- Agents emit events via `pc trace <kind> --metadata '...'` and the existing API write paths emit implicitly.
- New `/items/[id]/trajectory` route renders the timeline — collapsible, filterable by event kind, with replay-style "scrub through the agent's session" UX.
- Decision 18-aligned: one canonical surface (this single view), progressive disclosure (collapsed by default), keyboard navigable.

**Effort**: ~3-4 task groups. Single new table + emitter helpers + one new route.
**Value**: Huge for debugging agent runs. Also lays the foundation for "dreaming" / pattern-hunt later.

---

### 🟡 P2 — Handoff primitive (CTO → specialist delegation, recorded)

**Inspired by**: OpenAI Agents SDK Handoffs, Bedrock supervisor pattern, Foundry Connected Agents.

**Gap**: We have personas but no first-class "this agent delegates work to that agent" relationship. The CTO orchestrator (from framework-port) will need to delegate to Roy/Moss/Jen/etc. Right now that has to be modeled as "change assignee on the work item" — which loses the context that one agent is asking another to handle a sub-task.

**Proposal**:
- New `handoffs` table — `from_agent`, `to_agent`, `work_item_id`, `reason`, `context_blob`, `created_at`, `resolved_at`, `resolution` (`accepted | declined | reassigned | completed`).
- `pc handoff <item-id> --to <agent> --reason "..." [--context "..."]` CLI.
- API: `POST /api/v1/work-items/:id/handoffs`, `GET .../handoffs`.
- UI: handoff trail on item detail page; persona-routing dropdown (suggest specialist based on persona.routing_globs); supervisor-mode banner on items currently in a CTO-delegated chain.
- Tie into the agent_events timeline (P1) — handoffs are events.

**Effort**: ~2-3 task groups, depends on framework-port for personas to be meaningful.
**Value**: Closes the gap between our work-item model and how real supervisor/specialist agent teams operate.

---

### 🟡 P3 — Expose ourselves as an MCP server

**Inspired by**: Cursor's MCP ecosystem (~5000 servers), Anthropic's MCP push.

**Gap**: `pc` CLI is the only way agents talk to us. MCP is now table stakes — every agent runtime (Cursor, Claude Code, Foundry, OpenAI Agents) speaks MCP. Exposing ourselves as an MCP server means agents discover work-item/library/validation as tools natively, without anyone writing a Cursor rule that says "call `pc next`."

**Proposal**:
- Add an MCP server endpoint on `:3737/mcp` exposing:
  - `work_items.next_ready`, `work_items.update_status`, `work_items.comment`, `work_items.file`
  - `questions.ask`, `questions.answer`, `questions.check`
  - `validation.run`, `validation.status`
  - `library.list`, `library.get`, `library.publish`
- Use the official MCP TypeScript SDK from Anthropic.
- Watch the 40-active-tool ceiling — group related tools so we don't blow Cursor's budget. Maybe 8-12 well-named tools max.
- Document how to add the server to `~/.cursor/mcp.json`.

**Effort**: ~1-2 task groups. Mostly wrapping existing REST endpoints in MCP shape.
**Value**: One-time setup vs. "publish this rule into every repo" friction.

---

### 🟡 P4 — Guardrails (pre-action policy gates)

**Inspired by**: OpenAI Agents SDK Guardrails, Bedrock Guardrails.

**Gap**: Validation gates fire at `done`. Guardrails fire on every agent action: "is this allowed?" before the agent does it. Today an agent could `pc file bug` 500 times in a loop and we'd let it.

**Proposal**:
- `guardrails` library entry type (5th type alongside rule/skill/automation/validator/doc) — frontmatter declares the action(s) it gates, the check (regex / shell / built-in), and the policy (block / warn / require_human_approval).
- Built-in guardrails seeded: rate-limit (no more than N actions/hour from one agent), forbidden-paths (don't touch `.env`, `secrets/**`), require-evidence-for-done (already partial via user-story-acceptance).
- Hook into the agent_events emitter (P1) — guardrails inspect the proposed event before it's recorded.
- UI: guardrails panel under each persona showing which gates apply.

**Effort**: ~2-3 task groups.
**Value**: Stops the agent-runaway tail risk. Important once you have unattended Background Agents.

---

### 🟢 P5 — PR / commit linkage on work items

**Inspired by**: Devin opens PRs, Cursor BG Agents create branches.

**Gap**: We don't know if a work item was actually shipped. The done transition is gated on validation but a work item could be marked done with no code merged.

**Proposal**:
- `work_item_links` table — `work_item_id`, `provider` (github | gitlab | local-git), `kind` (branch | commit | pr | mr), `ref` (sha / pr-number), `url`, `created_at`.
- `pc link <item-id> --pr <url>` CLI; agents call this when they open a PR.
- Webhook handler `POST /api/v1/work-items/:id/links` for CI to update PR state (open → closed → merged).
- UI: PR/commit chips on the item detail page; "Awaiting PR" warning if status is in_review but no PR linked.

**Effort**: ~2 task groups. Schema + endpoints + UI panel.
**Value**: Closes the loop between work tracking and actual delivery.

---

### 🟢 P6 — Durable agent state / checkpoints (post-MVP)

**Inspired by**: LangGraph thread-keyed checkpoints, Foundry stateful workflows.

**Gap**: If `pc validate` crashes mid-run, we have a half-recorded `validation_runs` row. If an agent crashes mid-task, the work item is `in_progress` forever. No resume.

**Proposal**:
- `agent_sessions` table — `agent_name`, `work_item_id`, `started_at`, `last_heartbeat_at`, `state_blob`, `status` (active | crashed | completed).
- Heartbeat endpoint that agents ping every N seconds; if heartbeat is missed for >5 min, session is marked crashed.
- Crashed sessions get a "resume?" prompt — the work item snaps back to `ready` with a comment auto-filed about the crash.
- Lower-priority than P1-P5 because Cursor's Background Agents handle a lot of this already.

**Effort**: ~3 task groups.
**Value**: Defensive — matters once we have unattended scheduled agents.

---

### 🟢 P7 — Routing mode (simple queries skip the supervisor)

**Inspired by**: Bedrock's routing mode.

**Gap**: Every work item flows through the same backlog → ready → in_progress lifecycle. For trivial requests (typo fix, one-line config change), this is heavy.

**Proposal**:
- `pc quick <type> "<title>"` skips the backlog and routes directly to a default-assigned agent (per project setting `default_quick_assignee`).
- Project setting: enable/disable quick mode; max items/day from quick path.
- Quick-mode items skip user-story-acceptance gate (no formal AC required) but still hit quality/security/bugs.

**Effort**: 1 task group.
**Value**: Removes friction for low-stakes work without giving up the discipline for the rest.

---

### 🔴 Defer

- **Visual workflow builder** — Foundry / AgentKit have these; very expensive to build, low marginal value for solo use. Markdown editor for automations is enough.
- **Multi-turn agent group chat** — AutoGen's killer feature, but our comments thread + HITL questions already covers the realistic shape.
- **Agent identities w/ scale-to-zero billing** — Foundry's enterprise feature. We're local-only; identity is `assignee: cursor-bg` and that's fine.

---

## 4 / Recommended next openspec changes

In priority order, if you want to keep building:

1. **`agent-trace-timeline`** (P1) — biggest debugging win
2. **`mcp-server-export`** (P3) — biggest distribution win
3. **`handoff-primitive`** (P2) — wait until framework-port lands personas
4. **`guardrails-library-type`** (P4) — needed once unattended automations are real
5. **`pr-commit-linkage`** (P5) — closes delivery loop
6. **`durable-agent-sessions`** (P6) — defensive
7. **`routing-mode-quick-path`** (P7) — UX polish

Each would be a separate openspec change following proposal → design → specs → tasks → implement.

---

## Sources

- [Microsoft Foundry Agent Service overview](https://learn.microsoft.com/en-us/azure/foundry/agents/overview)
- [Microsoft Agent Framework (GitHub)](https://github.com/microsoft/agent-framework)
- [Azure AI Foundry — Multi-Agent Orchestration and Workflows](https://blog.stackademic.com/azure-ai-foundry-multi-agent-orchestration-and-workflows-771652942772)
- [Azure AI Foundry Agent Service Launches Multi-Agent Orchestration](https://mojoauth.com/blog/azure-ai-foundry-agent-service-launches-multi-agent-orchestration)
- [What's new in Microsoft Foundry — April 2026](https://devblogs.microsoft.com/foundry/whats-new-in-microsoft-foundry-apr-2026/)
- [AWS Bedrock multi-agent collaboration docs](https://docs.aws.amazon.com/bedrock/latest/userguide/agents-multi-agent-collaboration.html)
- [Introducing multi-agent collaboration capability for Amazon Bedrock](https://aws.amazon.com/blogs/aws/introducing-multi-agent-collaboration-capability-for-amazon-bedrock/)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [Introducing AgentKit](https://openai.com/index/introducing-agentkit/)
- [HuggingFace smolagents (GitHub)](https://github.com/huggingface/smolagents)
- [HuggingFace smolagents — Multi-Agent Systems](https://huggingface.co/learn/agents-course/unit2/smolagents/multi_agent_systems)
- [LangGraph (GitHub)](https://github.com/langchain-ai/langgraph)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangSmith Observability](https://www.langchain.com/langsmith/observability)
- [CrewAI vs LangGraph vs AutoGen comparison](https://dev.to/emperorakashi20/crewai-vs-langgraph-vs-autogen-which-multi-agent-framework-should-you-use-in-2026-5h2f)
- [Cursor 2.0 Agent-First Architecture Guide](https://www.digitalapplied.com/blog/cursor-2-0-agent-first-architecture-guide)
- [Cursor MCP Servers 2026 Guide](https://www.nxcode.io/resources/news/cursor-mcp-servers-complete-guide-2026)
- [Cursor Background Agent docs](https://cursor.com/docs)
- [Cognition Devin — Coding Agents 101](https://devin.ai/agents101)
- [Cognition — Devin can now Schedule Devins](https://cognition.ai/blog/devin-can-now-schedule-devins)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [Code with Claude 2026 — 5 new agent features](https://www.mindstudio.ai/blog/code-with-claude-2026-new-agent-features)
- [AI Agent Frameworks in 2026 — 8 SDKs, ACP, trade-offs](https://www.morphllm.com/ai-agent-framework)
