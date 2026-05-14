import Link from 'next/link';

import { ensureInitialized } from '@/lib/init';
import { LIBRARY_TYPES, listLibraryEntries, type LibraryEntryType } from '@/lib/library';
import { TopNav } from '@/components/top-nav';

export const dynamic = 'force-dynamic';

interface Search {
  searchParams: Promise<{ type?: string }>;
}

const TYPE_LABEL: Record<LibraryEntryType, string> = {
  rule: 'Rules',
  skill: 'Skills',
  automation: 'Automations',
  validator: 'Validators',
  doc: 'Docs',
  guardrail: 'Guardrails',
};

const TYPE_DESCRIPTION: Record<LibraryEntryType, string> = {
  rule: 'Cursor rules — instructions that shape how an agent behaves in a repo.',
  skill: 'Cursor skills — packaged capabilities with a SKILL.md plus optional scripts.',
  automation: 'Scheduled prompts that Cursor Automations execute on a cron.',
  validator: 'Sandboxed commands that gate the done transition (quality, security, bugs, etc.).',
  doc: 'Framework knowledge — maturity model, testing tiers, validation layers.',
  guardrail: 'Pre-action policy gates (rate-limit, forbidden-paths, evidence-required, etc.).',
};

export default async function LibraryPage({ searchParams }: Search) {
  ensureInitialized();
  const params = await searchParams;
  const typeFilter =
    params.type && (LIBRARY_TYPES as string[]).includes(params.type)
      ? (params.type as LibraryEntryType)
      : null;
  const entries = listLibraryEntries(typeFilter ?? undefined);

  // Group by type for display
  const byType = new Map<LibraryEntryType, typeof entries>();
  for (const t of LIBRARY_TYPES) byType.set(t, []);
  for (const e of entries) byType.get(e.type)?.push(e);

  return (
    <main>
      <TopNav active="library" />
      <h1>Library</h1>
      <p className="muted">
        Cursor rules, skills, automations, validators, and framework docs — managed in one place,
        publishable into any of your projects&apos; target repos.
      </p>

      <p>
        <Link href="/library/new" className="primary-link">
          + New entry
        </Link>
      </p>

      <nav className="library-filter">
        <Link href="/library" className={typeFilter === null ? 'active' : ''}>
          All
        </Link>
        {LIBRARY_TYPES.map((t) => (
          <Link
            key={t}
            href={`/library?type=${t}`}
            className={typeFilter === t ? 'active' : ''}
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className="empty-state">
          No entries match this filter. Seeded entries live in{' '}
          <code>cursor-templates/</code>; once you create or edit one, it lives in{' '}
          <code>~/.sdlc-portfolio-manager/library/</code>.
        </div>
      ) : (
        LIBRARY_TYPES.map((t) => {
          const list = byType.get(t) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={t}>
              <h2>{TYPE_LABEL[t]}</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
                {TYPE_DESCRIPTION[t]}
              </p>
              <div>
                {list.map((e) => (
                  <Link
                    key={`${e.type}:${e.slug}`}
                    href={`/library/${e.type}/${e.slug}`}
                    className="card library-card"
                  >
                    <div className="library-card-header">
                      <span className="library-card-title">{e.name}</span>
                      <span
                        className="type-pill"
                        title={e.origin === 'seed' ? 'Seeded from cursor-templates/' : 'Local user copy'}
                      >
                        {e.origin}
                      </span>
                    </div>
                    {e.description ? (
                      <p style={{ fontSize: 14, marginTop: 4 }}>{e.description}</p>
                    ) : null}
                    <code style={{ fontSize: 11 }}>{e.slug}</code>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}

      <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
        In-app editing of library entries arrives in the next pass. For now, browse and publish.
      </p>
    </main>
  );
}
