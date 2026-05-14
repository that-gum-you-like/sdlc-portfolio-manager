import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb, getRawDb } from '@/db';
import {
  comments,
  mentions,
  notifications,
  questions,
  workItems,
} from '@/db/schema';
import { buildMentionRecords, parseMentions } from '@/lib/mentions';
import { allowedNextStatuses, isTransitionAllowed, type WorkItemStatus } from '@/lib/work-items';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const AnswerBody = z.object({
  author: z.string().min(1).max(120),
  body: z.string().min(1).max(50_000),
});

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, AnswerBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  const question = db
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), eq(questions.userId, userId)))
    .get();
  if (!question) return apiError('not_found', 'Question not found', 404);
  if (question.status !== 'open') {
    return apiError('question_closed', `Question is already ${question.status}`, 409);
  }

  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, question.workItemId), eq(workItems.userId, userId)))
    .get();
  if (!item) return apiError('work_item_missing', 'Linked work item not found', 404);

  // Parse mentions in the answer body for the recipient fan-out
  const mentionRows = buildMentionRecords(parseMentions(parsed.data.body));

  const result = raw.transaction(() => {
    // Insert the answer as a comment so it joins the regular thread
    const [answerComment] = db
      .insert(comments)
      .values({
        userId,
        projectId: item.projectId,
        workItemId: item.id,
        author: parsed.data.author,
        body: parsed.data.body,
        kind: 'note',
      })
      .returning()
      .all();
    if (!answerComment) throw new Error('failed to insert answer comment');

    // Mark the question answered
    const now = new Date().toISOString();
    db.update(questions)
      .set({
        status: 'answered',
        answeredAt: now,
        answerId: answerComment.id,
      })
      .where(eq(questions.id, id))
      .run();

    // Fan out mention notifications from the answer body
    for (const m of mentionRows) {
      db.insert(mentions)
        .values({
          userId,
          sourceType: 'comment',
          sourceId: answerComment.id,
          workItemId: item.id,
          mentionedHandle: m.handle,
          resolvedUserId: m.resolvedUserId,
          resolvedAgentName: m.resolvedAgentName,
        })
        .run();
      const recipient = m.resolvedUserId ?? m.resolvedAgentName;
      if (recipient) {
        db.insert(notifications)
          .values({
            userId,
            recipient,
            kind: 'mention',
            sourceId: answerComment.id,
            workItemId: item.id,
          })
          .run();
      }
    }

    // Send an "answer" notification to the original asker
    db.insert(notifications)
      .values({
        userId,
        recipient: question.askedBy,
        kind: 'answer',
        sourceId: id,
        workItemId: item.id,
      })
      .run();

    // If this was the last open question on the item, restore to previous_status
    const remainingOpen = db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(
          eq(questions.workItemId, item.id),
          eq(questions.status, 'open'),
          ne(questions.id, id),
        ),
      )
      .all();

    let workItemUpdate: { restored: boolean; to: string | null } = { restored: false, to: null };
    if (remainingOpen.length === 0 && item.status === 'needs-human') {
      const target = (item.previousStatus ?? 'in_progress') as WorkItemStatus;
      // Validate the restoration is allowed; if not, fall back to in_progress.
      const safeTarget = isTransitionAllowed('needs-human', target)
        ? target
        : (allowedNextStatuses('needs-human')[0] ?? 'in_progress');
      db.update(workItems)
        .set({ status: safeTarget, previousStatus: null, updatedAt: now })
        .where(eq(workItems.id, item.id))
        .run();
      workItemUpdate = { restored: true, to: safeTarget };
    }

    return { answerCommentId: answerComment.id, workItemUpdate };
  });

  const r = result();
  return NextResponse.json({
    question: { ...question, status: 'answered', answerId: r.answerCommentId },
    workItem: r.workItemUpdate,
  });
}
