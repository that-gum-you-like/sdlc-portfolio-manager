'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { VALIDATION_GATES, type ValidationGate } from '@/lib/validation-gates';

interface Props {
  slug: string;
  initialName: string;
  initialDescription: string;
  initialTargetRepoPath: string;
  initialSettings: Record<string, unknown>;
}

interface ValidationSettings {
  enabled?: boolean;
  gates?: Partial<Record<ValidationGate, boolean>>;
}

export function ProjectSettingsForm({
  slug,
  initialName,
  initialDescription,
  initialTargetRepoPath,
  initialSettings,
}: Props) {
  const router = useRouter();
  const initialValidation = (initialSettings.validation ?? {}) as ValidationSettings;
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [targetRepoPath, setTargetRepoPath] = useState(initialTargetRepoPath);
  const [enabledMap, setEnabledMap] = useState<Record<ValidationGate, boolean>>(() => {
    const out = {} as Record<ValidationGate, boolean>;
    for (const g of VALIDATION_GATES) {
      out[g] = initialValidation.gates?.[g] !== false;
    }
    return out;
  });
  const [pipelineEnabled, setPipelineEnabled] = useState(
    initialValidation.enabled !== false,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setSuccess(null);
    const settings: Record<string, unknown> = {
      ...initialSettings,
      validation: {
        enabled: pipelineEnabled,
        gates: enabledMap,
      },
    };
    startTransition(async () => {
      const res = await fetch(`/api/v1/projects/${slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          targetRepoPath: targetRepoPath || null,
          settings,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setError(err.message ?? `Failed (${res.status})`);
        return;
      }
      setSuccess('Saved.');
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <h3>Identity</h3>
      <div className="form-row">
        <label htmlFor="ps-name">Name</label>
        <input
          id="ps-name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
          maxLength={80}
        />
      </div>
      <div className="form-row">
        <label htmlFor="ps-desc">Description</label>
        <textarea
          id="ps-desc"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          maxLength={1000}
        />
      </div>

      <h3>Target repo path</h3>
      <div className="form-row">
        <label htmlFor="ps-repo">Absolute path on this machine</label>
        <input
          id="ps-repo"
          value={targetRepoPath}
          onChange={(e) => setTargetRepoPath(e.currentTarget.value)}
          maxLength={500}
          placeholder="/home/you/code/this-project"
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Set this to your Cursor workspace folder. When agents call <code>pc</code> with{' '}
          <code>PC_PROJECT={slug}</code> or from inside this path, work routes here automatically.
          Library publish targets default to this path&apos;s <code>.cursor/</code>.
        </p>
      </div>

      <h3>Validation pipeline</h3>
      <div className="form-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input
          id="ps-pipeline"
          type="checkbox"
          checked={pipelineEnabled}
          onChange={(e) => setPipelineEnabled(e.currentTarget.checked)}
        />
        <label htmlFor="ps-pipeline" style={{ textTransform: 'none', letterSpacing: 0 }}>
          Enforce the validation pipeline on the done transition
        </label>
      </div>
      <div className="form-row">
        <label>Gates</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {VALIDATION_GATES.map((g) => (
            <label
              key={g}
              style={{
                textTransform: 'none',
                letterSpacing: 0,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                opacity: pipelineEnabled ? 1 : 0.5,
              }}
            >
              <input
                type="checkbox"
                checked={enabledMap[g]}
                disabled={!pipelineEnabled}
                onChange={(e) =>
                  setEnabledMap((prev) => ({ ...prev, [g]: e.currentTarget.checked }))
                }
              />
              <code>{g}</code>
            </label>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Disabled gates run with <code>status: skipped</code> and do not block the done
          transition.
        </p>
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
          {pending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
