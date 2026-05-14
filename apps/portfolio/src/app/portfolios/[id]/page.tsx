import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects, workItems } from '@/db/schema';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function PortfolioDetailPage({ params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();

  const portfolio = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
    .get();
  if (!portfolio) notFound();

  const projectRows = db
    .select()
    .from(projects)
    .where(and(eq(projects.portfolioId, id), eq(projects.userId, userId)))
    .all();

  const items = db
    .select({ projectId: workItems.projectId, status: workItems.status })
    .from(workItems)
    .where(eq(workItems.userId, userId))
    .all();

  function summarize(projectId: string) {
    const matches = items.filter((i) => i.projectId === projectId);
    return {
      open: matches.filter((i) => i.status !== 'done' && i.status !== 'cancelled').length,
      inProgress: matches.filter((i) => i.status === 'in_progress').length,
      needsHuman: matches.filter((i) => i.status === 'needs-human').length,
      total: matches.length,
    };
  }

  return (
    <main>
      <TopNav active="portfolios" />
      <nav className="muted" aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/portfolios">Portfolios</Link> › <span>{portfolio.name}</span>
      </nav>
      <h1>{portfolio.name}</h1>
      {portfolio.description ? <p className="muted">{portfolio.description}</p> : null}

      <p>
        <Link href={`/projects/new?portfolioId=${portfolio.id}`} className="primary-link">
          + New project
        </Link>
      </p>

      {projectRows.length === 0 ? (
        <div className="empty-state">
          No projects in this portfolio yet.{' '}
          <Link href={`/projects/new?portfolioId=${portfolio.id}`}>Create one</Link> to start
          collecting work items.
        </div>
      ) : (
        <div className="dashboard-grid">
          {projectRows.map((p) => {
            const s = summarize(p.id);
            return (
              <Link
                key={p.id}
                href={`/projects/${p.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <section>
                  <h2 style={{ textTransform: 'none', letterSpacing: 0, color: 'inherit', fontSize: 16, fontWeight: 500 }}>
                    {p.name}
                  </h2>
                  {p.description ? (
                    <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
                      {p.description}
                    </p>
                  ) : null}
                  <dl
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '4px 12px',
                      fontSize: 13,
                      marginTop: 12,
                    }}
                  >
                    <dt className="muted">Open</dt>
                    <dd style={{ margin: 0 }}>{s.open}</dd>
                    <dt className="muted">In progress</dt>
                    <dd style={{ margin: 0 }}>{s.inProgress}</dd>
                    <dt className="muted">Needs human</dt>
                    <dd style={{ margin: 0 }}>{s.needsHuman}</dd>
                    {p.targetRepoPath ? (
                      <>
                        <dt className="muted">Repo</dt>
                        <dd style={{ margin: 0 }}>
                          <code style={{ fontSize: 11 }}>{p.targetRepoPath}</code>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                </section>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
