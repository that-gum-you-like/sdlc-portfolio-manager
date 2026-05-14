import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { automationRuns } from '@/db/schema';
import { listAutomationEntries } from '@/lib/automations';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

export default async function AutomationsPage() {
  ensureInitialized();
  const entries = listAutomationEntries();
  const db = getDb();
  const userId = currentUserId();

  const runs = db
    .select({
      automationSlug: automationRuns.automationSlug,
      count: sql<number>`count(*)`.as('count'),
      lastRun: sql<string>`max(${automationRuns.startedAt})`.as('lastRun'),
    })
    .from(automationRuns)
    .where(eq(automationRuns.userId, userId))
    .groupBy(automationRuns.automationSlug)
    .orderBy(desc(sql`max(${automationRuns.startedAt})`))
    .all();

  const stats = new Map<string, { count: number; lastRun: string | null }>();
  for (const r of runs) {
    if (r.automationSlug) stats.set(r.automationSlug, { count: r.count, lastRun: r.lastRun ?? null });
  }

  return (
    <main>
      <TopNav active="library" />
      <h1>Automations</h1>
      <p className="muted">
        Cron-scheduled prompts that Cursor Automations execute on your behalf. Findings flow back
        into the work-item store as new bugs, comments, or status changes.
      </p>

      {entries.length === 0 ? (
        <div className="empty-state">
          No automations seeded yet. They live in <code>cursor-templates/automations/</code> and
          appear here automatically.
        </div>
      ) : (
        <div>
          {entries.map((e) => {
            const stat = stats.get(e.slug) ?? { count: 0, lastRun: null };
            return (
              <article key={e.slug} className="card">
                <div className="automation-card-header">
                  <Link href={`/automations/${e.slug}`} className="automation-card-title">
                    {e.name}
                  </Link>
                  <code className="cron-chip">{e.frontmatter.cron}</code>
                </div>
                {e.description ? <p>{e.description}</p> : null}
                <div className="automation-card-meta">
                  <span className="type-pill">{e.frontmatter.resultHook}</span>
                  <span className="muted">
                    {stat.count > 0
                      ? `${stat.count} run${stat.count === 1 ? '' : 's'}${
                          stat.lastRun ? ` · last ${new Date(stat.lastRun).toLocaleString()}` : ''
                        }`
                      : 'no runs yet'}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
        Editing automations in-app + publishing them to a target repo&apos;s{' '}
        <code>.cursor/automations/</code> arrives with §11–13 (library storage + UI + publish).
      </p>
    </main>
  );
}
