import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveries, questions, workItems } from '@/db/schema';
import { findProjectBySlug, listAllProjects } from '@/lib/project-context';
import { TopNav } from '@/components/top-nav';
import { ProjectContextBar } from '@/components/project-context-bar';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  'needs-human': 'Needs human',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export default async function ProjectHomePage({ params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const ctx = findProjectBySlug(slug);
  if (!ctx) notFound();

  const db = getDb();
  const userId = currentUserId();
  const items = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.projectId, ctx.project.id), eq(workItems.userId, userId)))
    .orderBy(desc(workItems.updatedAt))
    .limit(8)
    .all();

  const openQuestions = db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.projectId, ctx.project.id),
        eq(questions.userId, userId),
        eq(questions.status, 'open'),
      ),
    )
    .all();

  const recentDiscoveries = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.projectId, ctx.project.id), eq(discoveries.userId, userId)))
    .orderBy(desc(discoveries.createdAt))
    .limit(3)
    .all();

  const allProjects = listAllProjects();

  // Stats
  const allItems = db
    .select({ status: workItems.status })
    .from(workItems)
    .where(and(eq(workItems.projectId, ctx.project.id), eq(workItems.userId, userId)))
    .all();
  const open = allItems.filter((i) => i.status !== 'done' && i.status !== 'cancelled').length;
  const inProgress = allItems.filter((i) => i.status === 'in_progress').length;
  const needsHuman = allItems.filter((i) => i.status === 'needs-human').length;
  const done = allItems.filter((i) => i.status === 'done').length;

  return (
    <main>
      <TopNav active="portfolios" />
      <ProjectContextBar
        activeProjectSlug={ctx.project.slug}
        activeProjectName={ctx.project.name}
        activePortfolioName={ctx.portfolio.name}
        activePortfolioId={ctx.portfolio.id}
        allProjects={allProjects}
        subRoute="home"
      />

      <h1>{ctx.project.name}</h1>
      {ctx.project.description ? <p className="muted">{ctx.project.description}</p> : null}

      <div className="dashboard-grid">
        <section>
          <h2>Snapshot</h2>
          <div className="health-metric">
            <span className="label">Open</span>
            <span className="value">{open}</span>
          </div>
          <div className="health-metric">
            <span className="label">In progress</span>
            <span className="value">{inProgress}</span>
          </div>
          <div className="health-metric">
            <span className="label">Needs human</span>
            <span className="value">{needsHuman}</span>
          </div>
          <div className="health-metric">
            <span className="label">Done</span>
            <span className="value">{done}</span>
          </div>
        </section>

        <section>
          <h2>Pending questions</h2>
          {openQuestions.length === 0 ? (
            <p className="empty">No open questions on this project.</p>
          ) : (
            <ul>
              {openQuestions.slice(0, 5).map((q) => (
                <li key={q.id}>
                  <strong>{q.askedBy}</strong>:{' '}
                  <Link href={`/items/${q.workItemId}`}>
                    {q.body.length > 80 ? q.body.slice(0, 77) + '…' : q.body}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Recent items</h2>
          {items.length === 0 ? (
            <p className="empty">
              No items yet.{' '}
              <Link href={`/projects/${slug}/board`}>Open the board</Link> to file one or{' '}
              <Link href="/discoveries/new">start a discovery</Link>.
            </p>
          ) : (
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={`/items/${i.id}`}>{i.title}</Link>
                  <div className="item-meta">
                    <span className="type-pill">{i.type}</span>
                    <span>{STATUS_LABEL[i.status] ?? i.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Recent discoveries</h2>
          {recentDiscoveries.length === 0 ? (
            <p className="empty">
              No discoveries yet. <Link href="/discoveries/new">Start a braindump</Link>.
            </p>
          ) : (
            <ul>
              {recentDiscoveries.map((d) => (
                <li key={d.id}>
                  <Link href={`/discoveries/${d.id}`}>
                    {d.rawDump.slice(0, 60).replace(/\s+/g, ' ')}
                  </Link>
                  <div className="item-meta">
                    <span className="type-pill">{d.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
