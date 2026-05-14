'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { allowedNextStatuses, type WorkItemStatus } from '@/lib/work-items';

const LABELS: Record<WorkItemStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In progress',
  'needs-human': 'Needs human',
  in_review: 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

interface Props {
  itemId: string;
  current: WorkItemStatus;
}

export function StatusControl({ itemId, current }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const next = allowedNextStatuses(current);

  if (next.length === 0) {
    return <span className="muted">No transitions available.</span>;
  }

  return (
    <div>
      <div className="form-actions" style={{ flexWrap: 'wrap' }}>
        {next.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const res = await fetch(`/api/v1/work-items/${itemId}`, {
                  method: 'PATCH',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ status }),
                });
                if (!res.ok) {
                  const err = (await res.json()) as { message?: string };
                  setError(err.message ?? `Failed (${res.status})`);
                  return;
                }
                router.refresh();
              });
            }}
          >
            → {LABELS[status]}
          </button>
        ))}
      </div>
      {error ? (
        <p className="muted" role="alert" style={{ color: '#b91c1c', marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
