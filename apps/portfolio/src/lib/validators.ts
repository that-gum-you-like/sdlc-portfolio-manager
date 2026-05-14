import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { z } from 'zod';

import { findLibraryEntry, listLibraryEntries } from './library';

export const VALIDATION_GATES = [
  'quality',
  'security',
  'bugs',
  'user-story-acceptance',
] as const;
export type ValidationGate = (typeof VALIDATION_GATES)[number];

export const ValidatorFrontmatter = z.object({
  gate: z.enum(VALIDATION_GATES),
  command: z.string().min(1),
  pass_exit_codes: z.array(z.number()).default([0]),
  output_parser: z.enum(['none', 'junit-xml', 'sarif', 'json-lines']).default('none'),
  timeout_seconds: z.number().int().min(1).max(3600).default(300),
});

export type ValidatorFrontmatter = z.infer<typeof ValidatorFrontmatter>;

export interface ValidatorEntryRef {
  slug: string;
  name: string;
  filePath: string;
  frontmatter: ValidatorFrontmatter;
}

export function listValidators(): ValidatorEntryRef[] {
  const entries = listLibraryEntries('validator');
  const results: ValidatorEntryRef[] = [];
  for (const e of entries) {
    const parsed = ValidatorFrontmatter.safeParse(e.frontmatter);
    if (!parsed.success) continue;
    results.push({
      slug: e.slug,
      name: e.name,
      filePath: e.filePath,
      frontmatter: parsed.data,
    });
  }
  return results;
}

export function findValidatorForGate(gate: ValidationGate): ValidatorEntryRef | null {
  return listValidators().find((v) => v.frontmatter.gate === gate) ?? null;
}

export interface ValidatorRunOutcome {
  status: 'pass' | 'fail' | 'error';
  exitCode: number | null;
  stdoutSnippet: string;
  stderrSnippet: string;
  findings: Record<string, unknown>;
}

const SNIPPET_LIMIT = 16 * 1024; // 16KB per stream

function truncate(s: string): string {
  if (s.length <= SNIPPET_LIMIT) return s;
  return s.slice(0, SNIPPET_LIMIT) + `\n... (truncated, ${s.length - SNIPPET_LIMIT} bytes)`;
}

function buildEnv(extra: Record<string, string> = {}): Record<string, string> {
  // Sandbox env to a whitelist + project-defined extras
  const whitelist = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'NODE_ENV'];
  const out: Record<string, string> = {};
  for (const key of whitelist) {
    const val = process.env[key];
    if (val !== undefined) out[key] = val;
  }
  // SDLC_VALIDATOR=1 signals to scripts they're running inside a validator
  out.SDLC_VALIDATOR = '1';
  for (const [k, v] of Object.entries(extra)) {
    out[k] = v;
  }
  return out;
}

// Run a subprocess with a hard timeout and bounded output capture.
export async function runShellValidator(
  validator: ValidatorEntryRef,
  cwd: string,
  extraEnv: Record<string, string> = {},
): Promise<ValidatorRunOutcome> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;

    const child: ChildProcess = spawn('sh', ['-c', validator.frontmatter.command], {
      cwd,
      env: buildEnv(extraEnv) as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      if (done) return;
      child.kill('SIGTERM');
      // Hard escape valve
      setTimeout(() => {
        if (!done) child.kill('SIGKILL');
      }, 2000);
    }, validator.frontmatter.timeout_seconds * 1000);

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < SNIPPET_LIMIT * 4) stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < SNIPPET_LIMIT * 4) stderr += chunk.toString('utf8');
    });

    child.on('error', (err: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve({
        status: 'error',
        exitCode: null,
        stdoutSnippet: truncate(stdout),
        stderrSnippet: truncate(stderr + `\n[spawn error] ${err.message}`),
        findings: { spawn_error: err.message },
      });
    });

    child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      const exitCode = code;
      const killed = signal !== null;
      const passSet = new Set(validator.frontmatter.pass_exit_codes);
      let status: 'pass' | 'fail' | 'error' = 'fail';
      if (killed) {
        status = 'error';
      } else if (exitCode !== null && passSet.has(exitCode)) {
        status = 'pass';
      }
      resolve({
        status,
        exitCode,
        stdoutSnippet: truncate(stdout),
        stderrSnippet: truncate(stderr + (killed ? `\n[killed by ${signal}]` : '')),
        findings: killed ? { killed_by_signal: signal } : {},
      });
    });
  });
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
}

export interface AcceptanceMatch {
  criterion_id: string;
  matched: boolean;
  via: 'evidence' | 'test-name-keyword' | 'none';
  evidence_ref?: string;
}

// Built-in matcher: walks acceptance_criteria and matches each against either
// an evidence_links row (a comment of kind=evidence linked to this criterion)
// OR a heuristic keyword match against test names. For MVP we don't have a
// test-name source yet — the gate counts evidence-linked criteria as
// matched. When validator-driven test running lands, we can pipe junit-xml
// test names into the matcher.
export function runAcceptanceMatcher(
  criteria: AcceptanceCriterion[],
  evidenceLinkCriterionIds: Set<string>,
): { status: 'pass' | 'fail'; findings: { matches: AcceptanceMatch[]; unmatched: string[] } } {
  if (criteria.length === 0) {
    return {
      status: 'pass',
      findings: { matches: [], unmatched: [] },
    };
  }
  const matches: AcceptanceMatch[] = [];
  const unmatched: string[] = [];
  for (const c of criteria) {
    if (evidenceLinkCriterionIds.has(c.id)) {
      matches.push({ criterion_id: c.id, matched: true, via: 'evidence' });
    } else {
      matches.push({ criterion_id: c.id, matched: false, via: 'none' });
      unmatched.push(c.id);
    }
  }
  return {
    status: unmatched.length === 0 ? 'pass' : 'fail',
    findings: { matches, unmatched },
  };
}

// Convenience: find an entry by exact slug + sanity-check it's a validator.
export function findValidatorBySlug(slug: string): ValidatorEntryRef | null {
  const entry = findLibraryEntry('validator', slug);
  if (!entry) return null;
  const parsed = ValidatorFrontmatter.safeParse(entry.frontmatter);
  if (!parsed.success) return null;
  return {
    slug: entry.slug,
    name: entry.name,
    filePath: entry.filePath,
    frontmatter: parsed.data,
  };
}

export function targetRepoOrCwd(targetRepoPath: string | null): string {
  if (targetRepoPath && existsSync(targetRepoPath)) return targetRepoPath;
  return process.cwd();
}
