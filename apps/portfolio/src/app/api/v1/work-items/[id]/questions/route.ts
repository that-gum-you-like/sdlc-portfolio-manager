import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb, getRawDb } from '@/db';
import { mentions, notifications, questions, workItems } from '@/db/schema';
import { buildMentionRecords, parseMentions } from '@/lib/mentions';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const AskBody = z.object({
  askedBy: z.string().min(1).max(120),
  body: z.string().min(1).max(50_000),
  addressedTo: z.string().min(1).max(120).optional(),
});

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();
  const rows = db
    .select()
    .from(questions)
    .where(and(eq(questions.workItemId, id), eq(questions.userId, userId)))
    .orderBy(asc(questions.askedAt))
    .all();
  return NextResponse.json({ questions: rows });
}

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, AskBody);
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

  // Determine the previous_status to record. If the item is already in
  // needs-human, reuse its existing previousStatus so we restore correctly later.
  const previousStatus =
    item.status === 'needs-human' ? item.previousStatus ?? 'in_progress' : item.status;

  // Resolve mentions in the body and from explicit addressedTo
  const bodyMentions = parseMentions(parsed.data.body);
  const mentionRows = buildMentionRecords(bodyMentions);

  const result = raw.transaction(() => {
    const [question] = db
      .insert(questions)
      .values({
        userId,
        projectId: item.projectId,
        workItemId: item.id,
        askedBy: parsed.data.askedBy,
        addressedTo: parsed.data.addressedTo ?? null,
        body: parsed.data.body,
        previousStatus,
      })
      .returning()
      .all();
    if (!question) throw new Error('failed to insert question');

    // Transition to needs-human if not already
    if (item.status !== 'needs-human') {
      db.update(workItems)
        .set({
          status: 'needs-human',
          previousStatus: item.status,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workItems.id, item.id))
        .run();
    }

    // Mentions in body
    for (const m of mentionRows) {
      db.insert(mentions)
        .values({
          userId,
          sourceType: 'question',
          sourceId: question.id,
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
            kind: 'question',
            sourceId: question.id,
            workItemId: item.id,
          })
          .run();
      }
    }

    // Explicit addressedTo notification (if not already covered by an inline @-mention)
    if (parsed.data.addressedTo) {
      const already = mentionRows.some(
        (m) =>
          (m.resolvedUserId ?? m.resolvedAgentName)?.toLowerCase() ===
          parsed.data.addressedTo?.toLowerCase(),
      );
      if (!already) {
        db.insert(notifications)
          .values({
            userId,
            recipient: parsed.data.addressedTo,
            kind: 'question',
            sourceId: question.id,
            workItemId: item.id,
          })
          .run();
      }
    }

    return question;
  });

  return NextResponse.json({ question: result() }, { status: 201 });
}
