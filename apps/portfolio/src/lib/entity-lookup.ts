import { and, eq, inArray } from 'drizzle-orm';

import { getDb } from '@/db';
import { portfolios, projects, workItems } from '@/db/schema';
import { currentUserId } from '@/lib/auth';
import type { EntityType } from '@/lib/relationships';

export interface EntitySummary {
  id: string;
  type: EntityType;
  title: string;
}

function summarizePortfolio(p: { id: string; name: string }): EntitySummary {
  return { id: p.id, type: 'portfolio', title: p.name };
}

function summarizeProject(p: { id: string; name: string }): EntitySummary {
  return { id: p.id, type: 'project', title: p.name };
}

function summarizeWorkItem(w: { id: string; title: string }): EntitySummary {
  return { id: w.id, type: 'work_item', title: w.title };
}

export function lookupEntity(type: EntityType, id: string): EntitySummary | null {
  const db = getDb();
  const userId = currentUserId();
  if (type === 'portfolio') {
    const row = db
      .select({ id: portfolios.id, name: portfolios.name })
      .from(portfolios)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .get();
    return row ? summarizePortfolio(row) : null;
  }
  if (type === 'project') {
    const row = db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .get();
    return row ? summarizeProject(row) : null;
  }
  const row = db
    .select({ id: workItems.id, title: workItems.title })
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  return row ? summarizeWorkItem(row) : null;
}

export function lookupEntities(
  refs: Array<{ type: EntityType; id: string }>,
): Map<string, EntitySummary> {
  const result = new Map<string, EntitySummary>();
  if (refs.length === 0) return result;
  const db = getDb();
  const userId = currentUserId();

  const portfolioIds = refs.filter((r) => r.type === 'portfolio').map((r) => r.id);
  const projectIds = refs.filter((r) => r.type === 'project').map((r) => r.id);
  const workItemIds = refs.filter((r) => r.type === 'work_item').map((r) => r.id);

  if (portfolioIds.length > 0) {
    const rows = db
      .select({ id: portfolios.id, name: portfolios.name })
      .from(portfolios)
      .where(and(inArray(portfolios.id, portfolioIds), eq(portfolios.userId, userId)))
      .all();
    for (const r of rows) result.set(`portfolio:${r.id}`, summarizePortfolio(r));
  }
  if (projectIds.length > 0) {
    const rows = db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(and(inArray(projects.id, projectIds), eq(projects.userId, userId)))
      .all();
    for (const r of rows) result.set(`project:${r.id}`, summarizeProject(r));
  }
  if (workItemIds.length > 0) {
    const rows = db
      .select({ id: workItems.id, title: workItems.title })
      .from(workItems)
      .where(and(inArray(workItems.id, workItemIds), eq(workItems.userId, userId)))
      .all();
    for (const r of rows) result.set(`work_item:${r.id}`, summarizeWorkItem(r));
  }
  return result;
}
