import { v4 as uuid } from 'uuid';

// Capture @-mentions in markdown bodies. The handle is the longest run of
// word-class characters following an @ that is not preceded by another word
// character (so emails are not treated as mentions). Inline code spans and
// fenced code blocks are stripped before parsing to avoid false positives.
const MENTION_RE = /(^|[^\w`])@([a-zA-Z][a-zA-Z0-9_-]{0,63})/g;

export interface ParsedMention {
  handle: string;
  index: number;
}

function stripCode(input: string): string {
  // Remove fenced code blocks.
  let out = input.replace(/```[\s\S]*?```/g, (block) => ' '.repeat(block.length));
  // Remove inline code spans.
  out = out.replace(/`[^`\n]*`/g, (block) => ' '.repeat(block.length));
  return out;
}

export function parseMentions(body: string): ParsedMention[] {
  const cleaned = stripCode(body);
  const seen = new Set<string>();
  const out: ParsedMention[] = [];
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(cleaned)) !== null) {
    const [, , handle] = match;
    if (!handle) continue;
    const lower = handle.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push({ handle, index: match.index + (match[1]?.length ?? 0) });
  }
  return out;
}

export interface ResolvedHandle {
  handle: string;
  resolvedUserId: string | null;
  resolvedAgentName: string | null;
}

// Resolve a handle to either a user or an agent.
// MVP heuristic: local-user is the only human handle ("you", "me", or "local-user");
// any other handle resolves as an agent name. Once personas are seeded (framework-port)
// this will check the library for matching persona slugs.
export function resolveHandle(handle: string): ResolvedHandle {
  const lower = handle.toLowerCase();
  if (lower === 'me' || lower === 'you' || lower === 'local-user' || lower === 'bryce') {
    return { handle, resolvedUserId: 'local-user', resolvedAgentName: null };
  }
  return { handle, resolvedUserId: null, resolvedAgentName: handle };
}

export interface MentionRecord {
  id: string;
  handle: string;
  resolvedUserId: string | null;
  resolvedAgentName: string | null;
}

export function buildMentionRecords(handles: ParsedMention[]): MentionRecord[] {
  return handles.map((m) => {
    const r = resolveHandle(m.handle);
    return {
      id: uuid(),
      handle: m.handle,
      resolvedUserId: r.resolvedUserId,
      resolvedAgentName: r.resolvedAgentName,
    };
  });
}

// Render @-mentions in a comment body as styled spans. Returns a sequence of
// text/mention segments the caller can render directly.
export interface RenderSegment {
  kind: 'text' | 'mention';
  value: string;
  handle?: string;
}

export function segmentBody(body: string): RenderSegment[] {
  const segments: RenderSegment[] = [];
  const cleaned = stripCode(body);
  const re = new RegExp(MENTION_RE);
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    const fullStart = match.index + (match[1]?.length ?? 0);
    if (fullStart > cursor) {
      segments.push({ kind: 'text', value: body.slice(cursor, fullStart) });
    }
    const handle = match[2];
    if (!handle) continue;
    segments.push({ kind: 'mention', value: `@${handle}`, handle });
    cursor = fullStart + 1 + handle.length;
  }
  if (cursor < body.length) {
    segments.push({ kind: 'text', value: body.slice(cursor) });
  }
  return segments;
}
