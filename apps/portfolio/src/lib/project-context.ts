import { and, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import { portfolios, projects } from '@/db/schema';
import { currentUserId } from './auth';

export interface ProjectContext {
  project: typeof projects.$inferSelect;
  portfolio: typeof portfolios.$inferSelect;
}

export function findProjectBySlug(slug: string): ProjectContext | null {
  const db = getDb();
  const userId = currentUserId();
  const matches = db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, userId)))
    .all();
  if (matches.length !== 1) return null;
  const project = matches[0]!;
  const portfolio = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, project.portfolioId), eq(portfolios.userId, userId)))
    .get();
  if (!portfolio) return null;
  return { project, portfolio };
}

export function findProjectByRepoPath(absPath: string): ProjectContext | null {
  const db = getDb();
  const userId = currentUserId();
  const matches = db
    .select()
    .from(projects)
    .where(and(eq(projects.targetRepoPath, absPath), eq(projects.userId, userId)))
    .all();
  if (matches.length === 0) return null;
  const project = matches[0]!;
  const portfolio = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, project.portfolioId), eq(portfolios.userId, userId)))
    .get();
  if (!portfolio) return null;
  return { project, portfolio };
}

export function listAllProjects(): Array<{ id: string; name: string; slug: string; portfolioId: string; portfolioName: string }> {
  const db = getDb();
  const userId = currentUserId();
  const rows = db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      portfolioId: projects.portfolioId,
      portfolioName: portfolios.name,
    })
    .from(projects)
    .leftJoin(portfolios, eq(portfolios.id, projects.portfolioId))
    .where(eq(projects.userId, userId))
    .all();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    portfolioId: r.portfolioId,
    portfolioName: r.portfolioName ?? '',
  }));
}
