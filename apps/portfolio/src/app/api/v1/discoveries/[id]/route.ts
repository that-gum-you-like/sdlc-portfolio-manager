import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveries, discoveryDrafts } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const PatchBody = z.object({
  appendText: z.string().min(1).max(50_000).optional(),
  status: z.enum(['draft', 'generating', 'reviewing', 'accepted', 'archived']).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();
  const d = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.id, id), eq(discoveries.userId, userId)))
    .get();
  if (!d) return apiError('not_found', 'Discovery not found', 404);
  const drafts = db
    .select()
    .from(discoveryDrafts)
    .where(and(eq(discoveryDrafts.discoveryId, id), eq(discoveryDrafts.userId, userId)))
    .orderBy(asc(discoveryDrafts.createdAt))
    .all();
  return NextResponse.json({ discovery: d, drafts });
}

export async function PATCH(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const userId = currentUserId();
  const existing = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.id, id), eq(discoveries.userId, userId)))
    .get();
  if (!existing) return apiError('not_found', 'Discovery not found', 404);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.appendText !== undefined) {
    const sep = existing.rawDump.endsWith('\n') ? '' : '\n\n';
    updates.rawDump = `${existing.rawDump}${sep}${parsed.data.appendText}`;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [updated] = db
    .update(discoveries)
    .set(updates)
    .where(eq(discoveries.id, id))
    .returning()
    .all();
  return NextResponse.json({ discovery: updated });
}
