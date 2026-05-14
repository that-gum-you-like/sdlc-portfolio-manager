import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { workItems } from '@/db/schema';
import { buildTrajectory } from '@/lib/trajectory';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();
  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  if (!item) return apiError('not_found', 'Work item not found', 404);
  const events = buildTrajectory(id);
  return NextResponse.json({ events });
}
