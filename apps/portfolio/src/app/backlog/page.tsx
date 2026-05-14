import { and, asc, eq, inArray } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { projects, workItems } from '@/db/schema';
import { TopNav } from '@/components/top-nav';
import { BacklogClient } from './backlog-client';

export const dynamic = 'force-dynamic';

export default async function BacklogPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();

  const items = db
    .select()
    .from(workItems)
    .where(
      and(
        eq(workItems.userId, userId),
        inArray(workItems.status, ['backlog', 'ready']),
      ),
    )
    .orderBy(asc(workItems.rank), asc(workItems.createdAt))
    .all();

  const projectRows = db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.userId, userId))
    .all();
  const projectMap = new Map(projectRows.map((p) => [p.id, p.name]));

  return (
    <main>
      <TopNav active="backlog" />
      <h1>Backlog</h1>
      <p className="muted">
        Items in <code>backlog</code> + <code>ready</code>, ordered by rank. Move things up or down,
        and promote them to <code>ready</code> when you&apos;re ready to work them. Items in{' '}
        <code>ready</code> are eligible for Cursor Automations auto-pickup.
      </p>

      <BacklogClient
        initial={items.map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
          status: i.status as 'backlog' | 'ready',
          assignee: i.assignee,
          rank: i.rank,
          projectId: i.projectId,
          projectName: projectMap.get(i.projectId) ?? 'unknown',
        }))}
      />
    </main>
  );
}
