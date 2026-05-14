import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { buildMentionRecords, parseMentions } from '@/lib/mentions';
import { getDb, getRawDb } from '@/db';
import { comments, evidenceLinks, mentions, notifications, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const CommentBody = z.object({
  author: z.string().min(1).max(120),
  body: z.string().min(1).max(50_000),
  kind: z.enum(['note', 'evidence']).optional(),
  criterionId: z.string().min(1).max(32).optional(),
});

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

  const rows = db
    .select()
    .from(comments)
    .where(and(eq(comments.workItemId, id), eq(comments.userId, userId)))
    .orderBy(asc(comments.createdAt))
    .all();
  return NextResponse.json({ comments: rows });
}

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, CommentBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  if (!item) return apiError('not_found', 'Work item not found', 404);

  const kind = parsed.data.kind ?? 'note';

  // Validate evidence comments link to an actual acceptance criterion on the item.
  if (kind === 'evidence') {
    if (!parsed.data.criterionId) {
      return apiError(
        'criterion_required',
        'Evidence comments must specify a criterionId',
        400,
      );
    }
    let criteriaList: Array<{ id: string; text?: string }> = [];
    try {
      criteriaList = JSON.parse(item.acceptanceCriteria) as Array<{ id: string; text?: string }>;
    } catch {
      criteriaList = [];
    }
    const match = criteriaList.find((c) => c.id === parsed.data.criterionId);
    if (!match) {
      return apiError(
        'criterion_not_found',
        `Acceptance criterion ${parsed.data.criterionId} not found on this work item`,
        400,
      );
    }
  }

  const mentionMatches = parseMentions(parsed.data.body);
  const mentionRows = buildMentionRecords(mentionMatches);

  const result = raw.transaction(() => {
    const [comment] = db
      .insert(comments)
      .values({
        userId,
        projectId: item.projectId,
        workItemId: item.id,
        author: parsed.data.author,
        body: parsed.data.body,
        kind,
        criterionId: parsed.data.criterionId ?? null,
      })
      .returning()
      .all();
    if (!comment) throw new Error('failed to insert comment');

    if (kind === 'evidence' && parsed.data.criterionId) {
      let criterionText: string | null = null;
      try {
        const list = JSON.parse(item.acceptanceCriteria) as Array<{ id: string; text?: string }>;
        criterionText = list.find((c) => c.id === parsed.data.criterionId)?.text ?? null;
      } catch {
        criterionText = null;
      }
      db.insert(evidenceLinks)
        .values({
          userId,
          commentId: comment.id,
          acceptanceCriterionId: parsed.data.criterionId,
          criterionTextSnapshot: criterionText,
          workItemId: item.id,
        })
        .run();
    }

    for (const m of mentionRows) {
      db.insert(mentions)
        .values({
          userId,
          sourceType: 'comment',
          sourceId: comment.id,
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
            sourceId: comment.id,
            workItemId: item.id,
          })
          .run();
      }
    }

    return { comment, mentionCount: mentionRows.length };
  });

  return NextResponse.json(result(), { status: 201 });
}
