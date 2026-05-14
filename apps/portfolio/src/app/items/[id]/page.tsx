import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects, workItems } from '@/db/schema';
import type { WorkItemStatus } from '@/lib/work-items';
import { TopNav } from '@/components/top-nav';
import { RelatedPanel } from '@/components/related-panel';
import { CommentsThread } from '@/components/comments-thread';
import { PendingQuestions } from '@/components/pending-questions';
import { ValidationPanel } from '@/components/validation-panel';
import { TrajectoryPanel } from '@/components/trajectory-panel';
import { StatusControl } from './status-control';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

interface AcceptanceCriterion {
  id: string;
  text: string;
}

function parseCriteria(raw: string): AcceptanceCriterion[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as AcceptanceCriterion[];
  } catch {
    /* ignore */
  }
  return [];
}

function parseLabels(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    /* ignore */
  }
  return [];
}

const STATUS_LABELS: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  'needs-human': 'Needs human',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

export default async function ItemDetailPage({ params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();

  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  if (!item) notFound();

  const project = db
    .select()
    .from(projects)
    .where(eq(projects.id, item.projectId))
    .get();
  const portfolio = project
    ? db.select().from(portfolios).where(eq(portfolios.id, project.portfolioId)).get()
    : null;

  const parent = item.parentId
    ? db
        .select()
        .from(workItems)
        .where(and(eq(workItems.id, item.parentId), eq(workItems.userId, userId)))
        .get()
    : null;
  const children = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.parentId, item.id), eq(workItems.userId, userId)))
    .all();

  const criteria = parseCriteria(item.acceptanceCriteria);
  const labels = parseLabels(item.labels);

  return (
    <main>
      <TopNav />
      <nav className="muted" aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/portfolios">Portfolios</Link>
        {portfolio ? (
          <>
            {' › '}
            <Link href={`/portfolios/${portfolio.id}`}>{portfolio.name}</Link>
          </>
        ) : null}
        {project ? (
          <>
            {' › '}
            <Link href={`/projects/${project.slug}`}>{project.name}</Link>
          </>
        ) : null}
        {' › '}
        <span>{item.type}</span>
      </nav>

      <h1>{item.title}</h1>

      <div className="detail-grid">
        <div>
          <h3>Description</h3>
          {item.description ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{item.description}</p>
          ) : (
            <p className="muted">No description.</p>
          )}

          {criteria.length > 0 ? (
            <>
              <h3>Acceptance criteria</h3>
              <ol className="acceptance-list">
                {criteria.map((ac) => (
                  <li key={ac.id}>
                    <span className="ac-id">{ac.id}</span>
                    <span>{ac.text}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          <h3>Status</h3>
          <p>Current: {STATUS_LABELS[item.status as WorkItemStatus]}</p>
          <StatusControl itemId={item.id} current={item.status as WorkItemStatus} />

          {parent ? (
            <>
              <h3>Parent</h3>
              <p>
                <Link href={`/items/${parent.id}`}>{parent.title}</Link>{' '}
                <span className="type-pill">{parent.type}</span>
              </p>
            </>
          ) : null}

          {children.length > 0 ? (
            <>
              <h3>Children ({children.length})</h3>
              <ul>
                {children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/items/${c.id}`}>{c.title}</Link>{' '}
                    <span className="muted">— {STATUS_LABELS[c.status as WorkItemStatus]}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <aside className="sidebar">
          <h3>Details</h3>
          <dl>
            <dt>Type</dt>
            <dd>{item.type}</dd>
            <dt>Status</dt>
            <dd>{STATUS_LABELS[item.status as WorkItemStatus]}</dd>
            <dt>Assignee</dt>
            <dd>{item.assignee ?? <span className="muted">unassigned</span>}</dd>
            {labels.length > 0 ? (
              <>
                <dt>Labels</dt>
                <dd>{labels.join(', ')}</dd>
              </>
            ) : null}
            <dt>Created</dt>
            <dd>{new Date(item.createdAt).toLocaleString()}</dd>
            <dt>Updated</dt>
            <dd>{new Date(item.updatedAt).toLocaleString()}</dd>
            <dt>ID</dt>
            <dd>
              <code style={{ fontSize: 11 }}>{item.id.slice(0, 8)}</code>
            </dd>
          </dl>
          <RelatedPanel entityType="work_item" entityId={item.id} />
        </aside>
      </div>

      <ValidationPanel workItemId={item.id} />
      <TrajectoryPanel workItemId={item.id} />
      <PendingQuestions workItemId={item.id} />
      <CommentsThread workItemId={item.id} />
    </main>
  );
}
