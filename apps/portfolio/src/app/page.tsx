import Link from 'next/link';
import { eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();

  const portfolioRows = db.select().from(portfolios).where(eq(portfolios.userId, userId)).all();
  const projectRows = db.select().from(projects).where(eq(projects.userId, userId)).all();
  const itemRows = db.select().from(workItems).where(eq(workItems.userId, userId)).all();

  return (
    <main>
      <h1>sdlc-portfolio-manager</h1>
      <p className="muted">
        Local portfolio + work-item + library manager. Pre-alpha — see{' '}
        <code>openspec/changes/initial-portfolio-manager/</code> for the spec.
      </p>

      <h2>Portfolios</h2>
      {portfolioRows.length === 0 ? (
        <div className="empty-state">No portfolios yet. The first-run seed will create one on next request.</div>
      ) : (
        portfolioRows.map((p) => {
          const projectsInPortfolio = projectRows.filter((proj) => proj.portfolioId === p.id);
          return (
            <article key={p.id} className="card">
              <h3>{p.name}</h3>
              {p.description ? <p>{p.description}</p> : null}
              <p className="muted">
                {projectsInPortfolio.length} project{projectsInPortfolio.length === 1 ? '' : 's'}
              </p>
              <ul>
                {projectsInPortfolio.map((proj) => {
                  const projectItems = itemRows.filter((i) => i.projectId === proj.id);
                  return (
                    <li key={proj.id}>
                      <Link href={`/api/v1/projects/${proj.slug}`}>{proj.name}</Link>{' '}
                      <span className="muted">
                        — {projectItems.length} work item{projectItems.length === 1 ? '' : 's'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })
      )}

      <h2>Status</h2>
      <p className="muted">
        Backend, database, and the portfolio + project + work-item schema are live. UI for the
        board, backlog, item detail, library, and discovery flows is next — tracked in{' '}
        <code>openspec/changes/initial-portfolio-manager/tasks.md</code>.
      </p>
    </main>
  );
}
