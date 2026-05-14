'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import type { LibraryEntryType } from '@/lib/library';

interface Props {
  entryType: LibraryEntryType;
  entrySlug: string;
  origin: 'seed' | 'user';
  hasSeedVersion: boolean;
}

export function LibraryEditor({ entryType, entrySlug, origin, hasSeedVersion }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState<string | null>(null);
  const [originalRaw, setOriginalRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openEditor() {
    setError(null);
    setErrorDetail(null);
    setOpen(true);
    if (raw !== null) return;
    fetch(`/api/v1/library/${entryType}/${entrySlug}?raw=true`)
      .then((r) => r.json())
      .then((data: { raw?: string; error?: string; message?: string }) => {
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setRaw(data.raw ?? '');
        setOriginalRaw(data.raw ?? '');
      })
      .catch((err: Error) => setError(err.message));
  }

  function cancel() {
    setOpen(false);
    setRaw(originalRaw);
    setError(null);
    setErrorDetail(null);
  }

  function save() {
    if (raw === null) return;
    setError(null);
    setErrorDetail(null);
    startTransition(async () => {
      const res = await fetch(`/api/v1/library/${entryType}/${entrySlug}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: raw }),
      });
      if (!res.ok) {
        const err = (await res.json()) as {
          error?: string;
          message?: string;
          details?: { details?: string };
        };
        setError(err.message ?? err.error ?? `Failed (${res.status})`);
        if (err.details?.details) setErrorDetail(err.details.details);
        return;
      }
      setOriginalRaw(raw);
      setOpen(false);
      router.refresh();
    });
  }

  function resetToSeed() {
    if (!confirm('Reset this entry to its seeded version? Your edits will be lost.')) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/library/${entryType}/${entrySlug}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setError(err.message ?? `Failed (${res.status})`);
        return;
      }
      setRaw(null);
      setOriginalRaw(null);
      setOpen(false);
      router.refresh();
    });
  }

  function deleteEntry() {
    if (!confirm('Delete this user copy? If there is a seed version, the entry will revert to it.')) return;
    startTransition(async () => {
      const res = await fetch(`/api/v1/library/${entryType}/${entrySlug}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setError(err.message ?? `Failed (${res.status})`);
        return;
      }
      // If no seed exists, the entry is now gone — go back to /library
      if (!hasSeedVersion) {
        router.push(`/library?type=${entryType}`);
        return;
      }
      setRaw(null);
      setOriginalRaw(null);
      setOpen(false);
      router.refresh();
    });
  }

  // Keep raw text in sync when the parent re-renders with new origin (e.g. after reset)
  useEffect(() => {
    setRaw(null);
    setOriginalRaw(null);
    setOpen(false);
  }, [origin]);

  if (!open) {
    return (
      <div className="form-actions" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" className="primary" onClick={openEditor} disabled={pending}>
          Edit
        </button>
        {origin === 'user' && hasSeedVersion ? (
          <button type="button" onClick={resetToSeed} disabled={pending}>
            Reset to seed
          </button>
        ) : null}
        {origin === 'user' ? (
          <button type="button" onClick={deleteEntry} disabled={pending}>
            Delete user copy
          </button>
        ) : null}
        {error ? (
          <p className="muted" style={{ color: '#b91c1c', flexBasis: '100%', marginTop: 8 }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="editor-panel">
      <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        Editing as <strong>{origin === 'seed' ? 'a new user copy (forks the seed)' : 'your user copy'}</strong>.
        Saving writes to <code>~/.sdlc-portfolio-manager/library/</code>.
      </p>
      {raw === null ? (
        <p className="muted">Loading source…</p>
      ) : (
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.currentTarget.value)}
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 320,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        />
      )}
      {error ? (
        <div style={{ marginTop: 8 }}>
          <p className="muted" style={{ color: '#b91c1c' }}>
            {error}
          </p>
          {errorDetail ? (
            <pre
              style={{
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {errorDetail}
            </pre>
          ) : null}
        </div>
      ) : null}
      <div className="form-actions" style={{ marginTop: 8 }}>
        <button type="button" className="primary" onClick={save} disabled={pending || raw === null}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={cancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
