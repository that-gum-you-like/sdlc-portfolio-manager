import { notFound } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { workItems } from '@/db/schema';
import { findProjectBySlug, listAllProjects } from '@/lib/project-context';
import { TopNav } from '@/components/top-nav';
import { ProjectContextBar } from '@/components/project-context-bar';
import { BacklogClient } from '@/app/backlog/backlog-client';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function ProjectBacklogPage({ params }: Params) {
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
        inArray(workItems.status, ['backlog', 'ready']),
      ),
    )
    .orderBy(asc(workItems.rank), asc(workItems.createdAt))
    .all();

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
        subRoute="backlog"
      />

      <h1>{ctx.project.name} backlog</h1>
      <p className="muted">
        Items in <code>backlog</code> + <code>ready</code> for this project, ordered by rank.
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
          projectName: ctx.project.name,
        }))}
      />
    </main>
  );
}
