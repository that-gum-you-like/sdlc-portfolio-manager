import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { ClaimBody } from '@/lib/work-items';
import { getDb, getRawDb } from '@/db';
import { workItems, workItemStatusChanges } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, ClaimBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  // Atomic claim: only succeeds if currently `ready`. better-sqlite3 is synchronous,
  // so wrapping in a transaction gives serialization for concurrent calls.
  const tx = raw.transaction(() => {
    const existing = db
      .select()
      .from(workItems)
      .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
      .get();
    if (!existing) return { kind: 'not_found' as const };
    if (existing.status !== 'ready') {
      return { kind: 'conflict' as const, current: existing.status };
    }
    const now = new Date().toISOString();
    const [updated] = db
      .update(workItems)
      .set({
        status: 'in_progress',
        assignee: parsed.data.agent,
        updatedAt: now,
      })
      .where(and(eq(workItems.id, id), eq(workItems.status, 'ready')))
      .returning()
      .all();
    if (!updated) return { kind: 'conflict' as const, current: 'unknown' };
    db.insert(workItemStatusChanges)
      .values({
        userId,
        projectId: updated.projectId,
        workItemId: updated.id,
        fromStatus: 'ready',
        toStatus: 'in_progress',
        changedBy: parsed.data.agent,
      })
      .run();
    return { kind: 'ok' as const, item: updated };
  });

  const result = tx();
  if (result.kind === 'not_found') {
    return apiError('not_found', 'Work item not found', 404);
  }
  if (result.kind === 'conflict') {
    return apiError(
      'not_ready',
      `Work item is not in 'ready' status (current: ${result.current})`,
      409,
      { current: result.current },
    );
  }
  return NextResponse.json({ workItem: result.item });
}

// Suppress unused import warning for sql (kept for future query needs)
void sql;
