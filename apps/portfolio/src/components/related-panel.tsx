'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import {
  INVERSE_LABEL,
  RELATIONSHIP_TYPES,
  SYMMETRIC,
  type EntityType,
  type RelationshipType,
} from '@/lib/relationships';

interface Edge {
  id: string;
  type: EntityType;
  title: string;
  relationshipId: string;
  note: string | null;
}

interface Props {
  entityType: EntityType;
  entityId: string;
}

const PRETTY: Record<string, string> = {
  parent_of: 'Parent of',
  child_of: 'Child of',
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  depends_on: 'Depends on',
  required_by: 'Required by',
  duplicates: 'Duplicates',
  duplicated_by: 'Duplicated by',
  related_to: 'Related',
  predecessor_of: 'Predecessor of',
  successor_of: 'Successor of',
  siblings: 'Siblings',
};

const URL_PREFIX: Record<EntityType, string> = {
  portfolio: '/portfolios',
  project: '/projects',
  work_item: '/items',
};

function detailHref(edge: Edge): string {
  return `${URL_PREFIX[edge.type]}/${edge.id}`;
}

export function RelatedPanel({ entityType, entityId }: Props) {
  const router = useRouter();
  const [groups, setGroups] = useState<Record<string, Edge[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/entities/${entityType}/${entityId}/relationships`)
      .then((r) => r.json())
      .then((data: { groups?: Record<string, Edge[]>; error?: string; message?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setGroups(data.groups ?? {});
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  function removeEdge(relationshipId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/v1/relationships/${relationshipId}`, { method: 'DELETE' });
      if (res.ok) {
        const next = { ...(groups ?? {}) };
        for (const key of Object.keys(next)) {
          next[key] = (next[key] ?? []).filter((e) => e.relationshipId !== relationshipId);
          if (next[key]!.length === 0) delete next[key];
        }
        setGroups(next);
        router.refresh();
      }
    });
  }

  if (error) {
    return (
      <div className="related-panel">
        <h3>Related</h3>
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      </div>
    );
  }

  const entries = groups ? Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])) : null;
  const isEmpty = entries !== null && entries.length === 0;

  return (
    <div className="related-panel">
      <h3>Related</h3>
      {groups === null ? (
        <p className="muted">Loading…</p>
      ) : isEmpty ? (
        <p className="muted">No relationships yet.</p>
      ) : (
        entries!.map(([label, edges]) => (
          <div key={label} className="related-group">
            <div className="related-group-label">{PRETTY[label] ?? label}</div>
            <ul className="related-list">
              {edges.map((edge) => (
                <li key={`${label}-${edge.id}`}>
                  <Link href={detailHref(edge)}>{edge.title}</Link>{' '}
                  <span className="type-pill">{edge.type.replace('_', ' ')}</span>
                  {edge.relationshipId ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => removeEdge(edge.relationshipId)}
                      disabled={pending}
                      aria-label={`Remove ${edge.title}`}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      {adding ? (
        <AddRelationshipForm
          entityType={entityType}
          entityId={entityId}
          onCancel={() => {
            setAdding(false);
            setFormError(null);
          }}
          onCreated={() => {
            setAdding(false);
            setFormError(null);
            // Re-fetch
            fetch(`/api/v1/entities/${entityType}/${entityId}/relationships`)
              .then((r) => r.json())
              .then((data: { groups?: Record<string, Edge[]> }) => setGroups(data.groups ?? {}));
            router.refresh();
          }}
          onError={(msg) => setFormError(msg)}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} style={{ marginTop: 8 }}>
          + Add relationship
        </button>
      )}
      {formError ? (
        <p className="muted" style={{ color: '#b91c1c', marginTop: 8 }}>
          {formError}
        </p>
      ) : null}
    </div>
  );
}

interface AddProps {
  entityType: EntityType;
  entityId: string;
  onCreated: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}

const FRIENDLY_TYPE: Record<RelationshipType, string> = {
  parent_of: 'Parent of',
  blocks: 'Blocks',
  depends_on: 'Depends on',
  duplicates: 'Duplicates',
  related_to: 'Related to',
  predecessor_of: 'Predecessor of',
};

function AddRelationshipForm({ entityType, entityId, onCreated, onCancel, onError }: AddProps) {
  return (
    <form
      className="add-relationship-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const targetIdRaw = (fd.get('targetId') ?? '').toString().trim();
        const targetType = (fd.get('targetType') ?? 'work_item').toString() as EntityType;
        const type = (fd.get('type') ?? 'blocks').toString() as RelationshipType;
        if (!targetIdRaw) {
          onError('Target id required');
          return;
        }
        const res = await fetch('/api/v1/relationships', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceType: entityType,
            sourceId: entityId,
            targetType,
            targetId: targetIdRaw,
            type,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { message?: string };
          onError(err.message ?? `Failed (${res.status})`);
          return;
        }
        onCreated();
      }}
      style={{ marginTop: 12 }}
    >
      <div className="form-row">
        <label>Type</label>
        <select name="type" defaultValue="blocks">
          {RELATIONSHIP_TYPES.map((t) => (
            <option key={t} value={t}>
              {FRIENDLY_TYPE[t]}
              {SYMMETRIC[t] ? '' : ` (inverse: ${INVERSE_LABEL[t]})`}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label>Target type</label>
        <select name="targetType" defaultValue="work_item">
          <option value="work_item">Work item</option>
          <option value="project">Project</option>
          <option value="portfolio">Portfolio</option>
        </select>
      </div>
      <div className="form-row">
        <label>Target id (UUID)</label>
        <input name="targetId" required placeholder="paste a uuid…" />
      </div>
      <div className="form-actions">
        <button type="submit" className="primary">
          Add
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
