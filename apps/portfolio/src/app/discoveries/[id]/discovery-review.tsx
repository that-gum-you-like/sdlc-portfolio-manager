'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface DraftShape {
  id: string;
  draftType: string;
  status: 'pending' | 'accepted' | 'rejected' | 'edited';
  draftData: string;
  parentDraftId: string | null;
  resultingWorkItemId: string | null;
  generatedBy: string | null;
}

interface DraftData {
  title?: string;
  description?: string;
  acceptance_criteria?: Array<{ id: string; text: string }>;
  value?: number;
  complexity?: number;
}

interface Props {
  discoveryId: string;
  initialStatus: string;
  initialDump: string;
  initialDrafts: DraftShape[];
}

export function DiscoveryReview({
  discoveryId,
  initialStatus,
  initialDump,
  initialDrafts,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [dump, setDump] = useState(initialDump);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [appendText, setAppendText] = useState('');

  function refresh() {
    fetch(`/api/v1/discoveries/${discoveryId}`)
      .then((r) => r.json())
      .then((data: { discovery?: { status: string; rawDump: string }; drafts?: DraftShape[] }) => {
        if (data.discovery) {
          setStatus(data.discovery.status);
          setDump(data.discovery.rawDump);
        }
        if (data.drafts) setDrafts(data.drafts);
      });
  }

  async function runGenerate() {
    setError(null);
    const res = await fetch(`/api/v1/discoveries/${discoveryId}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ generator: 'default' }),
    });
    if (!res.ok) {
      const err = (await res.json()) as { message?: string };
      setError(err.message ?? `Failed (${res.status})`);
      return;
    }
    refresh();
    router.refresh();
  }

  async function appendAndRegenerate() {
    if (!appendText.trim()) return;
    setError(null);
    const append = await fetch(`/api/v1/discoveries/${discoveryId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ appendText }),
    });
    if (!append.ok) {
      const err = (await append.json()) as { message?: string };
      setError(err.message ?? `Failed (${append.status})`);
      return;
    }
    setAppendText('');
    await runGenerate();
  }

  async function acceptDraft(draft: DraftShape) {
    setError(null);
    const res = await fetch(
      `/api/v1/discoveries/${discoveryId}/drafts/${draft.id}/accept`,
      { method: 'POST' },
    );
    if (!res.ok) {
      const err = (await res.json()) as { message?: string };
      setError(err.message ?? `Failed (${res.status})`);
      return;
    }
    refresh();
    router.refresh();
  }

  async function rejectDraft(draft: DraftShape) {
    const res = await fetch(
      `/api/v1/discoveries/${discoveryId}/drafts/${draft.id}/reject`,
      { method: 'POST' },
    );
    if (!res.ok) {
      const err = (await res.json()) as { message?: string };
      setError(err.message ?? `Failed (${res.status})`);
      return;
    }
    refresh();
    router.refresh();
  }

  function parseDraftData(raw: string): DraftData {
    try {
      return JSON.parse(raw) as DraftData;
    } catch {
      return {};
    }
  }

  const pendingDrafts = drafts.filter((d) => d.status === 'pending' || d.status === 'edited');
  const acceptedDrafts = drafts.filter((d) => d.status === 'accepted');
  const rejectedDrafts = drafts.filter((d) => d.status === 'rejected');

  return (
    <>
      <p className="muted" style={{ marginBottom: 16 }}>
        Status: <strong>{status}</strong>
        {' · '}
        {drafts.length} draft{drafts.length === 1 ? '' : 's'}
      </p>

      <div className="discovery-grid">
        <div>
          <h3>Raw dump</h3>
          <pre className="raw-dump">{dump}</pre>

          <h3>Append &amp; regenerate</h3>
          <textarea
            value={appendText}
            onChange={(e) => setAppendText(e.currentTarget.value)}
            placeholder="Add more context, then click Append &amp; regenerate."
            style={{ minHeight: 100, width: '100%' }}
          />
          <div className="form-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => startTransition(appendAndRegenerate)}
              disabled={pending || !appendText.trim()}
            >
              {pending ? 'Working…' : 'Append & regenerate'}
            </button>
            {drafts.length === 0 ? (
              <button
                type="button"
                className="primary"
                onClick={() => startTransition(runGenerate)}
                disabled={pending}
              >
                {pending ? 'Generating…' : 'Generate drafts'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => startTransition(runGenerate)}
                disabled={pending}
              >
                {pending ? 'Generating…' : 'Generate more'}
              </button>
            )}
          </div>
          {error ? (
            <p className="muted" style={{ color: '#b91c1c', marginTop: 8 }}>
              {error}
            </p>
          ) : null}
        </div>

        <div>
          <h3>Pending drafts ({pendingDrafts.length})</h3>
          {pendingDrafts.length === 0 ? (
            <p className="muted">
              {drafts.length === 0
                ? 'No drafts generated yet. Click Generate drafts to start.'
                : 'All drafts have been reviewed.'}
            </p>
          ) : (
            pendingDrafts.map((d) => {
              const data = parseDraftData(d.draftData);
              return (
                <article key={d.id} className="card draft-card">
                  <div className="comment-meta">
                    <span className="type-pill">{d.draftType}</span>
                    {d.generatedBy ? <span className="muted">via {d.generatedBy}</span> : null}
                    {d.status === 'edited' ? (
                      <span className="comment-kind-pill">edited</span>
                    ) : null}
                  </div>
                  <h4 style={{ margin: '6px 0 4px 0' }}>{data.title ?? '(untitled)'}</h4>
                  {data.description ? (
                    <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{data.description}</p>
                  ) : null}
                  {data.acceptance_criteria && data.acceptance_criteria.length > 0 ? (
                    <ol className="acceptance-list">
                      {data.acceptance_criteria.map((ac) => (
                        <li key={ac.id}>
                          <span className="ac-id">{ac.id}</span>
                          <span>{ac.text}</span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  <div className="form-actions" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => startTransition(() => acceptDraft(d))}
                      disabled={pending}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(() => rejectDraft(d))}
                      disabled={pending}
                    >
                      Reject
                    </button>
                  </div>
                </article>
              );
            })
          )}

          {acceptedDrafts.length > 0 ? (
            <>
              <h3>Accepted ({acceptedDrafts.length})</h3>
              <ul style={{ padding: 0, listStyle: 'none' }}>
                {acceptedDrafts.map((d) => {
                  const data = parseDraftData(d.draftData);
                  return (
                    <li key={d.id} style={{ padding: '6px 0' }}>
                      <span className="type-pill">{d.draftType}</span>{' '}
                      {d.resultingWorkItemId ? (
                        <Link href={`/items/${d.resultingWorkItemId}`}>
                          {data.title ?? '(untitled)'}
                        </Link>
                      ) : (
                        <span>{data.title ?? '(untitled)'}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}

          {rejectedDrafts.length > 0 ? (
            <details>
              <summary className="muted">{rejectedDrafts.length} rejected</summary>
              <ul style={{ padding: 0, listStyle: 'none' }}>
                {rejectedDrafts.map((d) => {
                  const data = parseDraftData(d.draftData);
                  return (
                    <li key={d.id} style={{ padding: '4px 0', color: 'var(--color-text-muted)' }}>
                      <span className="type-pill">{d.draftType}</span> {data.title ?? '(untitled)'}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    </>
  );
}
