import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { questions, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['open', 'answered', 'cancelled']);

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const recipient = url.searchParams.get('recipient');
  const status = (url.searchParams.get('status') ?? 'open').toLowerCase();
  if (!VALID_STATUSES.has(status)) {
    return apiError('invalid_status_filter', `Unknown status: ${status}`, 400);
  }

  const db = getDb();
  const userId = currentUserId();

  const conditions = [
    eq(questions.userId, userId),
    eq(questions.status, status as 'open' | 'answered' | 'cancelled'),
  ];
  if (recipient) {
    conditions.push(eq(questions.addressedTo, recipient));
  }

  const rows = db
    .select({
      id: questions.id,
      workItemId: questions.workItemId,
      askedBy: questions.askedBy,
      addressedTo: questions.addressedTo,
      body: questions.body,
      status: questions.status,
      askedAt: questions.askedAt,
      answeredAt: questions.answeredAt,
      itemTitle: workItems.title,
      itemType: workItems.type,
      projectId: questions.projectId,
    })
    .from(questions)
    .leftJoin(workItems, eq(questions.workItemId, workItems.id))
    .where(and(...conditions))
    .orderBy(asc(questions.askedAt))
    .all();

  return NextResponse.json({ questions: rows });
}
