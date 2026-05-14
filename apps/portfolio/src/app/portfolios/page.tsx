import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects, workItems } from '@/db/schema';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

export default async function PortfoliosPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();

  const list = db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .orderBy(desc(portfolios.createdAt))
    .all();

  const allProjects = db
    .select({
      id: projects.id,
      portfolioId: projects.portfolioId,
      name: projects.name,
      slug: projects.slug,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .all();

  const allItems = db
    .select({ id: workItems.id, projectId: workItems.projectId, status: workItems.status })
    .from(workItems)
    .where(eq(workItems.userId, userId))
    .all();

  const projectsByPortfolio = new Map<string, typeof allProjects>();
  for (const p of allProjects) {
    if (!projectsByPortfolio.has(p.portfolioId)) projectsByPortfolio.set(p.portfolioId, []);
    projectsByPortfolio.get(p.portfolioId)!.push(p);
  }

  const itemsByProject = new Map<string, { open: number; total: number }>();
  for (const i of allItems) {
    if (!itemsByProject.has(i.projectId))
      itemsByProject.set(i.projectId, { open: 0, total: 0 });
    const c = itemsByProject.get(i.projectId)!;
    c.total += 1;
    if (i.status !== 'done' && i.status !== 'cancelled') c.open += 1;
  }

  return (
    <main>
      <TopNav active="portfolios" />
      <h1>Portfolios</h1>
      <p className="muted">
        A portfolio is a group of projects. Personal vs work, side projects vs paid client —
        whatever cut makes sense to you. Each project under a portfolio gets its own board,
        backlog, dashboard, and target repo path that Cursor publishes into.
      </p>

      <p>
        <Link href="/portfolios/new" className="primary-link">
          + New portfolio
        </Link>
      </p>

      {list.length === 0 ? (
        <div className="empty-state">
          No portfolios yet. <Link href="/portfolios/new">Create one</Link> to start grouping
          projects.
        </div>
      ) : (
        <div>
          {list.map((p) => {
            const projs = projectsByPortfolio.get(p.id) ?? [];
            return (
              <article key={p.id} className="card">
                <div className="comment-meta">
                  <Link
                    href={`/portfolios/${p.id}`}
                    style={{ fontWeight: 500, fontSize: 16, textDecoration: 'none' }}
                  >
                    {p.name}
                  </Link>
                  <span className="muted">{projs.length} project{projs.length === 1 ? '' : 's'}</span>
                </div>
                {p.description ? <p style={{ marginTop: 4 }}>{p.description}</p> : null}
                {projs.length > 0 ? (
                  <ul style={{ marginTop: 8, padding: 0, listStyle: 'none' }}>
                    {projs.map((proj) => {
                      const c = itemsByProject.get(proj.id) ?? { open: 0, total: 0 };
                      return (
                        <li key={proj.id} style={{ padding: '4px 0' }}>
                          <Link href={`/projects/${proj.slug}`}>{proj.name}</Link>
                          <span className="muted" style={{ marginLeft: 8, fontSize: 13 }}>
                            {c.open} open / {c.total} total
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                    No projects yet.{' '}
                    <Link href={`/projects/new?portfolioId=${p.id}`}>Add one</Link>.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
