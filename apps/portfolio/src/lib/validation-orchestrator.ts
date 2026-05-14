import { and, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  evidenceLinks,
  projects,
  validationRuns,
  workItems,
} from '@/db/schema';
import { currentUserId } from './auth';
import {
  VALIDATION_GATES,
  findValidatorForGate,
  runAcceptanceMatcher,
  runShellValidator,
  targetRepoOrCwd,
  type ValidationGate,
} from './validators';

interface ProjectSettings {
  validation?: {
    enabled?: boolean;
    gates?: Partial<Record<ValidationGate, boolean>>;
  };
}

function parseSettings(json: string): ProjectSettings {
  try {
    const v = JSON.parse(json) as unknown;
    if (typeof v === 'object' && v !== null) return v as ProjectSettings;
  } catch {
    /* ignore */
  }
  return {};
}

// Which gates are enabled for this project. Default: all four ON unless the
// project's settings.validation.gates explicitly disables one.
export function enabledGatesForProject(projectSettingsJson: string): ValidationGate[] {
  const settings = parseSettings(projectSettingsJson);
  if (settings.validation?.enabled === false) return [];
  const overrides = settings.validation?.gates ?? {};
  return VALIDATION_GATES.filter((g) => overrides[g] !== false);
}

export interface RunSummary {
  gate: ValidationGate;
  validatorSlug: string;
  validationRunId: string;
  status: 'pass' | 'fail' | 'error' | 'skipped';
}

// Run a single gate against a work item. Records validation_runs rows.
// Returns the final state once the run completes (subprocess kinds wait for
// the spawned process to exit before resolving).
export async function runGate(workItemId: string, gate: ValidationGate): Promise<RunSummary> {
  const db = getDb();
  const userId = currentUserId();

  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), eq(workItems.userId, userId)))
    .get();
  if (!item) throw new Error(`work item ${workItemId} not found`);

  // user-story-acceptance is a built-in: no subprocess. Other gates require
  // a validator entry from the library + a target_repo_path on the project.
  if (gate === 'user-story-acceptance') {
    let criteria: Array<{ id: string; text: string }> = [];
    try {
      const parsed = JSON.parse(item.acceptanceCriteria) as unknown;
      if (Array.isArray(parsed)) criteria = parsed as typeof criteria;
    } catch {
      /* ignore */
    }
    const evidence = db
      .select({ criterion: evidenceLinks.acceptanceCriterionId })
      .from(evidenceLinks)
      .where(
        and(
          eq(evidenceLinks.workItemId, item.id),
          eq(evidenceLinks.userId, userId),
        ),
      )
      .all();
    const evidenceSet = new Set(evidence.map((e) => e.criterion));
    const result = runAcceptanceMatcher(criteria, evidenceSet);
    const now = new Date().toISOString();
    const [run] = db
      .insert(validationRuns)
      .values({
        userId,
        projectId: item.projectId,
        workItemId: item.id,
        gate,
        validatorSlug: '@builtin:user-story-acceptance',
        startedAt: now,
        completedAt: now,
        status: result.status,
        exitCode: 0,
        stdoutSnippet: '',
        stderrSnippet: '',
        findingsJson: JSON.stringify(result.findings),
      })
      .returning()
      .all();
    if (!run) throw new Error('failed to insert validation_runs row');
    return {
      gate,
      validatorSlug: '@builtin:user-story-acceptance',
      validationRunId: run.id,
      status: result.status,
    };
  }

  const validator = findValidatorForGate(gate);
  if (!validator) {
    // No validator seeded for this gate — record a skipped run so the dashboard
    // shows "skipped" rather than "no run."
    const now = new Date().toISOString();
    const [run] = db
      .insert(validationRuns)
      .values({
        userId,
        projectId: item.projectId,
        workItemId: item.id,
        gate,
        validatorSlug: '(none)',
        startedAt: now,
        completedAt: now,
        status: 'skipped',
        findingsJson: JSON.stringify({ reason: 'no validator seeded for this gate' }),
      })
      .returning()
      .all();
    if (!run) throw new Error('failed to insert validation_runs row');
    return { gate, validatorSlug: '(none)', validationRunId: run.id, status: 'skipped' };
  }

  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, item.projectId), eq(projects.userId, userId)))
    .get();
  const cwd = targetRepoOrCwd(project?.targetRepoPath ?? null);

  // Insert a 'running' row so the UI can poll for it.
  const startedAt = new Date().toISOString();
  const [running] = db
    .insert(validationRuns)
    .values({
      userId,
      projectId: item.projectId,
      workItemId: item.id,
      gate,
      validatorSlug: validator.slug,
      startedAt,
      status: 'running',
    })
    .returning()
    .all();
  if (!running) throw new Error('failed to insert validation_runs row');

  // Spawn the validator. We await it here because the API handler awaits the
  // returned promise; if you want non-blocking, dispatch and return the
  // 'running' row id from a separate orchestrator. For MVP, await + return.
  const outcome = await runShellValidator(validator, cwd);
  const completedAt = new Date().toISOString();
  db.update(validationRuns)
    .set({
      status: outcome.status,
      exitCode: outcome.exitCode,
      stdoutSnippet: outcome.stdoutSnippet,
      stderrSnippet: outcome.stderrSnippet,
      findingsJson: JSON.stringify(outcome.findings),
      completedAt,
    })
    .where(eq(validationRuns.id, running.id))
    .run();

  return {
    gate,
    validatorSlug: validator.slug,
    validationRunId: running.id,
    status: outcome.status,
  };
}

// Run every enabled gate concurrently (or sequentially — for MVP, sequential
// is simpler and avoids surprises if validators share state in the target
// repo). Returns the final summaries.
export async function runAllGates(workItemId: string): Promise<RunSummary[]> {
  const db = getDb();
  const userId = currentUserId();
  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), eq(workItems.userId, userId)))
    .get();
  if (!item) throw new Error(`work item ${workItemId} not found`);
  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, item.projectId), eq(projects.userId, userId)))
    .get();
  const gates = enabledGatesForProject(project?.settingsJson ?? '{}');
  const results: RunSummary[] = [];
  for (const g of gates) {
    results.push(await runGate(workItemId, g));
  }
  return results;
}

export interface GateState {
  gate: ValidationGate;
  status: 'pass' | 'fail' | 'error' | 'skipped' | 'running' | 'never_run';
  lastRunId: string | null;
  lastRunAt: string | null;
}

export function latestGateStates(workItemId: string): GateState[] {
  const db = getDb();
  const userId = currentUserId();
  const rows = db
    .select()
    .from(validationRuns)
    .where(
      and(eq(validationRuns.workItemId, workItemId), eq(validationRuns.userId, userId)),
    )
    .orderBy(validationRuns.startedAt)
    .all();
  const byGate = new Map<ValidationGate, typeof rows[number]>();
  for (const r of rows) {
    byGate.set(r.gate as ValidationGate, r); // last assignment wins (most recent because sorted asc)
  }
  return VALIDATION_GATES.map((g) => {
    const r = byGate.get(g);
    if (!r) {
      return { gate: g, status: 'never_run' as const, lastRunId: null, lastRunAt: null };
    }
    return {
      gate: g,
      status: r.status as GateState['status'],
      lastRunId: r.id,
      lastRunAt: r.startedAt,
    };
  });
}

export function failingGates(states: GateState[]): ValidationGate[] {
  return states
    .filter((s) => s.status !== 'pass' && s.status !== 'skipped')
    .map((s) => s.gate);
}
