## 1. Schema extensions (depends on initial-portfolio-manager schema)

- [ ] 1.1 Extend `library_entries.type` enum: `rule` | `skill` | `automation` | `doc`
- [ ] 1.2 Add columns to `work_items`: `subtype_data` JSON, `capability_required` JSON array, `done_checklist` JSON array
- [ ] 1.3 New table `agent_assignment`: `id`, `persona_entry_id`, `target_repo_id`, `maturation_level`, `last_evolved_at`, `corrections_received`
- [ ] 1.4 New table `agent_memory`: `id`, `agent_name`, `target_repo`, `layer`, `entry_id`, `entry_json`, `created_at`
- [ ] 1.5 New table `maturation_events`: `id`, `assignment_id`, `from_level`, `to_level`, `triggered_by`, `at`
- [ ] 1.6 New table `capability_log`: `id`, `agent_name`, `capability_used`, `work_item_id`, `target_repo`, `timestamp`
- [ ] 1.7 New table `automation_runs`: `id`, `automation_entry_id`, `started_at`, `completed_at`, `status`, `summary`, `created_item_ids_json`
- [ ] 1.8 New table `project_config`: per-project quality toggles, done-checklist gates, custom routing
- [ ] 1.9 Migrations 0002–0009 written and tested

## 2. Persona port (source: ~/agentic-sdlc/agents/templates/execution-agents/)

- [ ] 2.1 Write `scripts/port-personas.mjs` — reads each AGENT.md, transforms frontmatter to Cursor-native schema, writes `.mdc` into `cursor-templates/rules/personas/`
- [ ] 2.2 Manual review pass on each persona: strip Claude-Code-specific phrasing, normalize tool references, validate routing globs
- [ ] 2.3 Add `source_url` frontmatter pointing back to agentic-sdlc file
- [ ] 2.4 Add `capabilities` checklist to each persona (required/conditional/notExpected)
- [ ] 2.5 Verify 19 personas total: 16 execution + 3 framework
- [ ] 2.6 First-run seed copies these into the user's library

## 3. Framework knowledge port (source: ~/agentic-sdlc/framework/ and ~/agentic-sdlc/docs/)

- [ ] 3.1 Write `scripts/port-framework-docs.mjs` — reads each framework .md, wraps with `type: doc, category: framework, level: <n>` frontmatter
- [ ] 3.2 Port 10 knowledge entries: maturity-model, testing-tiers, validation-layers, iteration-cycles, agent-routing, agent-lifecycle, prompt-playbook, parallelization-guide, case-studies, memory-protocol
- [ ] 3.3 Each entry gets `source_url` and a sanity check (no LinguaFlow-specific references)
- [ ] 3.4 "Diff against source" action wires up to `source_url`

## 4. Memory protocol API + CLI

- [ ] 4.1 `pc memory read <layer>` reads from target repo's `.cursor/memory/<agent>/<layer>.json`
- [ ] 4.2 `pc memory write <layer> <json>` appends entry, mirrors to portfolio manager
- [ ] 4.3 `pc memory promote <from> <to> <entry-id>` moves entries between layers
- [ ] 4.4 `pc memory sync` pushes target-repo memory state to portfolio mirror
- [ ] 4.5 `GET /api/v1/agents/:name/memory` returns cross-repo mirror grouped by target_repo + layer
- [ ] 4.6 `rem-sleep` automation entry seeded — weekly cron, deduper, promoter, composter
- [ ] 4.7 Tests: empty layer auto-creates; deduper merges near-identical entries; promotion records event

## 5. Planning-artifact subtypes

- [ ] 5.1 Schema: store subtype-specific fields under `work_items.subtype_data` JSON column
- [ ] 5.2 `requirement` subtype: `acceptance_criteria`, `complexity`, `value`; validate on save
- [ ] 5.3 `roadmap-item` subtype: `target_start`, `target_end`, child requirements
- [ ] 5.4 `parallelization-stream` subtype: `depends_on`, `interface_contract`
- [ ] 5.5 `devlog-entry` subtype: append-only; reject PATCH on body
- [ ] 5.6 UI: priority-matrix chart for requirements
- [ ] 5.7 UI: roadmap timeline view
- [ ] 5.8 UI: stream-graph (DAG) view
- [ ] 5.9 "Export to markdown" action producing requirements.md / roadmap.md / etc. in agentic-sdlc format

