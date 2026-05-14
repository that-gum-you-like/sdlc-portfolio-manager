import Link from 'next/link';
import { eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios, projects, workItems } from '@/db/schema';
import { TopNav } from '@/components/top-nav';

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
      <TopNav active="home" />
      <h1>sdlc-portfolio-manager</h1>
      <p className="muted">
        Local portfolio + work-item + library manager. Start by picking a project below — or{' '}
        <Link href="/portfolios/new">create a new portfolio</Link> to group projects.
      </p>

      <div className="dashboard-grid" style={{ marginTop: 24 }}>
        <section>
          <h2>Start here</h2>
          <ul>
            <li>
              <Link href="/portfolios">Portfolios &amp; projects</Link>
              <div className="item-meta">create or open a project</div>
            </li>
            <li>
              <Link href="/discoveries/new">Start a discovery</Link>
              <div className="item-meta">braindump → user stories</div>
            </li>
            <li>
              <Link href="/dashboard">Dashboard</Link>
              <div className="item-meta">today&apos;s focus across all projects</div>
            </li>
            <li>
              <Link href="/inbox">Inbox</Link>
              <div className="item-meta">questions and mentions for you</div>
            </li>
          </ul>
        </section>

        <section>
          <h2>Projects</h2>
          {portfolioRows.length === 0 ? (
            <p className="empty">
              No portfolios yet.{' '}
              <Link href="/portfolios/new">Create one</Link> to start.
            </p>
          ) : (
            portfolioRows.map((p) => {
              const projs = projectRows.filter((proj) => proj.portfolioId === p.id);
              return (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <h3 style={{ margin: '0 0 4px 0' }}>
                    <Link href={`/portfolios/${p.id}`}>{p.name}</Link>
                  </h3>
                  {projs.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13 }}>
                      <Link href={`/projects/new?portfolioId=${p.id}`}>+ Add a project</Link>
                    </p>
                  ) : (
                    <ul>
                      {projs.map((proj) => {
                        const count = itemRows.filter((i) => i.projectId === proj.id).length;
                        return (
                          <li key={proj.id}>
                            <Link href={`/projects/${proj.slug}`}>{proj.name}</Link>{' '}
                            <span className="muted" style={{ fontSize: 12 }}>
                              {count} item{count === 1 ? '' : 's'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
