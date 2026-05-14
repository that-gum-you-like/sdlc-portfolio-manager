import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';

import { closeDb, getDb } from './index.ts';
import { runMigrations } from './migrate.ts';
import { seedDefaultPortfolioAndProject } from './seed.ts';
import { relationships, workItems } from './schema.ts';

let workDir: string;
let dbPath: string;
let projectId: string;

beforeEach(() => {
  closeDb();
  workDir = mkdtempSync(join(tmpdir(), 'sdlc-pm-rel-test-'));
  dbPath = join(workDir, 'data.sqlite');
  runMigrations(dbPath);
  const seed = seedDefaultPortfolioAndProject(dbPath);
  projectId = seed.projectId;
});

afterEach(() => {
  closeDb();
  if (existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
});

function createItem(title: string) {
  const db = getDb(dbPath);
  const [row] = db
    .insert(workItems)
    .values({ projectId, type: 'task', title })
    .returning()
    .all();
  if (!row) throw new Error('failed to create item');
  return row;
}

describe('relationships', () => {
  it('schema enforces no self-edge (CHECK constraint)', () => {
    const db = getDb(dbPath);
    const a = createItem('A');
    expect(() =>
      db
        .insert(relationships)
        .values({
          sourceType: 'work_item',
          sourceId: a.id,
          targetType: 'work_item',
          targetId: a.id,
          type: 'blocks',
        })
        .run(),
    ).toThrow();
  });

  it('schema enforces unique edge per (source, target, type)', () => {
    const db = getDb(dbPath);
    const a = createItem('A');
    const b = createItem('B');
    db.insert(relationships)
      .values({
        sourceType: 'work_item',
        sourceId: a.id,
        targetType: 'work_item',
        targetId: b.id,
        type: 'blocks',
      })
      .run();
    expect(() =>
      db
        .insert(relationships)
        .values({
          sourceType: 'work_item',
          sourceId: a.id,
          targetType: 'work_item',
          targetId: b.id,
          type: 'blocks',
        })
        .run(),
    ).toThrow();
  });

  it('different types between same pair are allowed', () => {
    const db = getDb(dbPath);
    const a = createItem('A');
    const b = createItem('B');
    db.insert(relationships)
      .values({
        sourceType: 'work_item',
        sourceId: a.id,
        targetType: 'work_item',
        targetId: b.id,
        type: 'blocks',
      })
      .run();
    db.insert(relationships)
      .values({
        sourceType: 'work_item',
        sourceId: a.id,
        targetType: 'work_item',
        targetId: b.id,
        type: 'related_to',
      })
      .run();
    const rows = db
      .select()
      .from(relationships)
      .where(
        and(eq(relationships.sourceId, a.id), eq(relationships.targetId, b.id)),
      )
      .all();
    expect(rows).toHaveLength(2);
  });

  it('cascade delete from work_items leaves stale relationship rows (FK is on the table-level CASCADE only)', () => {
    // Relationships table does not have FK on source/target — they are polymorphic
    // and the API layer is responsible for cleanup. This test documents the behavior.
    const db = getDb(dbPath);
    const a = createItem('A');
    const b = createItem('B');
    db.insert(relationships)
      .values({
        sourceType: 'work_item',
        sourceId: a.id,
        targetType: 'work_item',
        targetId: b.id,
        type: 'blocks',
      })
      .run();
    db.delete(workItems).where(eq(workItems.id, a.id)).run();
    const stale = db.select().from(relationships).all();
    // Documenting current behavior: stale row remains. Future: a sweeper or
    // app-level handler should clean these up; not blocking MVP.
    expect(stale).toHaveLength(1);
  });
});
