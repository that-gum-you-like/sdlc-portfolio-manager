'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface BacklogItem {
  id: string;
  title: string;
  type: string;
  status: 'backlog' | 'ready';
  assignee: string | null;
  rank: number;
  projectId: string;
  projectName: string;
}

export function BacklogClient({ initial }: { initial: BacklogItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/v1/work-items/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json()) as { message?: string };
      throw new Error(err.message ?? `Failed (${res.status})`);
    }
  }

  function swapWith(index: number, direction: -1 | 1) {
    const partnerIndex = index + direction;
    if (partnerIndex < 0 || partnerIndex >= items.length) return;
    const me = items[index]!;
    const them = items[partnerIndex]!;

    const myNewRank = them.rank;
    const theirNewRank = me.rank === them.rank ? me.rank - direction : me.rank;

    const next = items.slice();
    next[index] = { ...them, rank: theirNewRank };
    next[partnerIndex] = { ...me, rank: myNewRank };
    next.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
    setItems(next);

    startTransition(async () => {
      setError(null);
      try {
        await patch(me.id, { rank: myNewRank });
        await patch(them.id, { rank: theirNewRank });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setItems(items); // rollback
      }
    });
  }

  function toggle(item: BacklogItem) {
    const targetStatus = item.status === 'backlog' ? 'ready' : 'backlog';
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: targetStatus } : x)));
    startTransition(async () => {
      setError(null);
      try {
        await patch(item.id, { status: targetStatus });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setItems(items);
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        Backlog is empty. File something on the <Link href="/board">board</Link> or run a discovery.
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}

      <ol className="backlog-list">
        {items.map((item, idx) => (
          <li key={item.id}>
            <div className="rank-controls" aria-label="Reorder">
              <button
                type="button"
                onClick={() => swapWith(idx, -1)}
                disabled={pending || idx === 0}
                aria-label="Move up"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => swapWith(idx, 1)}
                disabled={pending || idx === items.length - 1}
                aria-label="Move down"
                title="Move down"
              >
                ↓
              </button>
            </div>

            <div>
              <Link href={`/items/${item.id}`} style={{ textDecoration: 'none', fontWeight: 500 }}>
                {item.title}
              </Link>
              <div className="item-meta">
                <span className="type-pill">{item.type}</span>
                <span>{item.projectName}</span>
                {item.assignee ? <span>· {item.assignee}</span> : null}
                <span>· rank {item.rank}</span>
              </div>
            </div>

            <button
              type="button"
              className={item.status === 'backlog' ? 'primary' : ''}
              onClick={() => toggle(item)}
              disabled={pending}
              style={{ minWidth: 110 }}
            >
              {item.status === 'backlog' ? 'Move to ready' : '← backlog'}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
