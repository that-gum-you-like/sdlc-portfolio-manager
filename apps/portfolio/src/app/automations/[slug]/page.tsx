import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { automationRuns } from '@/db/schema';
import { findAutomationEntry } from '@/lib/automations';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

const STATUS_TONE: Record<string, string> = {
  running: '#92400e',
  completed: '#065f46',
  failed: '#b91c1c',
  cancelled: '#52525b',
};

export default async function AutomationDetailPage({ params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const entry = findAutomationEntry(slug);
  if (!entry) notFound();

  const db = getDb();
  const userId = currentUserId();
  const runs = db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.userId, userId), eq(automationRuns.automationSlug, slug)))
    .orderBy(desc(automationRuns.startedAt))
    .limit(50)
    .all();

  return (
    <main>
      <TopNav active="library" />
      <nav className="muted" aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/automations">Automations</Link> ›{' '}
        <span>{entry.name}</span>
      </nav>

      <h1>{entry.name}</h1>
      {entry.description ? <p className="muted">{entry.description}</p> : null}

      <div className="detail-grid">
        <div>
          <h3>Prompt</h3>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 1.55,
              overflow: 'auto',
            }}
          >
            {entry.frontmatter.prompt}
          </pre>

          <h3>Recent runs</h3>
          {runs.length === 0 ? (
            <div className="empty-state">
              No runs recorded yet. Once the Cursor Automation fires and POSTs to{' '}
              <code>/api/v1/automation-results</code>, runs will appear here.
            </div>
          ) : (
            <ul style={{ padding: 0, listStyle: 'none' }}>
              {runs.map((r) => {
                let items: string[] = [];
                try {
                  const parsed = JSON.parse(r.createdItemIdsJson) as unknown;
                  if (Array.isArray(parsed)) items = parsed as string[];
                } catch {
                  /* ignore */
                }
                return (
                  <li key={r.id} className="card">
                    <div className="comment-meta">
                      <strong style={{ color: STATUS_TONE[r.status] ?? 'inherit' }}>
                        {r.status}
                      </strong>
                      <span>{new Date(r.startedAt).toLocaleString()}</span>
                      {r.completedAt ? (
                        <span>
                          ·{' '}
                          {Math.max(
                            0,
                            Math.round(
                              (new Date(r.completedAt).getTime() -
                                new Date(r.startedAt).getTime()) /
                                1000,
                            ),
                          )}
                          s
                        </span>
                      ) : null}
                    </div>
                    {r.summary ? <p style={{ marginTop: 4 }}>{r.summary}</p> : null}
                    {items.length > 0 ? (
                      <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        Created {items.length} item{items.length === 1 ? '' : 's'}:{' '}
                        {items.map((id, idx) => (
                          <span key={id}>
                            <Link href={`/items/${id}`}>
                              <code style={{ fontSize: 11 }}>{id.slice(0, 8)}</code>
                            </Link>
                            {idx < items.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="sidebar">
          <h3>Configuration</h3>
          <dl>
            <dt>Schedule</dt>
            <dd>
              <code>{entry.frontmatter.cron}</code>
            </dd>
            <dt>Result hook</dt>
            <dd>{entry.frontmatter.resultHook}</dd>
            <dt>Source file</dt>
            <dd>
              <code style={{ fontSize: 11 }}>{entry.filePath.split('/').slice(-3).join('/')}</code>
            </dd>
          </dl>

          {Object.keys(entry.frontmatter.scope).length > 0 ? (
            <>
              <h3>Scope</h3>
              <pre
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-bg)',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--color-border)',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                }}
              >
                {JSON.stringify(entry.frontmatter.scope, null, 2)}
              </pre>
            </>
          ) : null}
        </aside>
      </div>

      <p className="muted" style={{ marginTop: 48, fontSize: 13 }}>
        Editing the prompt in-app and publishing into a target repo arrives with §11–13.
      </p>
    </main>
  );
}
