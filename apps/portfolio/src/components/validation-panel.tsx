'use client';

import { useEffect, useState, useTransition } from 'react';

interface GateState {
  gate: 'quality' | 'security' | 'bugs' | 'user-story-acceptance';
  status: 'pass' | 'fail' | 'error' | 'skipped' | 'running' | 'never_run';
  lastRunId: string | null;
  lastRunAt: string | null;
}

interface ValidationRun {
  id: string;
  gate: string;
  validatorSlug: string;
  startedAt: string;
  completedAt: string | null;
  status: 'pass' | 'fail' | 'error' | 'skipped' | 'running';
  exitCode: number | null;
  stdoutSnippet: string | null;
  stderrSnippet: string | null;
  findingsJson: string;
}

const STATUS_COLOR: Record<GateState['status'], string> = {
  pass: '#10b981',
  fail: '#ef4444',
  error: '#dc2626',
  running: '#f59e0b',
  skipped: '#a3a3a3',
  never_run: '#d4d4d4',
};

const STATUS_SHAPE: Record<GateState['status'], string> = {
  pass: '●',
  fail: '✕',
  error: '⚠',
  running: '◐',
  skipped: '○',
  never_run: '·',
};

const STATUS_LABEL: Record<GateState['status'], string> = {
  pass: 'pass',
  fail: 'fail',
  error: 'error',
  running: 'running',
  skipped: 'skipped',
  never_run: 'never run',
};

const GATE_LABEL: Record<string, string> = {
  quality: 'Quality',
  security: 'Security',
  bugs: 'Bugs',
  'user-story-acceptance': 'User-story acceptance',
};

export function ValidationPanel({ workItemId }: { workItemId: string }) {
  const [states, setStates] = useState<GateState[] | null>(null);
  const [runs, setRuns] = useState<ValidationRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    fetch(`/api/v1/work-items/${workItemId}/validation-runs`)
      .then((r) => r.json())
      .then((data: { states?: GateState[]; runs?: ValidationRun[]; error?: string; message?: string }) => {
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setStates(data.states ?? []);
        setRuns(data.runs ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemId]);

  // Poll while any gate is running
  useEffect(() => {
    if (!states) return;
    const hasRunning = states.some((s) => s.status === 'running');
    if (!hasRunning) return;
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [states]);

  function runGate(gate?: string) {
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/v1/work-items/${workItemId}/validate`, {
        method: 'POST',
        headers: gate ? { 'content-type': 'application/json' } : {},
        body: gate ? JSON.stringify({ gate }) : undefined,
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setError(err.message ?? `Failed (${res.status})`);
        return;
      }
      load();
    });
  }

  if (error) {
    return (
      <section className="validation-panel">
        <h3>Validation</h3>
        <p className="muted" style={{ color: '#b91c1c' }}>{error}</p>
      </section>
    );
  }
  if (states === null) {
    return (
      <section className="validation-panel">
        <h3>Validation</h3>
        <p className="muted">Loading…</p>
      </section>
    );
  }

  return (
    <section className="validation-panel">
      <h3>Validation</h3>
      <div className="validation-actions" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => runGate()} disabled={pending}>
          {pending ? 'Running…' : 'Run all gates'}
        </button>
      </div>
      <table className="validation-table">
        <tbody>
          {states.map((s) => {
            const run = s.lastRunId ? runs.find((r) => r.id === s.lastRunId) : undefined;
            const isOpen = expanded === s.gate;
            return (
              <ValidationRow
                key={s.gate}
                state={s}
                run={run ?? null}
                isOpen={isOpen}
                onToggle={() => setExpanded(isOpen ? null : s.gate)}
                onRun={() => runGate(s.gate)}
                pending={pending}
              />
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ValidationRow({
  state,
  run,
  isOpen,
  onToggle,
  onRun,
  pending,
}: {
  state: GateState;
  run: ValidationRun | null;
  isOpen: boolean;
  onToggle: () => void;
  onRun: () => void;
  pending: boolean;
}) {
  return (
    <>
      <tr>
        <td className="validation-status-cell" style={{ color: STATUS_COLOR[state.status] }} aria-label={STATUS_LABEL[state.status]}>
          {STATUS_SHAPE[state.status]}
        </td>
        <td>
          <button
            type="button"
            className="link-button"
            onClick={onToggle}
            style={{ fontWeight: 500, color: 'inherit' }}
          >
            {GATE_LABEL[state.gate]}
          </button>
        </td>
        <td className="muted" style={{ fontSize: 13 }}>
          {STATUS_LABEL[state.status]}
          {state.lastRunAt ? ` · ${new Date(state.lastRunAt).toLocaleString()}` : ''}
        </td>
        <td>
          <button type="button" onClick={onRun} disabled={pending} style={{ fontSize: 12, padding: '2px 8px' }}>
            Run
          </button>
        </td>
      </tr>
      {isOpen && run ? (
        <tr className="validation-row-detail">
          <td colSpan={4}>
            <div className="validation-detail">
              <div className="comment-meta">
                <span>validator: <code>{run.validatorSlug}</code></span>
                <span>exit {run.exitCode ?? '—'}</span>
              </div>
              {run.stdoutSnippet ? (
                <>
                  <h4>stdout</h4>
                  <pre className="raw-dump">{run.stdoutSnippet}</pre>
                </>
              ) : null}
              {run.stderrSnippet ? (
                <>
                  <h4>stderr</h4>
                  <pre className="raw-dump">{run.stderrSnippet}</pre>
                </>
              ) : null}
              {run.findingsJson && run.findingsJson !== '{}' ? (
                <>
                  <h4>findings</h4>
                  <pre className="raw-dump">{run.findingsJson}</pre>
                </>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// Compact 4-dot indicator for board cards
export function ValidationDots({ workItemId }: { workItemId: string }) {
  const [states, setStates] = useState<GateState[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/work-items/${workItemId}/validation-runs`)
      .then((r) => r.json())
      .then((data: { states?: GateState[] }) => {
        if (!cancelled) setStates(data.states ?? []);
      })
      .catch(() => {
        if (!cancelled) setStates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workItemId]);

  if (!states) return null;
  return (
    <span className="validation-dots" aria-label="Validation gate status">
      {states.map((s) => (
        <span
          key={s.gate}
          className="validation-dot"
          style={{ color: STATUS_COLOR[s.status] }}
          title={`${GATE_LABEL[s.gate]}: ${STATUS_LABEL[s.status]}`}
        >
          {STATUS_SHAPE[s.status]}
        </span>
      ))}
    </span>
  );
}
