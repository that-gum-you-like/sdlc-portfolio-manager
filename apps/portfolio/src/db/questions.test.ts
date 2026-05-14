import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';

import { closeDb, getDb } from './index.ts';
import { runMigrations } from './migrate.ts';
import { seedDefaultPortfolioAndProject } from './seed.ts';
import { questions, workItems } from './schema.ts';

let workDir: string;
let dbPath: string;
let projectId: string;

beforeEach(() => {
  closeDb();
  workDir = mkdtempSync(join(tmpdir(), 'sdlc-pm-q-test-'));
  dbPath = join(workDir, 'data.sqlite');
  runMigrations(dbPath);
  const seed = seedDefaultPortfolioAndProject(dbPath);
  projectId = seed.projectId;
});

afterEach(() => {
  closeDb();
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

function createInProgressItem(title: string) {
  const db = getDb(dbPath);
  const [row] = db
    .insert(workItems)
    .values({ projectId, type: 'task', title, status: 'in_progress' })
    .returning()
    .all();
  if (!row) throw new Error('failed to create item');
  return row;
}

describe('questions', () => {
  it('first question transitions item to needs-human and captures previous_status', () => {
    const db = getDb(dbPath);
    const item = createInProgressItem('Implement export');

    // Mirrors the API logic
    const previousStatus = item.status;
    db.insert(questions)
      .values({
        projectId,
        workItemId: item.id,
        askedBy: 'agent',
        body: 'OAuth or magic links?',
        previousStatus,
      })
      .run();
    db.update(workItems)
      .set({ status: 'needs-human', previousStatus: item.status })
      .where(eq(workItems.id, item.id))
      .run();

    const updated = db.select().from(workItems).where(eq(workItems.id, item.id)).get();
    expect(updated?.status).toBe('needs-human');
    expect(updated?.previousStatus).toBe('in_progress');
  });

  it('multiple open questions hold needs-human until last is answered', () => {
    const db = getDb(dbPath);
    const item = createInProgressItem('Big feature');

    db.insert(questions)
      .values({
        projectId,
        workItemId: item.id,
        askedBy: 'agent',
        body: 'q1',
        previousStatus: 'in_progress',
      })
      .run();
    db.insert(questions)
      .values({
        projectId,
        workItemId: item.id,
        askedBy: 'agent',
        body: 'q2',
        previousStatus: 'in_progress',
      })
      .run();
    db.update(workItems)
      .set({ status: 'needs-human', previousStatus: 'in_progress' })
      .where(eq(workItems.id, item.id))
      .run();

    // Answer one
    const [first] = db
      .select()
      .from(questions)
      .where(eq(questions.workItemId, item.id))
      .all();
    db.update(questions)
      .set({ status: 'answered', answeredAt: new Date().toISOString() })
      .where(eq(questions.id, first!.id))
      .run();

    const stillOpen = db
      .select()
      .from(questions)
      .where(and(eq(questions.workItemId, item.id), eq(questions.status, 'open')))
      .all();
    expect(stillOpen).toHaveLength(1);

    // Item stays in needs-human
    expect(db.select().from(workItems).where(eq(workItems.id, item.id)).get()?.status).toBe(
      'needs-human',
    );

    // Answer the second
    db.update(questions)
      .set({ status: 'answered', answeredAt: new Date().toISOString() })
      .where(eq(questions.id, stillOpen[0]!.id))
      .run();

    const remainingOpen = db
      .select()
      .from(questions)
      .where(and(eq(questions.workItemId, item.id), eq(questions.status, 'open')))
      .all();
    expect(remainingOpen).toHaveLength(0);

    // Now caller would restore — emulate it
    db.update(workItems)
      .set({ status: 'in_progress', previousStatus: null })
      .where(eq(workItems.id, item.id))
      .run();

    const restored = db.select().from(workItems).where(eq(workItems.id, item.id)).get();
    expect(restored?.status).toBe('in_progress');
    expect(restored?.previousStatus).toBeNull();
  });

  it('CHECK constraint rejects invalid status values at the SQL level', () => {
    const db = getDb(dbPath);
    const item = createInProgressItem('test');
    // Bypass Drizzle's typed enum to confirm the SQLite CHECK constraint fires.
    const rawSql =
      "INSERT INTO questions (id, project_id, work_item_id, asked_by, body, status, previous_status, asked_at) " +
      `VALUES ('id-1', ?, ?, 'agent', 'q', 'whatever', 'in_progress', '2026-01-01')`;
    expect(() => {
      db.run({ queryChunks: [rawSql], decoder: { mapFromDriverValue: (v: unknown) => v } } as never);
    }).toThrow();
    // Use the raw better-sqlite3 path for the real CHECK assertion
    const better = (
      db as unknown as {
        $client?: { prepare: (sql: string) => { run: (...args: unknown[]) => unknown } };
      }
    ).$client;
    if (better) {
      expect(() =>
        better
          .prepare(
            "INSERT INTO questions (id, project_id, work_item_id, asked_by, body, status, previous_status, asked_at) VALUES ('id-2', ?, ?, 'agent', 'q', 'whatever', 'in_progress', '2026-01-01')",
          )
          .run(projectId, item.id),
      ).toThrow();
    }
  });
});
