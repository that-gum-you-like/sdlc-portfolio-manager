import { NextResponse } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { comments, mentions, notifications, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Suggestion {
  handle: string;
  kind: 'user' | 'agent';
  reason: string;
}

const HUMAN_HANDLES = ['bryce', 'me', 'you'];

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').toLowerCase();
  const userId = currentUserId();
  const db = getDb();

  const seen = new Map<string, Suggestion>();

  function add(handle: string, kind: 'user' | 'agent', reason: string) {
    if (!handle) return;
    const key = handle.toLowerCase();
    if (seen.has(key)) return;
    seen.set(key, { handle, kind, reason });
  }

  // Built-in human handles
  for (const h of HUMAN_HANDLES) add(h, 'user', 'you');

  // Distinct assignees on work items (most likely agent names)
  const assignees = db
    .selectDistinct({ assignee: workItems.assignee })
    .from(workItems)
    .where(and(eq(workItems.userId, userId), isNotNull(workItems.assignee)))
    .all();
  for (const a of assignees) {
    if (a.assignee) add(a.assignee, 'agent', 'recent assignee');
  }

  // Distinct comment authors (any non-human is an agent)
  const authors = db
    .selectDistinct({ author: comments.author })
    .from(comments)
    .where(eq(comments.userId, userId))
    .all();
  for (const a of authors) {
    if (!a.author) continue;
    const known = HUMAN_HANDLES.includes(a.author.toLowerCase());
    add(a.author, known ? 'user' : 'agent', 'recent commenter');
  }

  // Distinct mentions previously recorded (resolved agent names + handles)
  const prevMentions = db
    .selectDistinct({
      handle: mentions.mentionedHandle,
      agent: mentions.resolvedAgentName,
    })
    .from(mentions)
    .where(eq(mentions.userId, userId))
    .all();
  for (const m of prevMentions) {
    if (m.agent) add(m.agent, 'agent', 'previously mentioned');
    if (m.handle && !HUMAN_HANDLES.includes(m.handle.toLowerCase())) {
      add(m.handle, 'agent', 'previously mentioned');
    }
  }

  // Recipients of notifications (mostly agents, plus humans)
  const recipients = db
    .selectDistinct({ recipient: notifications.recipient })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .all();
  for (const r of recipients) {
    if (!r.recipient) continue;
    const isHuman = HUMAN_HANDLES.includes(r.recipient.toLowerCase()) || r.recipient === 'local-user';
    add(r.recipient, isHuman ? 'user' : 'agent', 'previously notified');
  }

  let list = Array.from(seen.values());
  if (q.length > 0) {
    list = list.filter((s) => s.handle.toLowerCase().includes(q));
    // Prefix matches rank above substring matches
    list.sort((a, b) => {
      const aPrefix = a.handle.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.handle.toLowerCase().startsWith(q) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return a.handle.localeCompare(b.handle);
    });
  } else {
    // Default: humans first, then alpha
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'user' ? -1 : 1;
      return a.handle.localeCompare(b.handle);
    });
  }

  return NextResponse.json({ suggestions: list.slice(0, 10) });
}
