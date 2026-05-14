'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { WORK_ITEM_TYPES } from '@/lib/work-items';

interface ProjectOption {
  id: string;
  name: string;
  slug: string;
}

export function NewItemForm({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (projects.length === 0) {
    return (
      <p className="muted">
        No projects yet. Create one first via <code>POST /api/v1/projects</code>.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="primary" onClick={() => setOpen(true)}>
        New work item
      </button>
    );
  }

  return (
    <div className="side-panel">
      <h2>New work item</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData(e.currentTarget);
          const body = {
            projectId: fd.get('projectId'),
            type: fd.get('type'),
            title: fd.get('title'),
            description: fd.get('description') || undefined,
          };
          startTransition(async () => {
            try {
              const res = await fetch('/api/v1/work-items', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!res.ok) {
                const err = (await res.json()) as { message?: string };
                setError(err.message ?? `Failed (${res.status})`);
                return;
              }
              setOpen(false);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Network error');
            }
          });
        }}
      >
        <div className="form-row">
          <label htmlFor="ni-project">Project</label>
          <select id="ni-project" name="projectId" required defaultValue={projects[0]?.id}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="ni-type">Type</label>
          <select id="ni-type" name="type" required defaultValue="story">
            {WORK_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="ni-title">Title</label>
          <input
            id="ni-title"
            name="title"
            required
            maxLength={200}
            autoFocus
            placeholder="Short, action-oriented description"
          />
        </div>
        <div className="form-row">
          <label htmlFor="ni-description">Description (markdown)</label>
          <textarea
            id="ni-description"
            name="description"
            placeholder="Optional — what, why, context"
          />
        </div>
        {error ? (
          <p className="muted" role="alert" style={{ color: '#b91c1c' }}>
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <button type="submit" className="primary" disabled={pending}>
            {pending ? 'Creating…' : 'Create'}
          </button>
          <button type="button" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
