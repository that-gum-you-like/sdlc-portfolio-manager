'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

const TYPE_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  { value: 'rule', label: 'Rule', description: '.mdc — markdown body + YAML frontmatter; Cursor agent reads it when globs match' },
  { value: 'automation', label: 'Automation', description: '.json — cron-scheduled prompt Cursor Automations execute' },
  { value: 'validator', label: 'Validator', description: '.json — sandboxed command that gates the done transition' },
  { value: 'doc', label: 'Doc', description: '.md — framework knowledge bundled with the library' },
];

export function NewLibraryEntryForm({ initialType }: { initialType: string }) {
  const router = useRouter();
  const [type, setType] = useState(
    TYPE_OPTIONS.find((t) => t.value === initialType)?.value ?? 'rule',
  );
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError('Name is required');
          return;
        }
        setError(null);
        startTransition(async () => {
          const res = await fetch('/api/v1/library', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ type, name: name.trim() }),
          });
          if (!res.ok) {
            const err = (await res.json()) as { message?: string };
            setError(err.message ?? `Failed (${res.status})`);
            return;
          }
          const data = (await res.json()) as { entry: { type: string; slug: string } };
          router.push(`/library/${data.entry.type}/${data.entry.slug}`);
        });
      }}
    >
      <div className="form-row">
        <label>Type</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                textTransform: 'none',
                letterSpacing: 0,
                color: type === opt.value ? 'var(--color-text)' : 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="type"
                value={opt.value}
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
              />
              <span>
                <strong>{opt.label}</strong>{' '}
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="nl-name">Name</label>
        <input
          id="nl-name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="e.g. Frontend developer rule"
          required
          maxLength={120}
          autoFocus
        />
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Slug derived from the name. We&apos;ll create a starter file with the right schema and
          drop you into the editor.
        </p>
      </div>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create entry'}
        </button>
      </div>
    </form>
  );
}