## 6. Capability checklist + drift detection

- [ ] 6.1 Known-capabilities vocabulary file (`cursor-templates/known-capabilities.json`)
- [ ] 6.2 Frontmatter validator rejects unknown capabilities on persona save
- [ ] 6.3 `capability_log` append on every relevant API write
- [ ] 6.4 Drift report endpoint `GET /api/v1/agents/:name/drift?repo=<slug>`
- [ ] 6.5 Drift UI panel on `/agents/:name`
- [ ] 6.6 `capability_required` enforcement on work-item claim

## 7. Maturation tracking

- [ ] 7.1 `agent_assignment` created automatically on first persona-publish-to-repo
- [ ] 7.2 Auto-transitions: `new` → `corrected` on first correction-type memory write; `corrected` → `remembering` on first long-term entry; `remembering` → `teaching` on first comment to another agent; `teaching` → `autonomous` after N completed tasks without correction; `autonomous` → `evolving` on first prompt-edit by the agent's own action
- [ ] 7.3 `maturation_events` logged on every transition
- [ ] 7.4 Dashboard maturation snapshot panel

## 8. Defeat-test allowlist

- [ ] 8.1 CLI `pc allowlist list` reads `defeat-allowlist.json` from target repo
- [ ] 8.2 Portfolio reads allowlist on target-repo-detail view load
- [ ] 8.3 No write path from portfolio — allowlist is target-repo-owned
- [ ] 8.4 Display columns: anti_pattern, exception_reason, granted_by, granted_at

## 9. Done-checklist enforcement

- [ ] 9.1 Default checklist applied at work-item create time from project config
- [ ] 9.2 PATCH endpoint to toggle individual gates
- [ ] 9.3 `in_review` → `done` transition validator
- [ ] 9.4 Override action with required reason string
- [ ] 9.5 Override log surfaced on dashboard
- [ ] 9.6 Per-project disable toggle

## 10. Bottleneck detection

- [ ] 10.1 Scheduled job (daily-review automation entry) scans work items
- [ ] 10.2 "Bottleneck" panel on dashboard listing items idle > 24h on a human
- [ ] 10.3 "Ping assignee" action (writes a comment + sends a system notification — TBD which channel)

## 11. Dashboard route

- [ ] 11.1 `/dashboard` route with six sections (Progress, Bottlenecks, Maturation, Drift, Overrides, Automation Runs)
- [ ] 11.2 Each section query is one SQL — keep dashboard load < 200ms
- [ ] 11.3 Empty-state copy for each section

## 12. Agent + repo detail views

- [ ] 12.1 `/agents/:name` route per spec
- [ ] 12.2 `/repos/:slug` route per spec
- [ ] 12.3 Cross-link from work-item detail to assignee's `/agents/:name`

## 13. Seeded automations

- [ ] 13.1 `cursor-templates/automations/rem-sleep.json` — weekly memory consolidation
- [ ] 13.2 `cursor-templates/automations/daily-review.json` — dashboard refresh, bottleneck scan
- [ ] 13.3 `cursor-templates/automations/weekly-review.json` — maturation + drift summary
- [ ] 13.4 `cursor-templates/automations/weekly-security-review.json` (also referenced by initial change)
- [ ] 13.5 `cursor-templates/automations/weekly-bug-triage.json` (also referenced by initial change)

## 14. Documentation

- [ ] 14.1 `docs/porting-from-agentic-sdlc.md` — what was ported, what was deferred, what was renamed
- [ ] 14.2 `docs/memory-protocol.md` — how the 5-layer model works in this repo
- [ ] 14.3 `docs/quality-systems.md` — capability checklist, drift, maturation, done-checklist, bottlenecks
- [ ] 14.4 Update top-level README with new dashboards and agent system overview

## 15. Validation

- [ ] 15.1 Test: 19 personas seed on first run
- [ ] 15.2 Test: framework knowledge entries seed on first run
- [ ] 15.3 Test: REM-sleep dedups near-identical entries
- [ ] 15.4 Test: capability_required blocks under-capable agent claim
- [ ] 15.5 Test: done-checklist blocks invalid transition, override works
- [ ] 15.6 Test: bottleneck panel shows items idle > 24h
- [ ] 15.7 Test: maturation auto-transitions fire correctly
- [ ] 15.8 Test: drift report flags notExpected capability usage
