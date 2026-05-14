import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveryDrafts } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string; draftId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id, draftId } = await params;

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
  if (draft.status === 'accepted') {
    return apiError('already_accepted', 'Cannot reject an accepted draft', 409);
  }

  const [updated] = db
    .update(discoveryDrafts)
    .set({ status: 'rejected', updatedAt: new Date().toISOString() })
    .where(eq(discoveryDrafts.id, draftId))
    .returning()
    .all();

  return NextResponse.json({ draft: updated });
}
