'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type EventKind =
  | 'created'
  | 'status_change'
  | 'claim'
  | 'comment'
  | 'evidence'
  | 'question_asked'
  | 'question_answered'
  | 'mention'
  | 'validation_run'
  | 'automation_run'
  | 'override'
  | 'handoff'
  | 'link'
  | 'publish';

interface TrajectoryEvent {
  id: string;
  kind: EventKind;
  at: string;
  actor: string | null;
  title: string;
  detail?: string;
  link?: { kind: string; id: string };
  meta?: Record<string, unknown>;
}

// Quiet, restrained icons + colors per Decision 18 — color carries a hint,
// shape carries the actual signal so colorblind users get full info.
const KIND_STYLE: Record<EventKind, { glyph: string; tone: string; label: string }> = {
  created: { glyph: '+', tone: '#0f172a', label: 'created' },
  status_change: { glyph: '→', tone: '#0f172a', label: 'status' },
  claim: { glyph: '◉', tone: '#0f172a', label: 'claim' },
  comment: { glyph: '“', tone: '#52525b', label: 'comment' },
  evidence: { glyph: '✓', tone: '#065f46', label: 'evidence' },
  question_asked: { glyph: '?', tone: '#92400e', label: 'question' },
  question_answered: { glyph: '!', tone: '#065f46', label: 'answer' },
  mention: { glyph: '@', tone: '#0f172a', label: 'mention' },
  validation_run: { glyph: '●', tone: '#0f172a', label: 'gate' },
  automation_run: { glyph: '⚙', tone: '#52525b', label: 'automation' },
  override: { glyph: '⚠', tone: '#b91c1c', label: 'override' },
  handoff: { glyph: '⇄', tone: '#0f172a', label: 'handoff' },
  link: { glyph: '⌥', tone: '#0f172a', label: 'link' },
  publish: { glyph: '↗', tone: '#0f172a', label: 'publish' },
};

interface Props {
  workItemId: string;
}

const ALL_KINDS: EventKind[] = [
  'created',
  'claim',
  'status_change',
  'comment',
  'evidence',
  'question_asked',
  'question_answered',
  'mention',
  'validation_run',
  'automation_run',
  'override',
  'handoff',
  'link',
];

export function TrajectoryPanel({ workItemId }: Props) {
  const [events, setEvents] = useState<TrajectoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Set<EventKind>>(new Set(ALL_KINDS));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/work-items/${workItemId}/trajectory`)
      .then((r) => r.json())
      .then((data: { events?: TrajectoryEvent[]; error?: string; message?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setEvents(data.events ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [workItemId]);

  if (error) {
    return (
      <section className="trajectory-panel">
        <h3>Trajectory</h3>
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      </section>
    );
  }
  if (events === null) {
    return (
      <section className="trajectory-panel">
        <h3>Trajectory</h3>
        <p className="muted">Loading…</p>
      </section>
    );
  }

  const filtered = events.filter((e) => filter.has(e.kind));

  function toggle(kind: EventKind) {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }

  return (
    <section className="trajectory-panel">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
      >
        <h3 style={{ marginBottom: 0 }}>
          Trajectory{' '}
          <span className="muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
        </h3>
        <button type="button" className="link-button" onClick={() => setOpen((v) => !v)}>
          {open ? 'Collapse' : 'Expand'}
        </button>
      </header>

      {open ? (
        <>
          <div className="trajectory-filters">
            {ALL_KINDS.map((k) => {
              const s = KIND_STYLE[k];
              const active = filter.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className={`trajectory-filter${active ? ' active' : ''}`}
                  aria-pressed={active}
                >
                  <span style={{ color: s.tone }}>{s.glyph}</span> {s.label}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            <p className="muted">No events match the current filter.</p>
          ) : (
            <ol className="trajectory-list">
              {filtered.map((e) => {
                const s = KIND_STYLE[e.kind];
                const isExpanded = expandedId === e.id;
                const time = new Date(e.at);
                return (
                  <li key={e.id} className="trajectory-event">
                    <div className="trajectory-rail">
                      <span className="trajectory-glyph" style={{ color: s.tone }}>
                        {s.glyph}
                      </span>
                    </div>
                    <div className="trajectory-body">
                      <button
                        type="button"
                        className="trajectory-row"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : e.id)
                        }
                        aria-expanded={isExpanded}
                      >
                        <span className="trajectory-title">{e.title}</span>
                        {e.actor ? (
                          <span className="trajectory-actor">{e.actor}</span>
                        ) : null}
                        <span className="trajectory-time">
                          {time.toLocaleString()}
                        </span>
                      </button>
                      {isExpanded && (e.detail || e.link) ? (
                        <div className="trajectory-detail">
                          {e.detail ? (
                            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                              {e.detail}
                            </p>
                          ) : null}
                          {e.link?.kind === 'automation' ? (
                            <p style={{ marginTop: 6, fontSize: 13 }}>
                              <Link href={`/automations/${e.link.id}`}>
                                view automation
                              </Link>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : (
        <p className="muted" style={{ marginTop: 4 }}>
          Click Expand to see the full timeline of comments, status changes,
          validations, questions, and overrides for this work item.
        </p>
      )}
    </section>
  );
}
