import { and, eq, gte } from 'drizzle-orm';
import { z } from 'zod';

import { getDb } from '@/db';
import { comments, guardrailRuns } from '@/db/schema';
import { currentUserId } from './auth';
import { findLibraryEntry, listLibraryEntries } from './library';

export const GuardrailFrontmatter = z.object({
  kind: z.enum(['rate-limit', 'forbidden-paths', 'evidence-required', 'custom']),
  scope: z.enum(['per-agent', 'per-project', 'per-work-item', 'global']).default('per-agent'),
  action_patterns: z.array(z.string()).default(['*']),
  verdict_on_breach: z.enum(['allow', 'warn', 'block']).default('warn'),
  message: z.string().optional(),
  // kind-specific config (validated loosely)
  limit_per_hour: z.number().int().min(1).optional(),
  path_globs: z.array(z.string()).optional(),
  lookback_hours: z.number().int().min(1).optional(),
});
export type GuardrailFrontmatter = z.infer<typeof GuardrailFrontmatter>;

export interface GuardrailEntryRef {
  slug: string;
  name: string;
  frontmatter: GuardrailFrontmatter;
}

export function listGuardrails(): GuardrailEntryRef[] {
  return listLibraryEntries('guardrail')
    .map((e) => {
      const parsed = GuardrailFrontmatter.safeParse(e.frontmatter);
      if (!parsed.success) return null;
      return { slug: e.slug, name: e.name, frontmatter: parsed.data };
    })
    .filter((g): g is GuardrailEntryRef => g !== null);
}

export interface CheckRequest {
  action: string;
  agent: string;
  workItemId?: string | null;
  projectId?: string | null;
  context?: Record<string, unknown>;
}

export interface CheckResult {
  verdict: 'allow' | 'warn' | 'block';
  reason?: string;
  breaches: Array<{ slug: string; verdict: 'warn' | 'block'; message: string }>;
}

function actionMatches(patterns: string[], action: string): boolean {
  return patterns.some((p) => p === '*' || p === action);
}

function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`));
}

function globMatch(glob: string, path: string): boolean {
  const re = new RegExp(
    '^' +
      glob
        .replace(/[.+^$(){}|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '<<<DSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<DSTAR>>>/g, '.*') +
      '$',
  );
  return re.test(path);
}

// Evaluate every applicable guardrail against the proposed action and return
// the strictest verdict. Records each evaluation in guardrail_runs so the
// trajectory + a future dashboard can show what fired.
export function checkGuardrails(req: CheckRequest): CheckResult {
  const db = getDb();
  const userId = currentUserId();
  const guardrails = listGuardrails();
  const breaches: CheckResult['breaches'] = [];

  for (const g of guardrails) {
    if (!actionMatches(g.frontmatter.action_patterns, req.action)) continue;

    let breached = false;
    let detail: Record<string, string | number> = { agent: req.agent, action: req.action };

    if (g.frontmatter.kind === 'rate-limit' && g.frontmatter.limit_per_hour) {
      // Count guardrail_runs (allow + warn + block) of this agent in last hour.
      // We use guardrail_runs itself as the audit log; checking other tables
      // would conflate with reads.
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = db
        .select({ id: guardrailRuns.id })
        .from(guardrailRuns)
        .where(
          and(
            eq(guardrailRuns.userId, userId),
            eq(guardrailRuns.agentName, req.agent),
            gte(guardrailRuns.evaluatedAt, since),
          ),
        )
        .all();
      if (recent.length >= g.frontmatter.limit_per_hour) {
        breached = true;
        detail = { ...detail, count: recent.length, limit: g.frontmatter.limit_per_hour };
      }
    } else if (g.frontmatter.kind === 'forbidden-paths' && g.frontmatter.path_globs) {
      const path =
        (req.context?.path as string | undefined) ??
        (req.context?.url as string | undefined) ??
        '';
      if (path && g.frontmatter.path_globs.some((glob) => globMatch(glob, path))) {
        breached = true;
        detail = { ...detail, path };
      }
    } else if (g.frontmatter.kind === 'evidence-required' && req.workItemId) {
      const lookback = g.frontmatter.lookback_hours ?? 24;
      const since = new Date(Date.now() - lookback * 60 * 60 * 1000).toISOString();
      const evidence = db
        .select({ id: comments.id })
        .from(comments)
        .where(
          and(
            eq(comments.userId, userId),
            eq(comments.workItemId, req.workItemId),
            eq(comments.kind, 'evidence'),
            gte(comments.createdAt, since),
          ),
        )
        .all();
      if (evidence.length === 0) {
        breached = true;
        detail = { ...detail, lookback_hours: lookback };
      }
    }

    const verdict = breached ? g.frontmatter.verdict_on_breach : 'allow';
    const reason = breached
      ? format(g.frontmatter.message ?? `${g.frontmatter.kind} breach`, detail)
      : undefined;

    db.insert(guardrailRuns)
      .values({
        userId,
        projectId: req.projectId ?? null,
        workItemId: req.workItemId ?? null,
        guardrailSlug: g.slug,
        action: req.action,
        agentName: req.agent,
        verdict,
        reason: reason ?? null,
      })
      .run();

    if (breached && (verdict === 'warn' || verdict === 'block')) {
      breaches.push({ slug: g.slug, verdict, message: reason ?? '' });
    }
  }

  // Strictest verdict wins
  let final: 'allow' | 'warn' | 'block' = 'allow';
  for (const b of breaches) {
    if (b.verdict === 'block') {
      final = 'block';
      break;
    }
    if (b.verdict === 'warn') final = 'warn';
  }

  return {
    verdict: final,
    reason: breaches.map((b) => b.message).join(' · ') || undefined,
    breaches,
  };
}

// Make findLibraryEntry import visible (avoids unused-import warning)
void findLibraryEntry;
