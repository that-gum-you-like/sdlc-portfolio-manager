import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';

import { closeDb, getDb, getRawDb } from './index.ts';
import { runMigrations } from './migrate.ts';
import { seedDefaultPortfolioAndProject } from './seed.ts';
import { workItems } from './schema.ts';

let workDir: string;
let dbPath: string;
let projectId: string;

beforeEach(() => {
  closeDb();
  workDir = mkdtempSync(join(tmpdir(), 'sdlc-pm-auto-test-'));
  dbPath = join(workDir, 'data.sqlite');
  runMigrations(dbPath);
  const seed = seedDefaultPortfolioAndProject(dbPath);
  projectId = seed.projectId;
});

afterEach(() => {
  closeDb();
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

function createReadyTask(title: string, rank = 0) {
  const db = getDb(dbPath);
  const [row] = db
    .insert(workItems)
    .values({ projectId, type: 'task', title, status: 'ready', rank })
    .returning()
    .all();
  if (!row) throw new Error('failed');
  return row;
}

// Exercise the same primitive the next-ready endpoint relies on: a
// conditional UPDATE that only succeeds when status is still 'ready'.
function tryClaim(taskId: string, agent: string) {
  const db = getDb(dbPath);
  const [updated] = db
    .update(workItems)
    .set({ status: 'in_progress', assignee: agent })
    .where(and(eq(workItems.id, taskId), eq(workItems.status, 'ready')))
    .returning()
    .all();
  return updated ?? null;
}

describe('next-ready atomic claim semantics', () => {
  it('two concurrent claims on the same task: exactly one wins', () => {
    const task = createReadyTask('Single ready task');
    const raw = getRawDb(dbPath);

    // Run both claims inside a single serialized transaction sequence to
    // emulate two callers racing for the same row. better-sqlite3 is sync,
    // so the second claim sees the post-first-update state.
    const tx = raw.transaction(() => {
      const a = tryClaim(task.id, 'agent-A');
      const b = tryClaim(task.id, 'agent-B');
      return { a, b };
    });
    const { a, b } = tx();

    expect(a).not.toBeNull();
    expect(b).toBeNull();
    expect(a?.assignee).toBe('agent-A');
  });

  it('claim by rank ordering when multiple ready items exist', () => {
    createReadyTask('Last', 10);
    const target = createReadyTask('First', 0);
    createReadyTask('Middle', 5);

    const db = getDb(dbPath);
    const candidates = db
      .select()
      .from(workItems)
      .where(and(eq(workItems.userId, 'local-user'), eq(workItems.status, 'ready')))
      .orderBy(workItems.rank, workItems.createdAt)
      .all();
    expect(candidates[0]?.id).toBe(target.id);
  });
});
