---
name: parallel-story-orchestrator
description: Orchestrate 2+ stories in parallel across isolated workers with a tranche PR per wave. Use whenever the user asks to run, batch, or parallelize multiple stories at once, run a "wave"/"tranche"/"sprint batch", or spin up multiple agents to implement several stories concurrently. Owns concurrency, isolation, same-file sequencing, wave merge, and the tranche PR. Single-story discipline stays in story-and-tdd-first + tdd-workflow. Trigger on "run these stories", "parallel stories", "batch the backlog", "wave", "tranche", "multiple agents".
---

# Parallel story orchestrator

The missing layer above the single-story loop. When more than one story runs at once, **one** orchestrator owns concurrency, isolation, sequencing, and integration. Workers own single-story discipline only.

## Layer contract

```
parallel-story-orchestrator   ← batch / wave / tranche PR   (THIS skill)
  └─ per-story worker          ← one isolated agent per story
       └─ model-by-phase team  ← analyze → build → review gate
            └─ story-and-tdd-first + tdd-workflow
```

Concurrency lives **here**. Single-story discipline lives **below**. Never collapse the two into one agent — that is what causes branch and working-tree collisions.

## Hard rules

1. **Isolation is a precondition, not a courtesy.** Every worker runs in its own working tree. Default mechanism: a dedicated **git worktree** per story (`git worktree add ../wt-<story-id> <base>`), one branch each. Docker volumes or separate clones are acceptable substitutes — but the isolation mechanism MUST be named and created *before* any worker starts. No two workers share a working tree. See `agent-team-orchestration` rule.
2. **Workers never merge.** Workers implement, test, review, and commit on their own branch only. The orchestrator is the *single integrator*. Mixing roles produces partial merges, duplicate commits, and broken integration branches.
3. **Same-file conflicts are sequenced at scheduling time, not at merge time.** Run the file-overlap scan (below) before any worker starts. Two stories touching the same file go in different waves — one lands, the other rebases.
4. **The review gate runs inside each worker, before it reports done.** Independent QA + `code-vulnerability-analysis` (or equivalent) happen per worker. The tranche PR is a delivery vehicle, not a review checkpoint.
5. **Verify TDD evidence at wave-merge.** Reject any branch whose history does not show a failing-test commit *before* the passing-test commit. "Tests pass now" is not sufficient.

## Workflow

### 1. Plan the wave (pre-flight, orchestrator only)

1. Collect candidate stories (user-named, or backlog-ready per `delivery-methodology`).
2. Run `verify-before-story-work` for each — drop anything already merged or actively claimed.
3. **File-overlap scan** — for each story, list the files it will touch (from story/spec scope, or a dry-run grep). Build an overlap graph:
   - Stories with **no shared files** → same wave (true parallel).
   - Stories sharing **any file** → different waves, ordered so the smaller/foundational change lands first; later ones rebase onto the merged result.
4. Record the wave plan + per-story owner/branch/worktree in the handoff ledger (`agent-handoff`).

### 2. Launch workers (one isolated agent per story)

For each story in the current wave:

- Create the worktree/branch: `git worktree add ../wt-<story-id> <integration_branch>`.
- Hand the worker exactly one story id and its worktree path.
- The worker runs the full single-story loop: `story-and-tdd-first` → `tdd-workflow` (red → green → refactor) → `code-vulnerability-analysis` → `gt-story-done`.
- The worker commits on its branch and reports done **with evidence** (failing-then-passing commit shas, test result, security subagent id). The worker does **not** push to or merge the integration branch.

### 3. Wave merge (orchestrator only)

For each completed worker, before merging into the tranche branch:

- [ ] **TDD gate** — history shows failing-test commit before passing-test commit. Reject otherwise.
- [ ] **Review gate** — worker's independent QA + security review ran and passed (cite subagent id). Reject if deferred.
- [ ] **Tests green** on the worker branch.
- [ ] **Clean rebase** onto the current tranche branch (resolve here; this is the only place integration happens).

Merge accepted workers in wave order onto a single **tranche branch** (`tranche/<wave-id>`).

### 4. Tranche PR (one per wave)

Open **one** PR per wave from the tranche branch into the integration branch. The PR description must include, per story:

- Story id + work item ref
- Failing→passing commit evidence (TDD gate)
- Security subagent id (per-worker evidence)
- AC/test result table

One tranche PR keeps integration history readable **only because** every worker was independently gated first. Never substitute a single tranche-level review for per-worker gates.

### 5. Bookkeeping

Update the handoff ledger (workers → `pr-open` then `Recently completed`), story files, and planning system per `delivery-methodology`.

## Forbids

- Two workers in the same working tree, or workers without a named isolation mechanism.
- A worker merging to the integration branch (only the orchestrator integrates).
- Running same-file stories in the same wave.
- Deferring TDD/security/QA review to the tranche PR.
- Accepting a worker branch with no red-first commit in history.

Pairs with: `agent-team-orchestration`, `story-and-tdd-first`, `tdd-workflow`, `code-vulnerability-analysis`, `agent-handoff`, `delivery-methodology`.
