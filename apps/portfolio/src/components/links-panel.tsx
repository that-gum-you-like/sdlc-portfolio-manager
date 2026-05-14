'use client';

import { useEffect, useState, useTransition } from 'react';

interface Link {
  id: string;
  provider: string;
  kind: 'branch' | 'commit' | 'pr' | 'mr' | 'deploy' | 'doc';
  ref: string;
  url: string;
  state: string | null;
  createdAt: string;
}

const KIND_GLYPH: Record<Link['kind'], string> = {
  branch: '⎇',
  commit: '◉',
  pr: '⌥',
  mr: '⌥',
  deploy: '▲',
  doc: '⌥',
};

interface Props {
  workItemId: string;
  itemStatus: string;
}

export function LinksPanel({ workItemId, itemStatus }: Props) {
  const [links, setLinks] = useState<Link[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function load() {
    fetch(`/api/v1/work-items/${workItemId}/links`)
      .then((r) => r.json())
      .then((data: { links?: Link[]; error?: string; message?: string }) => {
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setLinks(data.links ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemId]);

  if (links === null) return null;
  const showAwaitingWarning =
    (itemStatus === 'in_review' || itemStatus === 'done') && links.length === 0;

  return (
    <section className="links-panel">
      <h3>Links</h3>
      {showAwaitingWarning ? (
        <p className="muted" style={{ color: '#92400e' }}>
          No PR/commit linked yet — &quot;done&quot; doesn&apos;t mean shipped without one.
        </p>
      ) : null}
      {links.length === 0 ? (
        <p className="muted">No links yet.</p>
      ) : (
        <ul style={{ padding: 0, listStyle: 'none' }}>
          {links.map((l) => (
            <li key={l.id} style={{ padding: '4px 0', fontSize: 14 }}>
              <span style={{ fontFamily: 'var(--font-mono)', marginRight: 8 }}>
                {KIND_GLYPH[l.kind]}
              </span>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.kind} #{l.ref}
              </a>
              {l.state ? (
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  {l.state}
                </span>
              ) : null}
              <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>
                {l.provider}
              </span>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form
          style={{ marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const url = (fd.get('url') ?? '').toString().trim();
            const ref = (fd.get('ref') ?? '').toString().trim();
            if (!url) return;
            startTransition(async () => {
              const res = await fetch(`/api/v1/work-items/${workItemId}/links`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url, ref: ref || url }),
              });
              if (!res.ok) {
                const err = (await res.json()) as { message?: string };
                setError(err.message ?? `Failed (${res.status})`);
                return;
              }
              setAdding(false);
              load();
            });
          }}
        >
          <div className="form-row">
            <label>URL</label>
            <input
              name="url"
              required
              placeholder="https://github.com/org/repo/pull/123"
            />
          </div>
          <div className="form-row">
            <label>Ref (optional — auto-inferred from URL)</label>
            <input name="ref" placeholder="e.g. 123 or abc1234" />
          </div>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={pending}>
              {pending ? 'Adding…' : 'Add link'}
            </button>
            <button type="button" onClick={() => setAdding(false)} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ marginTop: 8 }}>
          + Add link
        </button>
      )}
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
