import Link from 'next/link';
import { and, eq, ne } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { projects, workItems, type WorkItem } from '@/db/schema';
import { BOARD_COLUMN_ORDER, type WorkItemStatus } from '@/lib/work-items';
import { TopNav } from '@/components/top-nav';
import { NewItemForm } from './new-item-form';

export const dynamic = 'force-dynamic';

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
      </div>
    </Link>
  );
}

export default async function BoardPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();

  const projectRows = db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.userId, userId))
    .all();

  const items = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.userId, userId), ne(workItems.status, 'cancelled')))
    .all();

  const byStatus = new Map<WorkItemStatus, WorkItem[]>();
  for (const col of BOARD_COLUMN_ORDER) byStatus.set(col, []);
  for (const item of items) {
    const arr = byStatus.get(item.status as WorkItemStatus);
    if (arr) arr.push(item);
  }

  return (
    <main>
      <TopNav active="board" />
      <h1>Board</h1>
      <p className="muted">
        {items.length} open work item{items.length === 1 ? '' : 's'} across{' '}
        {projectRows.length} project{projectRows.length === 1 ? '' : 's'}.
      </p>

      <NewItemForm projects={projectRows} />

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
              {cards.length === 0 ? null : cards.map((item) => <BoardCard key={item.id} item={item} />)}
            </section>
          );
        })}
      </div>
    </main>
  );
}
