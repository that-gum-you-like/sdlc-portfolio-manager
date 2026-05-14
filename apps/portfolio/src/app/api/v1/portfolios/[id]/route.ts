import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects } from '@/db/schema';

export const dynamic = 'force-dynamic';

const UpdateBody = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(1000).nullable().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const row = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, currentUserId())))
    .get();
  if (!row) return apiError('not_found', 'Portfolio not found', 404);
  const projectRows = db
    .select()
    .from(projects)
    .where(and(eq(projects.portfolioId, id), eq(projects.userId, currentUserId())))
    .all();
  return NextResponse.json({ portfolio: row, projects: projectRows });
}

export async function PATCH(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, UpdateBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const existing = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, currentUserId())))
    .get();
  if (!existing) return apiError('not_found', 'Portfolio not found', 404);

  const [updated] = db
    .update(portfolios)
    .set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(portfolios.id, id))
    .returning()
    .all();
  return NextResponse.json({ portfolio: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const existing = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, currentUserId())))
    .get();
  if (!existing) return apiError('not_found', 'Portfolio not found', 404);
  db.delete(portfolios).where(eq(portfolios.id, id)).run();
  return new NextResponse(null, { status: 204 });
}
