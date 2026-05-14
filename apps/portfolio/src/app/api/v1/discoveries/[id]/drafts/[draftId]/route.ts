import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveries, discoveryDrafts } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string; draftId: string }>;
}

const PatchBody = z.object({
  draftData: z.record(z.unknown()).optional(),
  status: z.enum(['pending', 'accepted', 'rejected', 'edited']).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  ensureInitialized();
  const { id, draftId } = await params;
  const parsed = await parseJson(request, PatchBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const userId = currentUserId();

  const draft = db
    .select()
    .from(discoveryDrafts)
    .where(
      and(
        eq(discoveryDrafts.id, draftId),
        eq(discoveryDrafts.discoveryId, id),
        eq(discoveryDrafts.userId, userId),
      ),
    )
    .get();
  if (!draft) return apiError('not_found', 'Draft not found', 404);

  // Ensure the discovery exists and is the user's
  const discovery = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.id, id), eq(discoveries.userId, userId)))
    .get();
  if (!discovery) return apiError('not_found', 'Discovery not found', 404);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.draftData !== undefined) {
    updates.draftData = JSON.stringify(parsed.data.draftData);
    // Editing pending → edited so users can see which drafts were tweaked
    if (draft.status === 'pending' && parsed.data.status === undefined) {
      updates.status = 'edited';
    }
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [updated] = db
    .update(discoveryDrafts)
    .set(updates)
    .where(eq(discoveryDrafts.id, draftId))
    .returning()
    .all();
  return NextResponse.json({ draft: updated });
}
