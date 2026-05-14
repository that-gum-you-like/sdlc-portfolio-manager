'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Suggestion {
  handle: string;
  kind: 'user' | 'agent';
  reason: string;
}

interface Props {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  id?: string;
}

// Find the active @-mention context anchored at `cursor`. Returns the handle
// query (without the leading @) and the index of the @ if we're typing a
// mention; null otherwise.
function detectMentionContext(value: string, cursor: number): { atIndex: number; query: string } | null {
  if (cursor === 0) return null;
  // Walk back from cursor while we are still in the handle (word chars / hyphen).
  let i = cursor - 1;
  while (i >= 0) {
    const ch = value[i];
    if (!ch) break;
    if (ch === '@') {
      const before = i === 0 ? '' : value[i - 1];
      // Must be at start of input OR preceded by whitespace / punctuation.
      if (!before || /[\s(.,;:!?\[\]{}<>"'`]/.test(before)) {
        return { atIndex: i, query: value.slice(i + 1, cursor) };
      }
      return null;
    }
    if (!/[\w-]/.test(ch)) return null;
    i--;
  }
  return null;
}

export function MentionTextarea({
  name,
  defaultValue,
  placeholder,
  required,
  id,
}: Props) {
  const autoId = useId();
  const elementId = id ?? autoId;
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(defaultValue ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState('');
  const [atIndex, setAtIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedQuery, setFetchedQuery] = useState<string | null>(null);

  // Refresh suggestions when the query changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const url = `/api/v1/mentions/suggestions${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then((data: { suggestions?: Suggestion[] }) => {
        if (!cancelled) {
          setSuggestions(data.suggestions ?? []);
          setSelected(0);
          setLoading(false);
          setFetchedQuery(query);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setLoading(false);
          setFetchedQuery(query);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  function syncMentionStateFromCursor() {
    const el = ref.current;
    if (!el) return;
    const cursor = el.selectionStart ?? 0;
    const ctx = detectMentionContext(el.value, cursor);
    if (ctx) {
      setAtIndex(ctx.atIndex);
      setQuery(ctx.query);
      setOpen(true);
    } else {
      setOpen(false);
      setAtIndex(null);
      setQuery('');
    }
  }

  function insertSuggestion(s: Suggestion) {
    const el = ref.current;
    if (!el || atIndex === null) return;
    const cursor = el.selectionStart ?? value.length;
    const before = value.slice(0, atIndex);
    const after = value.slice(cursor);
    const insert = `@${s.handle} `;
    const next = before + insert + after;
    setValue(next);
    setOpen(false);
    setAtIndex(null);
    setQuery('');
    // Move caret to end of inserted handle
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insert.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="mention-textarea">
      <textarea
        ref={ref}
        id={elementId}
        name={name}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => {
          setValue(e.currentTarget.value);
          // schedule mention-state sync after React applies the value
          requestAnimationFrame(syncMentionStateFromCursor);
        }}
        onKeyDown={(e) => {
          if (!open || suggestions.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelected((s) => (s + 1) % suggestions.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelected((s) => (s - 1 + suggestions.length) % suggestions.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            const choice = suggestions[selected];
            if (choice) {
              e.preventDefault();
              insertSuggestion(choice);
            }
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          }
        }}
        onKeyUp={(e) => {
          // Arrow keys / Home / End can move the caret without firing onChange
          if (
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowRight' ||
            e.key === 'Home' ||
            e.key === 'End' ||
            e.key === 'Backspace'
          ) {
            syncMentionStateFromCursor();
          }
        }}
        onClick={syncMentionStateFromCursor}
        onBlur={() => {
          // Defer to allow a click on a suggestion to register first
          setTimeout(() => setOpen(false), 150);
        }}
      />
      {open ? (
        suggestions.length > 0 ? (
          <ul className="mention-popover" role="listbox" aria-label="Mention suggestions">
            {suggestions.map((s, idx) => (
              <li
                key={`${s.kind}:${s.handle}`}
                role="option"
                aria-selected={idx === selected}
                className={idx === selected ? 'selected' : ''}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertSuggestion(s);
                }}
              >
                <span className="mention-handle">@{s.handle}</span>
                <span className="mention-kind">{s.kind}</span>
                <span className="mention-reason">{s.reason}</span>
              </li>
            ))}
          </ul>
        ) : loading || fetchedQuery !== query ? (
          <div className="mention-popover empty">
            <span className="muted">Loading…</span>
          </div>
        ) : (
          <div className="mention-popover empty">
            <span className="muted">
              No match{query ? ` for “${query}”` : ''} — keep typing to mention a new handle
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}
