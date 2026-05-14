'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { segmentBody } from '@/lib/mentions';

interface CommentRecord {
  id: string;
  author: string;
  body: string;
  kind: 'note' | 'evidence';
  criterionId: string | null;
  createdAt: string;
}

interface Props {
  workItemId: string;
}

function MentionAwareBody({ body }: { body: string }) {
  const segs = segmentBody(body);
  return (
    <>
      {segs.map((s, i) =>
        s.kind === 'mention' ? (
          <span key={i} className="mention" data-handle={s.handle}>
            {s.value}
          </span>
        ) : (
          <span key={i}>{s.value}</span>
        ),
      )}
    </>
  );
}

export function CommentsThread({ workItemId }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    fetch(`/api/v1/work-items/${workItemId}/comments`)
      .then((r) => r.json())
      .then((data: { comments?: CommentRecord[]; error?: string; message?: string }) => {
        if (data.error) {
          setError(data.message ?? data.error);
          return;
        }
        setComments(data.comments ?? []);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workItemId]);

  return (
    <div className="comments-thread">
      <h3>Comments</h3>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      {comments === null ? (
        <p className="muted">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="muted">No comments yet — start the thread below.</p>
      ) : (
        <div>
          {comments.map((c) => (
            <article key={c.id} className="comment">
              <header className="comment-meta">
                <strong>{c.author}</strong>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                {c.kind === 'evidence' ? (
                  <span className="comment-kind-pill" title={`Evidence for ${c.criterionId}`}>
                    evidence · {c.criterionId}
                  </span>
                ) : null}
              </header>
              <div className="comment-body">
                <MentionAwareBody body={c.body} />
              </div>
            </article>
          ))}
        </div>
      )}
      <NewCommentForm
        workItemId={workItemId}
        disabled={pending}
        onPost={() => {
          startTransition(() => {
            reload();
            router.refresh();
          });
        }}
      />
    </div>
  );
}

function NewCommentForm({
  workItemId,
  disabled,
  onPost,
}: {
  workItemId: string;
  disabled: boolean;
  onPost: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      style={{ marginTop: 12 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (submitting || disabled) return;
        setSubmitting(true);
        setError(null);
        const form = e.currentTarget;
        const fd = new FormData(form);
        const body = (fd.get('body') ?? '').toString().trim();
        const author = (fd.get('author') ?? '').toString().trim() || 'bryce';
        if (!body) {
          setError('Write a comment first');
          setSubmitting(false);
          return;
        }
        const res = await fetch(`/api/v1/work-items/${workItemId}/comments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ author, body }),
        });
        setSubmitting(false);
        if (!res.ok) {
          const err = (await res.json()) as { message?: string };
          setError(err.message ?? `Failed (${res.status})`);
          return;
        }
        form.reset();
        onPost();
      }}
    >
      <div className="form-row">
        <label htmlFor="cc-body">Comment</label>
        <textarea
          id="cc-body"
          name="body"
          placeholder="Use @name to tag someone — e.g. @frontend-developer can you check this?"
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor="cc-author">Author</label>
        <input id="cc-author" name="author" defaultValue="bryce" maxLength={120} />
      </div>
      {error ? (
        <p className="muted" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      ) : null}
      <div className="form-actions">
        <button type="submit" className="primary" disabled={submitting || disabled}>
          {submitting ? 'Posting…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}
