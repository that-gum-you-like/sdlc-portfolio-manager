import { and, asc, eq } from 'drizzle-orm';

import { getDb } from '@/db';
import {
  automationRuns,
  comments,
  handoffs,
  mentions,
  notifications,
  overrides,
  publishHistory,
  questions,
  validationRuns,
  workItemLinks,
  workItemStatusChanges,
  workItems,
} from '@/db/schema';
import { currentUserId } from './auth';

export type TrajectoryEventKind =
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

export interface TrajectoryEvent {
  id: string;
  kind: TrajectoryEventKind;
  at: string; // ISO timestamp
  actor: string | null;
  title: string;
  detail?: string;
  link?: { kind: string; id: string }; // for click-through
  meta?: Record<string, unknown>;
}

// Single helper that pulls every "thing that happened" related to a work item
// out of the existing tables and emits a unified, time-ordered event list. No
// new emit-side plumbing required — every existing write path already records
// what it does (this is the payoff for having narrow tables).
export function buildTrajectory(workItemId: string): TrajectoryEvent[] {
  const db = getDb();
  const userId = currentUserId();

  const events: TrajectoryEvent[] = [];

  // 1) Status transitions (includes 'created' as null→backlog)
  const transitions = db
    .select()
    .from(workItemStatusChanges)
    .where(
      and(
        eq(workItemStatusChanges.workItemId, workItemId),
        eq(workItemStatusChanges.userId, userId),
      ),
    )
    .orderBy(asc(workItemStatusChanges.changedAt))
    .all();
  for (const t of transitions) {
    if (t.fromStatus === null) {
      events.push({
        id: `created:${t.id}`,
        kind: 'created',
        at: t.changedAt,
        actor: t.changedBy,
        title: `filed as ${t.toStatus}`,
        meta: { from: null, to: t.toStatus },
      });
    } else {
      const claimLike = t.fromStatus === 'ready' && t.toStatus === 'in_progress';
      events.push({
        id: `status:${t.id}`,
        kind: claimLike ? 'claim' : 'status_change',
        at: t.changedAt,
        actor: t.changedBy,
        title: claimLike
          ? `claimed`
          : `${t.fromStatus} → ${t.toStatus}`,
        detail: t.overrideId ? `via override` : undefined,
        meta: { from: t.fromStatus, to: t.toStatus, overrideId: t.overrideId },
      });
    }
  }

  // 2) Comments + evidence
  const cs = db
    .select()
    .from(comments)
    .where(and(eq(comments.workItemId, workItemId), eq(comments.userId, userId)))
    .orderBy(asc(comments.createdAt))
    .all();
  for (const c of cs) {
    const truncated = c.body.length > 200 ? c.body.slice(0, 197) + '…' : c.body;
    events.push({
      id: `comment:${c.id}`,
      kind: c.kind === 'evidence' ? 'evidence' : 'comment',
      at: c.createdAt,
      actor: c.author,
      title:
        c.kind === 'evidence'
          ? `evidence for ${c.criterionId ?? '(no criterion)'}`
          : `commented`,
      detail: truncated,
      meta: { criterionId: c.criterionId, kind: c.kind },
    });
  }

  // 3) Questions asked + answered (two events per answered question)
  const qs = db
    .select()
    .from(questions)
    .where(and(eq(questions.workItemId, workItemId), eq(questions.userId, userId)))
    .orderBy(asc(questions.askedAt))
    .all();
  for (const q of qs) {
    const body = q.body.length > 200 ? q.body.slice(0, 197) + '…' : q.body;
    events.push({
      id: `q-ask:${q.id}`,
      kind: 'question_asked',
      at: q.askedAt,
      actor: q.askedBy,
      title: q.addressedTo ? `asked @${q.addressedTo}` : `asked a question`,
      detail: body,
      meta: { questionId: q.id, addressedTo: q.addressedTo },
    });
    if (q.status === 'answered' && q.answeredAt) {
      events.push({
        id: `q-ans:${q.id}`,
        kind: 'question_answered',
        at: q.answeredAt,
        actor: null,
        title: `question answered`,
        meta: { questionId: q.id, answerCommentId: q.answerId },
      });
    }
  }

  // 4) Mentions
  const ms = db
    .select()
    .from(mentions)
    .where(and(eq(mentions.workItemId, workItemId), eq(mentions.userId, userId)))
    .orderBy(asc(mentions.createdAt))
    .all();
  for (const m of ms) {
    events.push({
      id: `mention:${m.id}`,
      kind: 'mention',
      at: m.createdAt,
      actor: null,
      title: `@${m.mentionedHandle} mentioned`,
      meta: {
        resolvedUserId: m.resolvedUserId,
        resolvedAgentName: m.resolvedAgentName,
      },
    });
  }

  // 5) Validation runs (one event each — pass/fail/etc.)
  const vrs = db
    .select()
    .from(validationRuns)
    .where(
      and(
        eq(validationRuns.workItemId, workItemId),
        eq(validationRuns.userId, userId),
      ),
    )
    .orderBy(asc(validationRuns.startedAt))
    .all();
  for (const vr of vrs) {
    events.push({
      id: `vr:${vr.id}`,
      kind: 'validation_run',
      at: vr.completedAt ?? vr.startedAt,
      actor: vr.validatorSlug,
      title: `${vr.gate}: ${vr.status}`,
      detail: vr.exitCode !== null ? `exit ${vr.exitCode}` : undefined,
      link: { kind: 'validation_run', id: vr.id },
      meta: {
        gate: vr.gate,
        status: vr.status,
        validatorSlug: vr.validatorSlug,
      },
    });
  }

  // 6) Overrides (these reference work_item, listed independently of the
  //    status_change event that consumed them)
  const ovs = db
    .select()
    .from(overrides)
    .where(
      and(eq(overrides.workItemId, workItemId), eq(overrides.userId, userId)),
    )
    .orderBy(asc(overrides.submittedAt))
    .all();
  for (const o of ovs) {
    let failing: string[] = [];
    try {
      const parsed = JSON.parse(o.failingGatesJson) as unknown;
      if (Array.isArray(parsed)) failing = parsed as string[];
    } catch {
      /* ignore */
    }
    events.push({
      id: `override:${o.id}`,
      kind: 'override',
      at: o.submittedAt,
      actor: o.submittedBy,
      title: `override ${failing.join(', ') || 'gate(s)'}`,
      detail: o.reason,
      meta: { failingGates: failing },
    });
  }

  // 7) Automation runs that touched this item (matched via the createdItemIds
  //    json blob — runs that produced this item as a finding child, AND any
  //    parent-scoped runs where the parent matches).
  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), eq(workItems.userId, userId)))
    .get();
  const runs = db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.userId, userId))
    .orderBy(asc(automationRuns.startedAt))
    .all();
  for (const r of runs) {
    let createdIds: string[] = [];
    try {
      const parsed = JSON.parse(r.createdItemIdsJson) as unknown;
      if (Array.isArray(parsed)) createdIds = parsed as string[];
    } catch {
      /* ignore */
    }
    const created = createdIds.includes(workItemId);
    const parentMatches = item?.parentId && createdIds.includes(item.parentId);
    if (!created && !parentMatches) continue;
    events.push({
      id: `auto:${r.id}`,
      kind: 'automation_run',
      at: r.completedAt ?? r.startedAt,
      actor: r.automationSlug,
      title: `automation: ${r.status}`,
      detail: r.summary ?? undefined,
      link: r.automationSlug
        ? { kind: 'automation', id: r.automationSlug }
        : undefined,
      meta: { slug: r.automationSlug, createdItemCount: createdIds.length },
    });
  }

  // 8) Handoffs (P2 — explicit agent → agent delegation)
  const hs = db
    .select()
    .from(handoffs)
    .where(and(eq(handoffs.workItemId, workItemId), eq(handoffs.userId, userId)))
    .orderBy(asc(handoffs.createdAt))
    .all();
  for (const h of hs) {
    events.push({
      id: `handoff:${h.id}`,
      kind: 'handoff',
      at: h.createdAt,
      actor: h.fromAgent,
      title: `handed off → ${h.toAgent}`,
      detail: h.reason,
      meta: { fromAgent: h.fromAgent, toAgent: h.toAgent, context: h.contextBlob },
    });
  }

  // 9) Work-item links (P5 — PRs / commits / deploys)
  const links = db
    .select()
    .from(workItemLinks)
    .where(
      and(eq(workItemLinks.workItemId, workItemId), eq(workItemLinks.userId, userId)),
    )
    .orderBy(asc(workItemLinks.createdAt))
    .all();
  for (const l of links) {
    events.push({
      id: `link:${l.id}`,
      kind: 'link',
      at: l.createdAt,
      actor: l.createdBy,
      title: `${l.kind} linked: ${l.ref}`,
      detail: l.url,
      meta: { provider: l.provider, kind: l.kind, ref: l.ref, url: l.url, state: l.state },
    });
  }

  // 10) Publishes from the library that target this project — not per-item;
  //     surface as a filter on a future timeline view if needed.
  void notifications;
  void publishHistory;

  // Sort by timestamp ascending (oldest first — replay semantics)
  events.sort((a, b) => a.at.localeCompare(b.at));
  return events;
}
