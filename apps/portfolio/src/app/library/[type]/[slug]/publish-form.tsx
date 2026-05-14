'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import type { LibraryEntryType } from '@/lib/library';

interface ProjectOption {
  id: string;
  name: string;
  slug: string;
  targetRepoPath: string | null;
}

interface Props {
  entryType: LibraryEntryType;
  entrySlug: string;
  projects: ProjectOption[];
}

export function PublishForm({ entryType, entrySlug, projects }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'project' | 'path'>('project');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const projectsWithPath = projects.filter((p) => p.targetRepoPath);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        const fd = new FormData(e.currentTarget);
        const overwrite = fd.get('overwrite') === 'on';
        const payload: Record<string, unknown> = { overwrite };
        if (mode === 'project') {
          const projectId = fd.get('projectId');
          if (!projectId) {
            setError('Pick a project first');
            return;
          }
          payload.projectId = projectId;
        } else {
          const targetRepoPath = (fd.get('targetRepoPath') ?? '').toString().trim();
          if (!targetRepoPath) {
            setError('Type a target repo path');
            return;
          }
          payload.targetRepoPath = targetRepoPath;
        }
        startTransition(async () => {
          const res = await fetch(
            `/api/v1/library/${entryType}/${entrySlug}/publish`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            },
          );
          if (!res.ok) {
            const err = (await res.json()) as { message?: string; details?: unknown };
            setError(err.message ?? `Failed (${res.status})`);
            return;
          }
          const data = (await res.json()) as { writtenPath: string; overwrote: boolean };
          setSuccess(
            `${data.overwrote ? 'Replaced' : 'Wrote'} ${data.writtenPath}`,
          );
          router.refresh();
        });
      }}
    >
      <div className="form-row" style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <label style={{ textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="radio"
            name="mode"
            checked={mode === 'project'}
            onChange={() => setMode('project')}
          />{' '}
          To a project
        </label>
        <label style={{ textTransform: 'none', letterSpacing: 0 }}>
          <input
            type="radio"
            name="mode"
            checked={mode === 'path'}
            onChange={() => setMode('path')}
          />{' '}
          To an explicit path
        </label>
      </div>

      {mode === 'project' ? (
        <div className="form-row">
          <label htmlFor="pf-project">Project</label>
          {projectsWithPath.length === 0 ? (
            <p className="muted">
              No projects have a <code>target_repo_path</code> set yet. Add one via{' '}
              <code>PATCH /api/v1/projects/&lt;slug&gt;</code> or use the explicit-path mode.
            </p>
          ) : (
            <select id="pf-project" name="projectId" required defaultValue={projectsWithPath[0]?.id}>
              {projectsWithPath.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} → {p.targetRepoPath}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="form-row">
          <label htmlFor="pf-path">Target repo path</label>
          <input
            id="pf-path"
            name="targetRepoPath"
            placeholder="/home/you/code/some-project"
            required
          />
        </div>
      )}

      <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input id="pf-overwrite" type="checkbox" name="overwrite" />
        <label htmlFor="pf-overwrite" style={{ textTransform: 'none', letterSpacing: 0 }}>
          Overwrite if the file already exists at the target
        </label>
      </div>

      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="muted" style={{ color: '#065f46' }}>
          {success}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </form>
  );
}
