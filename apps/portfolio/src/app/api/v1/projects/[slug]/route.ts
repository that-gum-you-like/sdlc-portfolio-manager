import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { projects } from '@/db/schema';

export const dynamic = 'force-dynamic';

const UpdateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
  targetRepoPath: z.string().max(500).nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

interface Params {
  params: Promise<{ slug: string }>;
}

function findBySlug(slug: string) {
  const db = getDb();
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.userId, currentUserId())))
    .all();
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const rows = findBySlug(slug);
  if (rows.length === 0) return apiError('not_found', 'Project not found', 404);
  if (rows.length > 1) {
    return apiError(
      'ambiguous_slug',
      'Multiple projects share this slug across portfolios; query by id or include portfolioId',
      409,
      { matches: rows.map((r) => ({ id: r.id, portfolioId: r.portfolioId })) },
    );
  }
  return NextResponse.json({ project: rows[0] });
}

export async function PATCH(request: Request, { params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const parsed = await parseJson(request, UpdateBody);
  if (!parsed.ok) return parsed.response;

  const rows = findBySlug(slug);
  if (rows.length === 0) return apiError('not_found', 'Project not found', 404);
  if (rows.length > 1) {
    return apiError('ambiguous_slug', 'Multiple projects share this slug', 409);
  }
  const existing = rows[0];
  if (!existing) return apiError('not_found', 'Project not found', 404);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.targetRepoPath !== undefined) updates.targetRepoPath = parsed.data.targetRepoPath;
  if (parsed.data.settings !== undefined) updates.settingsJson = JSON.stringify(parsed.data.settings);

  const db = getDb();
  const [updated] = db
    .update(projects)
    .set(updates)
    .where(eq(projects.id, existing.id))
    .returning()
    .all();
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const rows = findBySlug(slug);
  if (rows.length === 0) return apiError('not_found', 'Project not found', 404);
  if (rows.length > 1) {
    return apiError('ambiguous_slug', 'Multiple projects share this slug', 409);
  }
  const existing = rows[0];
  if (!existing) return apiError('not_found', 'Project not found', 404);
  const db = getDb();
  db.delete(projects).where(eq(projects.id, existing.id)).run();
  return new NextResponse(null, { status: 204 });
}
