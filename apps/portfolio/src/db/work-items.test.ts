import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';

import { closeDb, getDb } from './index.ts';
import { runMigrations } from './migrate.ts';
import { seedDefaultPortfolioAndProject } from './seed.ts';
import { workItems } from './schema.ts';
import { isTransitionAllowed, allowedNextStatuses } from '../lib/work-items.ts';

let workDir: string;
let dbPath: string;
let projectId: string;

beforeEach(() => {
  closeDb();
  workDir = mkdtempSync(join(tmpdir(), 'sdlc-pm-wi-test-'));
  dbPath = join(workDir, 'data.sqlite');
  runMigrations(dbPath);
  const seed = seedDefaultPortfolioAndProject(dbPath);
  projectId = seed.projectId;
});

afterEach(() => {
  closeDb();
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

describe('status transitions', () => {
  it('allows valid transitions and rejects invalid ones', () => {
    expect(isTransitionAllowed('backlog', 'ready')).toBe(true);
    expect(isTransitionAllowed('ready', 'in_progress')).toBe(true);
    expect(isTransitionAllowed('in_progress', 'in_review')).toBe(true);
    expect(isTransitionAllowed('in_progress', 'needs-human')).toBe(true);
    expect(isTransitionAllowed('in_review', 'done')).toBe(true);

    // Invalid: cannot skip stages
    expect(isTransitionAllowed('backlog', 'done')).toBe(false);
    expect(isTransitionAllowed('backlog', 'in_progress')).toBe(false);
    expect(isTransitionAllowed('ready', 'done')).toBe(false);

    // Bidirectional within sensible bounds
    expect(isTransitionAllowed('ready', 'backlog')).toBe(true);
    expect(isTransitionAllowed('done', 'in_review')).toBe(true);

    // needs-human → in_progress (restoration)
    expect(isTransitionAllowed('needs-human', 'in_progress')).toBe(true);
    expect(isTransitionAllowed('needs-human', 'done')).toBe(false);

    expect(allowedNextStatuses('backlog')).toEqual(['ready', 'cancelled']);
  });
});

describe('work_items inserts', () => {
  it('creates a story with sensible defaults', () => {
    const db = getDb(dbPath);
    const [row] = db
      .insert(workItems)
      .values({ projectId, type: 'story', title: 'Test story' })
      .returning()
      .all();
    expect(row?.status).toBe('backlog');
    expect(row?.userId).toBe('local-user');
    expect(row?.labels).toBe('[]');
    expect(row?.acceptanceCriteria).toBe('[]');
    expect(row?.subtypeData).toBe('{}');
    expect(row?.rank).toBe(0);
  });

  it('persists acceptance criteria as JSON on requirement type', () => {
    const db = getDb(dbPath);
    const criteria = [
      { id: 'AC-1', text: 'User can export their data' },
      { id: 'AC-2', text: 'Export completes within 5 seconds' },
    ];
    const [row] = db
      .insert(workItems)
      .values({
        projectId,
        type: 'requirement',
        title: 'Data export',
        acceptanceCriteria: JSON.stringify(criteria),
      })
      .returning()
      .all();
    const parsed = JSON.parse(row!.acceptanceCriteria) as typeof criteria;
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.id).toBe('AC-1');
  });
});

describe('parent-child + cycle', () => {
  it('child gets parent_id; siblings under same parent', () => {
    const db = getDb(dbPath);
    const [parent] = db
      .insert(workItems)
      .values({ projectId, type: 'epic', title: 'Parent epic' })
      .returning()
      .all();
    const [childA] = db
      .insert(workItems)
      .values({ projectId, type: 'story', title: 'Child A', parentId: parent!.id })
      .returning()
      .all();
    db.insert(workItems)
      .values({ projectId, type: 'story', title: 'Child B', parentId: parent!.id })
      .returning()
      .all();

    const children = db.select().from(workItems).where(eq(workItems.parentId, parent!.id)).all();
    expect(children).toHaveLength(2);
    expect(childA?.parentId).toBe(parent!.id);
  });
});

describe('claim atomicity', () => {
  it('atomic claim transitions ready → in_progress and sets assignee', () => {
    const db = getDb(dbPath);
    const [task] = db
      .insert(workItems)
      .values({ projectId, type: 'task', title: 'Claim me', status: 'ready' })
      .returning()
      .all();

    // Simulate the API-level claim: conditional UPDATE only fires when status=ready
    const [updated] = db
      .update(workItems)
      .set({ status: 'in_progress', assignee: 'agent-x' })
      .where(and(eq(workItems.id, task!.id), eq(workItems.status, 'ready')))
      .returning()
      .all();
    expect(updated?.status).toBe('in_progress');
    expect(updated?.assignee).toBe('agent-x');

    // Second attempt fails because status no longer equals 'ready'
    const second = db
      .update(workItems)
      .set({ status: 'in_progress', assignee: 'agent-y' })
      .where(and(eq(workItems.id, task!.id), eq(workItems.status, 'ready')))
      .returning()
      .all();
    expect(second).toHaveLength(0);

    // Original assignee preserved
    const current = db.select().from(workItems).where(eq(workItems.id, task!.id)).get();
    expect(current?.assignee).toBe('agent-x');
  });
});
