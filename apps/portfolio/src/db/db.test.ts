import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

import { closeDb, getDb } from './index.ts';
import { runMigrations } from './migrate.ts';
import { seedDefaultPortfolioAndProject } from './seed.ts';
import { portfolios, projects, workItems, comments } from './schema.ts';

let workDir: string;
let dbPath: string;

beforeEach(() => {
  closeDb();
  workDir = mkdtempSync(join(tmpdir(), 'sdlc-pm-test-'));
  dbPath = join(workDir, 'data.sqlite');
});

afterEach(() => {
  closeDb();
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

describe('migrations', () => {
  it('apply on first run and skip on second run', () => {
    const first = runMigrations(dbPath);
    expect(first.applied.length).toBeGreaterThan(0);
    expect(first.applied[0]).toBe('0001_initial.sql');

    closeDb();
    const second = runMigrations(dbPath);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toContain('0001_initial.sql');
  });
});

describe('seed', () => {
  it('creates personal portfolio and general project on first call', () => {
    runMigrations(dbPath);
    const r = seedDefaultPortfolioAndProject(dbPath);
    expect(r.created).toBe(true);
    expect(r.portfolioId).toBeTruthy();
    expect(r.projectId).toBeTruthy();

    const db = getDb(dbPath);
    const ps = db.select().from(portfolios).all();
    expect(ps).toHaveLength(1);
    expect(ps[0]?.name).toBe('personal');
    expect(ps[0]?.userId).toBe('local-user');

    const projs = db.select().from(projects).all();
    expect(projs).toHaveLength(1);
    expect(projs[0]?.slug).toBe('general');
  });

  it('is idempotent — second call returns existing', () => {
    runMigrations(dbPath);
    const first = seedDefaultPortfolioAndProject(dbPath);
    const second = seedDefaultPortfolioAndProject(dbPath);
    expect(second.created).toBe(false);
    expect(second.portfolioId).toBe(first.portfolioId);
    expect(second.projectId).toBe(first.projectId);
  });
});

describe('round-trip + cascade delete', () => {
  it('inserts survive process restart and user_id always populated', () => {
    runMigrations(dbPath);
    const { projectId } = seedDefaultPortfolioAndProject(dbPath);

    const db = getDb(dbPath);
    const [item] = db
      .insert(workItems)
      .values({
        projectId,
        type: 'story',
        title: 'First story',
        description: 'Verify round-trip works',
      })
      .returning()
      .all();
    expect(item).toBeDefined();
    if (!item) throw new Error('insert failed');
    expect(item.userId).toBe('local-user');
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(item.status).toBe('backlog');

    db.insert(comments)
      .values({
        projectId,
        workItemId: item.id,
        author: 'cursor-background-agent',
        body: 'Picked up',
      })
      .run();

    // Simulate restart
    closeDb();
    const db2 = getDb(dbPath);
    const found = db2.select().from(workItems).where(eq(workItems.id, item.id)).get();
    expect(found?.title).toBe('First story');
    const cs = db2.select().from(comments).where(eq(comments.workItemId, item.id)).all();
    expect(cs).toHaveLength(1);
    expect(cs[0]?.author).toBe('cursor-background-agent');
  });

  it('cascades comments + work items when a project is deleted', () => {
    runMigrations(dbPath);
    const { projectId, portfolioId } = seedDefaultPortfolioAndProject(dbPath);

    const db = getDb(dbPath);
    const [item] = db
      .insert(workItems)
      .values({ projectId, type: 'task', title: 'Cascade me' })
      .returning()
      .all();
    if (!item) throw new Error('insert failed');
    db.insert(comments)
      .values({ projectId, workItemId: item.id, author: 'human', body: 'note' })
      .run();

    db.delete(projects).where(eq(projects.id, projectId)).run();

    expect(db.select().from(workItems).all()).toHaveLength(0);
    expect(db.select().from(comments).all()).toHaveLength(0);
    expect(db.select().from(portfolios).where(eq(portfolios.id, portfolioId)).all()).toHaveLength(
      1,
    );
  });
});
