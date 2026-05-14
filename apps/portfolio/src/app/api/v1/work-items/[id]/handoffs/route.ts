import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { handoffs, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const HandoffBody = z.object({
  fromAgent: z.string().min(1).max(120),
  toAgent: z.string().min(1).max(120),
  reason: z.string().min(1).max(2000),
  context: z.string().max(50_000).optional(),
  reassign: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();
  const rows = db
    .select()
    .from(handoffs)
    .where(and(eq(handoffs.workItemId, id), eq(handoffs.userId, userId)))
    .orderBy(asc(handoffs.createdAt))
    .all();
  return NextResponse.json({ handoffs: rows });
}

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, HandoffBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const userId = currentUserId();
  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  if (!item) return apiError('not_found', 'Work item not found', 404);
  if (parsed.data.fromAgent === parsed.data.toAgent) {
    return apiError('self_handoff', 'Cannot hand off to the same agent', 400);
  }

  const [handoff] = db
    .insert(handoffs)
    .values({
      userId,
      projectId: item.projectId,
      workItemId: item.id,
      fromAgent: parsed.data.fromAgent,
      toAgent: parsed.data.toAgent,
      reason: parsed.data.reason,
      contextBlob: parsed.data.context ?? null,
    })
    .returning()
    .all();

  // Optionally reassign the work item to the new agent (supervisor-mode flow)
  if (parsed.data.reassign !== false) {
    db.update(workItems)
      .set({ assignee: parsed.data.toAgent, updatedAt: new Date().toISOString() })
      .where(eq(workItems.id, item.id))
      .run();
  }

  return NextResponse.json({ handoff }, { status: 201 });
}
