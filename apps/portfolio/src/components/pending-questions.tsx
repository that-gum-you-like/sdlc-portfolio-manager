'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MentionTextarea } from '@/components/mention-textarea';
import { segmentBody } from '@/lib/mentions';

interface QuestionRecord {
  id: string;
  askedBy: string;
  addressedTo: string | null;
  body: string;
  status: 'open' | 'answered' | 'cancelled';
  askedAt: string;
  answeredAt: string | null;
}

interface Props {
  workItemId: string;
}

function MentionAwareBody({ body }: { body: string }) {
  return (
    <>
      {segmentBody(body).map((s, i) =>
        s.kind === 'mention' ? (
          <span key={i} className="mention">
            {s.value}
          </span>
        ) : (
          <span key={i}>{s.value}</span>
        ),
      )}
    </>
  );
}

export function PendingQuestions({ workItemId }: Props) {
  const router = useRouter();
  const [list, setList] = useState<QuestionRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);

  function reload() {
    fetch(`/api/v1/work-items/${workItemId}/questions`)
      .then((r) => r.json())
      .then((data: { questions?: QuestionRecord[]; error?: string; message?: string }) => {
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setList(data.questions ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemId]);

  if (error) {
    return (
      <p className="muted" style={{ color: '#b91c1c' }}>
        {error}
      </p>
    );
  }
  if (list === null) return <p className="muted">Loading…</p>;

  const open = list.filter((q) => q.status === 'open');
  const answered = list.filter((q) => q.status === 'answered');

  return (
    <section className="questions-section">
      <h3>
        Pending questions{' '}
        <span className="count">
          {open.length} open{answered.length ? ` · ${answered.length} answered` : ''}
        </span>
      </h3>
      {open.length === 0 && answered.length === 0 ? (
        <p className="muted">No questions on this item yet.</p>
      ) : null}
      {open.map((q) => (
        <OpenQuestion key={q.id} q={q} onAnswered={() => { reload(); router.refresh(); }} />
      ))}
      {answered.length > 0 ? (
        <details className="answered-questions">
          <summary>{answered.length} answered</summary>
          <ul>
            {answered.map((q) => (
              <li key={q.id} className="comment">
                <header className="comment-meta">
                  <strong>{q.askedBy}</strong>
                  <span>{new Date(q.askedAt).toLocaleString()}</span>
                  <span className="comment-kind-pill">answered</span>
                </header>
                <div className="comment-body">
                  <MentionAwareBody body={q.body} />
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {askOpen ? (
        <AskForm
          workItemId={workItemId}
          onCancel={() => setAskOpen(false)}
          onAsked={() => {
            setAskOpen(false);
            reload();
            router.refresh();
          }}
        />
      ) : (
        <button type="button" onClick={() => setAskOpen(true)} style={{ marginTop: 8 }}>
          + Ask a question
        </button>
      )}
    </section>
  );
}

function OpenQuestion({
  q,
  onAnswered,
}: {
  q: QuestionRecord;
  onAnswered: () => void;
}) {
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <article className="comment pending-question">
      <header className="comment-meta">
        <strong>{q.askedBy}</strong>
        <span>{new Date(q.askedAt).toLocaleString()}</span>
        {q.addressedTo ? (
          <span className="comment-kind-pill">to @{q.addressedTo}</span>
        ) : null}
        <span className="comment-kind-pill" style={{ background: '#fef3c7' }}>
          open
        </span>
      </header>
      <div className="comment-body">
        <MentionAwareBody body={q.body} />
      </div>
      {answering ? (
        <form
          style={{ marginTop: 8 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const body = (fd.get('body') ?? '').toString().trim();
            const author = (fd.get('author') ?? '').toString().trim() || 'bryce';
            if (!body) return;
            const res = await fetch(`/api/v1/questions/${q.id}/answer`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ author, body }),
            });
            if (!res.ok) {
              const err = (await res.json()) as { message?: string };
              setError(err.message ?? `Failed (${res.status})`);
              return;
            }
            setAnswering(false);
            onAnswered();
          }}
        >
          <div className="form-row">
            <label>Answer</label>
            <MentionTextarea name="body" placeholder="Type your answer…" required />
          </div>
          <div className="form-row">
            <label>Author</label>
            <input name="author" defaultValue="bryce" />
          </div>
          {error ? (
            <p className="muted" style={{ color: '#b91c1c' }}>
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <button type="submit" className="primary">
              Send answer
            </button>
            <button type="button" onClick={() => setAnswering(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAnswering(true)} style={{ marginTop: 8 }}>
          Answer
        </button>
      )}
    </article>
  );
}

function AskForm({
  workItemId,
  onCancel,
  onAsked,
}: {
  workItemId: string;
  onCancel: () => void;
  onAsked: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      style={{ marginTop: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        setError(null);
        const fd = new FormData(e.currentTarget);
        const body = (fd.get('body') ?? '').toString().trim();
        const askedBy = (fd.get('askedBy') ?? '').toString().trim() || 'bryce';
        const addressedTo = (fd.get('addressedTo') ?? '').toString().trim() || undefined;
        if (!body) {
          setError('Question body required');
          setSubmitting(false);
          return;
        }
        const res = await fetch(`/api/v1/work-items/${workItemId}/questions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ askedBy, body, addressedTo }),
        });
        setSubmitting(false);
        if (!res.ok) {
          const err = (await res.json()) as { message?: string };
          setError(err.message ?? `Failed (${res.status})`);
          return;
        }
        onAsked();
      }}
    >
      <div className="form-row">
        <label>Question</label>
        <MentionTextarea
          name="body"
          placeholder="What do you need decided? @mention anyone specifically."
          required
        />
      </div>
      <div className="form-row">
        <label>Asked by</label>
        <input name="askedBy" defaultValue="bryce" />
      </div>
      <div className="form-row">
        <label>Addressed to (optional handle)</label>
        <input name="addressedTo" placeholder="e.g. bryce, frontend-developer" />
      </div>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Sending…' : 'Ask'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
