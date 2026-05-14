import { describe, expect, it } from 'vitest';

import { parseMentions, resolveHandle, segmentBody } from '../lib/mentions.ts';

describe('parseMentions', () => {
  it('extracts simple mentions', () => {
    const result = parseMentions('hey @bryce check this and ping @frontend-developer');
    expect(result.map((m) => m.handle)).toEqual(['bryce', 'frontend-developer']);
  });

  it('does not match email addresses', () => {
    expect(parseMentions('email me at foo@bar.com')).toHaveLength(0);
  });

  it('deduplicates repeat mentions', () => {
    const result = parseMentions('@bryce hey @bryce again');
    expect(result.map((m) => m.handle)).toEqual(['bryce']);
  });

  it('ignores mentions inside fenced code blocks', () => {
    const body = ['Talk to @bryce.', '```', 'do not @ping me inside code', '```'].join('\n');
    expect(parseMentions(body).map((m) => m.handle)).toEqual(['bryce']);
  });

  it('ignores mentions inside inline code spans', () => {
    expect(parseMentions('`@ignored` but @counted is real').map((m) => m.handle)).toEqual([
      'counted',
    ]);
  });

  it('handles mentions at start of input', () => {
    expect(parseMentions('@first thing').map((m) => m.handle)).toEqual(['first']);
  });
});

describe('resolveHandle', () => {
  it('resolves bryce/me/you/local-user to local-user', () => {
    expect(resolveHandle('bryce').resolvedUserId).toBe('local-user');
    expect(resolveHandle('me').resolvedUserId).toBe('local-user');
    expect(resolveHandle('local-user').resolvedUserId).toBe('local-user');
  });

  it('treats unknown handles as agent names', () => {
    const r = resolveHandle('frontend-developer');
    expect(r.resolvedUserId).toBeNull();
    expect(r.resolvedAgentName).toBe('frontend-developer');
  });
});

describe('segmentBody', () => {
  it('returns alternating text and mention segments', () => {
    const segs = segmentBody('hi @alice and @bob');
    expect(segs.length).toBe(4);
    expect(segs[0]).toEqual({ kind: 'text', value: 'hi ' });
    expect(segs[1]?.kind).toBe('mention');
    expect(segs[1]?.handle).toBe('alice');
    expect(segs[3]?.handle).toBe('bob');
  });
});
