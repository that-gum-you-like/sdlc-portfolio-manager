'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function NewPortfolioForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const name = (fd.get('name') ?? '').toString().trim();
        const description = (fd.get('description') ?? '').toString().trim();
        if (!name) {
          setError('Name is required');
          return;
        }
        startTransition(async () => {
          const res = await fetch('/api/v1/portfolios', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name, description: description || undefined }),
          });
          if (!res.ok) {
            const err = (await res.json()) as { message?: string };
            setError(err.message ?? `Failed (${res.status})`);
            return;
          }
          const data = (await res.json()) as { portfolio: { id: string } };
          router.push(`/portfolios/${data.portfolio.id}`);
        });
      }}
    >
      <div className="form-row">
        <label htmlFor="p-name">Name</label>
        <input id="p-name" name="name" required maxLength={80} autoFocus placeholder="e.g. Work projects" />
      </div>
      <div className="form-row">
        <label htmlFor="p-desc">Description (optional)</label>
        <textarea
          id="p-desc"
          name="description"
          maxLength={1000}
          placeholder="What kind of projects live here?"
        />
      </div>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create portfolio'}
        </button>
      </div>
    </form>
  );
}
