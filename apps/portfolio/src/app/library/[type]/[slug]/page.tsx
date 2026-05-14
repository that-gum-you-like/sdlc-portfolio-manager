import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { projects, publishHistory } from '@/db/schema';
import {
  LIBRARY_TYPES,
  TARGET_REPO_DIR,
  findLibraryEntry,
  type LibraryEntryType,
} from '@/lib/library';
import { TopNav } from '@/components/top-nav';
import { PublishForm } from './publish-form';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ type: string; slug: string }>;
}

export default async function LibraryDetailPage({ params }: Params) {
  ensureInitialized();
  const { type, slug } = await params;
  if (!(LIBRARY_TYPES as string[]).includes(type)) notFound();
  const entry = findLibraryEntry(type as LibraryEntryType, slug);
  if (!entry) notFound();

  const db = getDb();
  const userId = currentUserId();
  const history = db
    .select()
    .from(publishHistory)
    .where(
      and(
        eq(publishHistory.userId, userId),
        eq(publishHistory.entryType, entry.type),
        eq(publishHistory.entrySlug, entry.slug),
      ),
    )
    .orderBy(desc(publishHistory.createdAt))
    .limit(20)
    .all();

  const projectRows = db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      targetRepoPath: projects.targetRepoPath,
    })
    .from(projects)
    .where(eq(projects.userId, userId))
    .all();

  return (
    <main>
      <TopNav active="library" />
      <nav className="muted" aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/library">Library</Link> ›{' '}
        <Link href={`/library?type=${entry.type}`}>{entry.type}</Link> › <span>{entry.name}</span>
      </nav>
      <h1>{entry.name}</h1>
      {entry.description ? <p className="muted">{entry.description}</p> : null}

      <div className="detail-grid">
        <div>
          {entry.body ? (
            <>
              <h3>Body</h3>
              <pre className="raw-dump">{entry.body}</pre>
            </>
          ) : null}

          {Object.keys(entry.frontmatter).length > 0 ? (
            <>
              <h3>Frontmatter</h3>
              <pre className="raw-dump">{JSON.stringify(entry.frontmatter, null, 2)}</pre>
            </>
          ) : null}

          <h3>Publish to a project</h3>
          <PublishForm
            entryType={entry.type}
            entrySlug={entry.slug}
            projects={projectRows.map((p) => ({
              id: p.id,
              name: p.name,
              slug: p.slug,
              targetRepoPath: p.targetRepoPath,
            }))}
          />

          <h3>Publish history</h3>
          {history.length === 0 ? (
            <p className="muted">No publishes yet for this entry.</p>
          ) : (
            <ul style={{ padding: 0, listStyle: 'none' }}>
              {history.map((h) => (
                <li key={h.id} className="card">
                  <div className="comment-meta">
                    <strong>{new Date(h.createdAt).toLocaleString()}</strong>
                    {h.overwrote ? (
                      <span className="comment-kind-pill" style={{ background: '#fef3c7' }}>
                        overwrote
                      </span>
                    ) : null}
                  </div>
                  <p style={{ fontSize: 13, marginTop: 4 }}>
                    <code>{h.writtenPath}</code>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="sidebar">
          <h3>Details</h3>
          <dl>
            <dt>Type</dt>
            <dd>{entry.type}</dd>
            <dt>Origin</dt>
            <dd>{entry.origin}</dd>
            <dt>Source</dt>
            <dd>
              <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{entry.filePath}</code>
            </dd>
            <dt>Publishes to</dt>
            <dd>
              <code>{TARGET_REPO_DIR[entry.type]}/</code>
            </dd>
          </dl>
        </aside>
      </div>
    </main>
  );
}
