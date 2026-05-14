import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, ne } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { workItems, type WorkItem } from '@/db/schema';
import { BOARD_COLUMN_ORDER, type WorkItemStatus } from '@/lib/work-items';
import { findProjectBySlug, listAllProjects } from '@/lib/project-context';
import { TopNav } from '@/components/top-nav';
import { ProjectContextBar } from '@/components/project-context-bar';
import { ValidationDots } from '@/components/validation-panel';
import { NewItemForm } from '@/app/board/new-item-form';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

const COLUMN_LABELS: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  'needs-human': 'Needs human',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

function BoardCard({ item }: { item: WorkItem }) {
  return (
    <Link href={`/items/${item.id}`} className="board-card">
      <div className="board-card-title">{item.title}</div>
      <div className="board-card-meta">
        <span className="type-pill">{item.type}</span>
        {item.assignee ? <span>{item.assignee}</span> : null}
        <ValidationDots workItemId={item.id} />
      </div>
    </Link>
  );
}

export default async function ProjectBoardPage({ params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const ctx = findProjectBySlug(slug);
  if (!ctx) notFound();

  const db = getDb();
  const userId = currentUserId();
  const items = db
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.userId, userId),
        eq(workItems.projectId, ctx.project.id),
        ne(workItems.status, 'cancelled'),
      ),
    )
    .all();

  const byStatus = new Map<WorkItemStatus, WorkItem[]>();
  for (const col of BOARD_COLUMN_ORDER) byStatus.set(col, []);
  for (const item of items) {
    const arr = byStatus.get(item.status as WorkItemStatus);
    if (arr) arr.push(item);
  }

  const allProjects = listAllProjects();

  return (
    <main>
      <TopNav active="portfolios" />
      <ProjectContextBar
        activeProjectSlug={ctx.project.slug}
        activeProjectName={ctx.project.name}
        activePortfolioName={ctx.portfolio.name}
        activePortfolioId={ctx.portfolio.id}
        allProjects={allProjects}
        subRoute="board"
      />

      <h1>{ctx.project.name} board</h1>
      <p className="muted">
        {items.length} open work item{items.length === 1 ? '' : 's'} in this project.
      </p>

      <NewItemForm projects={[{ id: ctx.project.id, name: ctx.project.name, slug: ctx.project.slug }]} />

      <div className="board" role="list">
        {BOARD_COLUMN_ORDER.map((col) => {
          const cards = byStatus.get(col) ?? [];
          return (
            <section
              key={col}
              className={`board-column ${col === 'needs-human' ? 'needs-human' : ''}`}
              role="listitem"
            >
              <h3>
                <span>{COLUMN_LABELS[col]}</span>
                <span className="count">{cards.length}</span>
              </h3>
              {cards.map((item) => <BoardCard key={item.id} item={item} />)}
            </section>
          );
        })}
      </div>
    </main>
  );
}
