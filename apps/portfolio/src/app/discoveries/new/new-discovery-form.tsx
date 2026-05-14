'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface ProjectOption {
  id: string;
  name: string;
  slug: string;
}

export function NewDiscoveryForm({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (projects.length === 0) {
    return <p className="muted">No projects yet — create one first.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const projectId = fd.get('projectId');
        const rawDump = (fd.get('rawDump') ?? '').toString().trim();
        const source = fd.get('source') ?? 'text';
        const generate = fd.get('generate') === 'on';
        if (!rawDump) {
          setError('Add some content first');
          return;
        }
        startTransition(async () => {
          const createRes = await fetch('/api/v1/discoveries', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectId, rawDump, source }),
          });
          if (!createRes.ok) {
            const err = (await createRes.json()) as { message?: string };
            setError(err.message ?? `Failed (${createRes.status})`);
            return;
          }
          const { discovery } = (await createRes.json()) as {
            discovery: { id: string };
          };
          if (generate) {
            await fetch(`/api/v1/discoveries/${discovery.id}/generate`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ generator: 'default' }),
            });
          }
          router.push(`/discoveries/${discovery.id}`);
        });
      }}
    >
      <div className="form-row">
        <label htmlFor="d-project">Project</label>
        <select id="d-project" name="projectId" required defaultValue={projects[0]?.id}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="d-source">Source</label>
        <select id="d-source" name="source" defaultValue="text">
          <option value="text">Text I just wrote</option>
          <option value="voice-transcript">Voice transcript (from Cursor dictation)</option>
          <option value="meeting-notes">Meeting notes</option>
          <option value="email">Email thread</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="d-dump">Braindump</label>
        <textarea
          id="d-dump"
          name="rawDump"
          required
          autoFocus
          placeholder="Talk out loud — what do you want to build? What's broken? Don't worry about structure."
          style={{ minHeight: 200 }}
        />
      </div>
      <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input id="d-generate" type="checkbox" name="generate" defaultChecked />
        <label htmlFor="d-generate" style={{ textTransform: 'none', letterSpacing: 0 }}>
          Run the default generator immediately
        </label>
      </div>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create discovery'}
        </button>
      </div>
    </form>
  );
}
