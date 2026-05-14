import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { questions, workItems } from '@/db/schema';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();

  const openQuestions = db
    .select({
      id: questions.id,
      workItemId: questions.workItemId,
      askedBy: questions.askedBy,
      addressedTo: questions.addressedTo,
      body: questions.body,
      askedAt: questions.askedAt,
      itemTitle: workItems.title,
      itemType: workItems.type,
    })
    .from(questions)
    .leftJoin(workItems, eq(questions.workItemId, workItems.id))
    .where(and(eq(questions.userId, userId), eq(questions.status, 'open')))
    .orderBy(asc(questions.askedAt))
    .all();

  return (
    <main>
      <TopNav active="inbox" />
      <h1>Inbox</h1>
      <p className="muted">
        Open questions across all work items. Mentions and assignment notifications surface here too
        as Section 7 grows out (full mentions/assignments list arrives next pass).
      </p>

      {openQuestions.length === 0 ? (
        <div className="empty-state">
          Nothing waiting on you. Take a look at the <Link href="/board">board</Link> when you&apos;re
          ready to move work.
        </div>
      ) : (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {openQuestions.map((q) => (
            <li key={q.id} className="card">
              <div className="comment-meta">
                <strong>{q.askedBy}</strong>
                <span>{new Date(q.askedAt).toLocaleString()}</span>
                {q.addressedTo ? (
                  <span className="comment-kind-pill">to @{q.addressedTo}</span>
                ) : null}
              </div>
              <p style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{q.body}</p>
              <p className="muted" style={{ fontSize: 13 }}>
                on{' '}
                <Link href={`/items/${q.workItemId}`}>
                  {q.itemTitle ?? 'work item'}{' '}
                  <span className="type-pill">{q.itemType ?? 'unknown'}</span>
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
