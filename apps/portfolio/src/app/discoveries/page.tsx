import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveries, discoveryDrafts, projects } from '@/db/schema';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  generating: 'Generating',
  reviewing: 'Reviewing',
  accepted: 'Accepted',
  archived: 'Archived',
};

export default async function DiscoveriesPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();

  const list = db
    .select()
    .from(discoveries)
    .where(eq(discoveries.userId, userId))
    .orderBy(desc(discoveries.createdAt))
    .all();

  // Pull project names for breadcrumbs
  const projectRows = db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.userId, userId))
    .all();
  const projectMap = new Map(projectRows.map((p) => [p.id, p]));

  // Aggregate draft counts per discovery
  const drafts = db
    .select({
      discoveryId: discoveryDrafts.discoveryId,
      status: discoveryDrafts.status,
    })
    .from(discoveryDrafts)
    .where(eq(discoveryDrafts.userId, userId))
    .all();
  const counts = new Map<
    string,
    { pending: number; accepted: number; rejected: number; edited: number }
  >();
  for (const d of drafts) {
    if (!counts.has(d.discoveryId)) {
      counts.set(d.discoveryId, { pending: 0, accepted: 0, rejected: 0, edited: 0 });
    }
    const c = counts.get(d.discoveryId)!;
    c[d.status as keyof typeof c] += 1;
  }

  return (
    <main>
      <TopNav active="discoveries" />
      <h1>Discoveries</h1>
      <p className="muted">
        Dump unstructured thoughts; the system generates draft user stories with acceptance
        criteria. Review, edit, accept — accepted drafts become real work items wired up to the
        rest of the system.
      </p>

      <p>
        <Link href="/discoveries/new" className="primary-link">
          + New discovery
        </Link>
      </p>

      {list.length === 0 ? (
        <div className="empty-state">
          Start with a braindump. Paste meeting notes, voice transcripts, or just type what&apos;s
          on your mind. <Link href="/discoveries/new">Start one.</Link>
        </div>
      ) : (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {list.map((d) => {
            const c = counts.get(d.id) ?? { pending: 0, accepted: 0, rejected: 0, edited: 0 };
            const project = projectMap.get(d.projectId);
            const preview = d.rawDump.replace(/\s+/g, ' ').trim();
            return (
              <li key={d.id}>
                <Link href={`/discoveries/${d.id}`} className="card discovery-card">
                  <div className="comment-meta">
                    <span className="type-pill">{STATUS_LABEL[d.status] ?? d.status}</span>
                    <span>{new Date(d.createdAt).toLocaleString()}</span>
                    {project ? <span className="muted">{project.name}</span> : null}
                  </div>
                  <p style={{ marginTop: 6 }}>
                    {preview.length > 240 ? preview.slice(0, 237) + '…' : preview}
                  </p>
                  <p className="muted" style={{ fontSize: 13 }}>
                    {c.pending + c.edited > 0
                      ? `${c.pending + c.edited} pending`
                      : 'no pending drafts'}
                    {c.accepted ? ` · ${c.accepted} accepted` : ''}
                    {c.rejected ? ` · ${c.rejected} rejected` : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
