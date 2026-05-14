'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface PortfolioOption {
  id: string;
  name: string;
}

interface Props {
  portfolios: PortfolioOption[];
  initialPortfolioId: string | null;
}

export function NewProjectForm({ portfolios, initialPortfolioId }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (portfolios.length === 0) {
    return (
      <div className="empty-state">
        You need a portfolio first.{' '}
        <Link href="/portfolios/new">Create a portfolio</Link> then come back here.
      </div>
    );
  }

  const defaultPortfolio = initialPortfolioId ?? portfolios[0]?.id;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const portfolioId = fd.get('portfolioId');
        const name = (fd.get('name') ?? '').toString().trim();
        const slug = (fd.get('slug') ?? '').toString().trim();
        const description = (fd.get('description') ?? '').toString().trim();
        const targetRepoPath = (fd.get('targetRepoPath') ?? '').toString().trim();
        if (!name) {
          setError('Name is required');
          return;
        }
        startTransition(async () => {
          const payload: Record<string, unknown> = { portfolioId, name };
          if (slug) payload.slug = slug;
          if (description) payload.description = description;
          if (targetRepoPath) payload.targetRepoPath = targetRepoPath;
          const res = await fetch('/api/v1/projects', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const err = (await res.json()) as { message?: string };
            setError(err.message ?? `Failed (${res.status})`);
            return;
          }
          const data = (await res.json()) as { project: { slug: string } };
          router.push(`/projects/${data.project.slug}`);
        });
      }}
    >
      <div className="form-row">
        <label htmlFor="np-portfolio">Portfolio</label>
        <select id="np-portfolio" name="portfolioId" required defaultValue={defaultPortfolio}>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="np-name">Name</label>
        <input
          id="np-name"
          name="name"
          required
          maxLength={80}
          autoFocus
          placeholder="e.g. LinguaFlow"
        />
      </div>
      <div className="form-row">
        <label htmlFor="np-slug">Slug (optional — derived from name)</label>
        <input id="np-slug" name="slug" maxLength={64} placeholder="kebab-case" />
      </div>
      <div className="form-row">
        <label htmlFor="np-desc">Description (optional)</label>
        <textarea id="np-desc" name="description" maxLength={1000} />
      </div>
      <div className="form-row">
        <label htmlFor="np-repo">Target repo path (optional)</label>
        <input
          id="np-repo"
          name="targetRepoPath"
          maxLength={500}
          placeholder="/home/you/code/this-project"
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          When set, library entries can publish into this path&apos;s <code>.cursor/</code>{' '}
          directory in one click. Cursor agents working in this folder can be matched back to this
          project automatically.
        </p>
      </div>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create project'}
        </button>
      </div>
    </form>
  );
}
