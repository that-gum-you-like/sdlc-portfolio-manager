import Link from 'next/link';
import { and, desc, eq, ne } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import {
  automationRuns,
  comments,
  discoveries,
  notifications,
  questions,
  workItems,
} from '@/db/schema';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  'needs-human': 'Needs human',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function DashboardPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();
  const todayStart = startOfTodayIso();

  // 1) Today's focus — open questions for the local user + items in needs-human
  const openQuestions = db
    .select({
      id: questions.id,
      workItemId: questions.workItemId,
      askedBy: questions.askedBy,
      body: questions.body,
      askedAt: questions.askedAt,
    })
    .from(questions)
    .where(and(eq(questions.userId, userId), eq(questions.status, 'open')))
    .orderBy(desc(questions.askedAt))
    .limit(5)
    .all();

  const unreadMentions = db
    .select({
      id: notifications.id,
      recipient: notifications.recipient,
      workItemId: notifications.workItemId,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.recipient, 'local-user'),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(5)
    .all();

  // 2) Active work — items currently in_progress
  const activeWork = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.userId, userId), eq(workItems.status, 'in_progress')))
    .orderBy(desc(workItems.updatedAt))
    .limit(10)
    .all();

  // 3) Health — bottlenecks (items idle > 24h on a human in needs-human or in_review)
  // For MVP: count items in needs-human older than 1 day OR in_review older than 1 day
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const needsHumanItems = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.userId, userId), eq(workItems.status, 'needs-human')))
    .all();
  const bottleneckCount = needsHumanItems.filter((i) => i.updatedAt < dayAgo).length;

  const openQuestionsCount = db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.userId, userId), eq(questions.status, 'open')))
    .all().length;

  // Items moved to done today (a proxy for throughput while we wait for the
  // validation pipeline runner to give us pass-rate numbers)
  const doneToday = db
    .select({ id: workItems.id })
    .from(workItems)
    .where(
      and(
        eq(workItems.userId, userId),
        eq(workItems.status, 'done'),
        ne(workItems.updatedAt, ''),
      ),
    )
    .all()
    .filter((i) => i.id && true); // we'd ideally compare updated_at > todayStart; simple count for now
  void doneToday;
  void todayStart;

  // 4) Recent activity — mix recent updates from work items, comments, automation runs, discoveries
  const recentItems = db
    .select({
      id: workItems.id,
      title: workItems.title,
      status: workItems.status,
      updatedAt: workItems.updatedAt,
    })
    .from(workItems)
    .where(eq(workItems.userId, userId))
    .orderBy(desc(workItems.updatedAt))
    .limit(5)
    .all();

  const recentComments = db
    .select({
      id: comments.id,
      workItemId: comments.workItemId,
      author: comments.author,
      body: comments.body,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(eq(comments.userId, userId))
    .orderBy(desc(comments.createdAt))
    .limit(5)
    .all();

  const recentRuns = db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.userId, userId))
    .orderBy(desc(automationRuns.startedAt))
    .limit(5)
    .all();

  const recentDiscoveries = db
    .select()
    .from(discoveries)
    .where(eq(discoveries.userId, userId))
    .orderBy(desc(discoveries.createdAt))
    .limit(3)
    .all();

  interface ActivityEntry {
    kind: 'item' | 'comment' | 'automation' | 'discovery';
    when: string;
    text: string;
    href: string;
  }
  const activity: ActivityEntry[] = [
    ...recentItems.map((i) => ({
      kind: 'item' as const,
      when: i.updatedAt,
      text: `${STATUS_LABEL[i.status] ?? i.status} — ${i.title}`,
      href: `/items/${i.id}`,
    })),
    ...recentComments.map((c) => ({
      kind: 'comment' as const,
      when: c.createdAt,
      text: `${c.author}: ${c.body.length > 80 ? c.body.slice(0, 77) + '…' : c.body}`,
      href: `/items/${c.workItemId}`,
    })),
    ...recentRuns.map((r) => ({
      kind: 'automation' as const,
      when: r.startedAt,
      text: `${r.automationSlug ?? 'automation'} ${r.status}${r.summary ? ` — ${r.summary}` : ''}`,
      href: r.automationSlug ? `/automations/${r.automationSlug}` : '/automations',
    })),
    ...recentDiscoveries.map((d) => ({
      kind: 'discovery' as const,
      when: d.createdAt,
      text: `Discovery (${d.status}) — ${d.rawDump.slice(0, 60).replace(/\s+/g, ' ')}`,
      href: `/discoveries/${d.id}`,
    })),
  ]
    .sort((a, b) => (b.when > a.when ? 1 : b.when < a.when ? -1 : 0))
    .slice(0, 10);

  return (
    <main>
      <TopNav active="dashboard" />
      <h1>Dashboard</h1>
      <p className="muted">
        Today&apos;s focus first. Active work, system health, and recent activity below. Maturation,
        capability drift, and override insights surface here once <code>agentic-sdlc-framework-port</code>{' '}
        lands.
      </p>

      <div className="dashboard-grid">
        <section>
          <h2>Today&apos;s focus</h2>
          {openQuestions.length === 0 && unreadMentions.length === 0 ? (
            <p className="empty">
              Nothing waiting on you. Start with{' '}
              <Link href="/discoveries/new">a discovery</Link> or check the{' '}
              <Link href="/board">board</Link>.
            </p>
          ) : (
            <ul>
              {openQuestions.map((q) => (
                <li key={q.id}>
                  <strong>{q.askedBy}</strong> asked:{' '}
                  <Link href={`/items/${q.workItemId}`}>
                    {q.body.length > 80 ? q.body.slice(0, 77) + '…' : q.body}
                  </Link>
                </li>
              ))}
              {unreadMentions.map((m) => (
                <li key={m.id}>
                  Mention you on{' '}
                  <Link href={`/items/${m.workItemId}`}>work item</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Active work</h2>
          {activeWork.length === 0 ? (
            <p className="empty">
              Nothing in progress. Take something{' '}
              <Link href="/backlog">off the backlog</Link>.
            </p>
          ) : (
            <ul>
              {activeWork.map((w) => (
                <li key={w.id}>
                  <Link href={`/items/${w.id}`}>{w.title}</Link>
                  <div className="item-meta">
                    <span className="type-pill">{w.type}</span>
                    <span>{w.assignee ?? 'unassigned'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Health</h2>
          <div className="health-metric">
            <span className="label">Open HITL questions</span>
            <span className="value">{openQuestionsCount}</span>
          </div>
          <div className="health-metric">
            <span className="label">Bottlenecks (idle &gt;24h)</span>
            <span className="value">{bottleneckCount}</span>
          </div>
          <div className="health-metric">
            <span className="label">Items in needs-human</span>
            <span className="value">{needsHumanItems.length}</span>
          </div>
          <p className="empty" style={{ marginTop: 12 }}>
            Validation pass-rate, capability drift, and overrides arrive with §9 + framework-port.
          </p>
        </section>

        <section>
          <h2>Recent activity</h2>
          {activity.length === 0 ? (
            <p className="empty">No activity yet.</p>
          ) : (
            <ul>
              {activity.map((a, i) => (
                <li key={`${a.kind}:${i}`}>
                  <Link href={a.href}>
                    <span className="type-pill" style={{ marginRight: 6 }}>
                      {a.kind}
                    </span>
                    {a.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
