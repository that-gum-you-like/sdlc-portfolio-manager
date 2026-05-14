import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson, slugify } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects } from '@/db/schema';

export const dynamic = 'force-dynamic';

const CreateProjectBody = z.object({
  portfolioId: z.string().uuid(),
  name: z.string().min(1).max(80),
  slug: z.string().min(1).max(64).optional(),
  description: z.string().max(1000).optional(),
  targetRepoPath: z.string().max(500).optional(),
});

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const portfolioId = url.searchParams.get('portfolioId');
  const db = getDb();
  const baseWhere = eq(projects.userId, currentUserId());
  const rows = portfolioId
    ? db.select().from(projects).where(and(baseWhere, eq(projects.portfolioId, portfolioId))).all()
    : db.select().from(projects).where(baseWhere).all();
  return NextResponse.json({ projects: rows });
}

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CreateProjectBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const portfolio = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, parsed.data.portfolioId), eq(portfolios.userId, currentUserId())))
    .get();
  if (!portfolio) return apiError('portfolio_not_found', 'Portfolio not found', 404);

  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  if (slug.length === 0) {
    return apiError('invalid_slug', 'Slug could not be derived from name; provide explicitly', 400);
  }

  const conflict = db
    .select()
    .from(projects)
    .where(and(eq(projects.portfolioId, parsed.data.portfolioId), eq(projects.slug, slug)))
    .get();
  if (conflict) {
    return apiError('project_slug_taken', 'A project with that slug already exists in this portfolio', 409);
  }

  const [row] = db
    .insert(projects)
    .values({
      portfolioId: parsed.data.portfolioId,
      userId: currentUserId(),
      name: parsed.data.name,
      slug,
      description: parsed.data.description,
      targetRepoPath: parsed.data.targetRepoPath,
    })
    .returning()
    .all();
  return NextResponse.json({ project: row }, { status: 201 });
}
