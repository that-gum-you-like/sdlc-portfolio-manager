import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import {
  PatchWorkItemBody,
  allowedNextStatuses,
  isTransitionAllowed,
  type WorkItemStatus,
} from '@/lib/work-items';
import { getDb } from '@/db';
import { workItems, type WorkItem } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

function findById(id: string): WorkItem | undefined {
  const db = getDb();
  return db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, currentUserId())))
    .get();
}

function isDescendant(rootId: string, candidateAncestorId: string): boolean {
  // Returns true if `candidateAncestorId` appears in the ancestor chain
  // starting upwards from `rootId`. Used both ways: detect cycles when
  // setting a new parent, and reject self-parenting.
  const db = getDb();
  let current: string | null = rootId;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current)) return false; // existing cycle (shouldn't happen, but safe)
    visited.add(current);
    if (current === candidateAncestorId) return true;
    const row = db
      .select({ parentId: workItems.parentId })
      .from(workItems)
      .where(eq(workItems.id, current))
      .get();
    current = row?.parentId ?? null;
  }
  return false;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const item = findById(id);
  if (!item) return apiError('not_found', 'Work item not found', 404);

  const db = getDb();
  const parent = item.parentId
    ? db
        .select()
        .from(workItems)
        .where(and(eq(workItems.id, item.parentId), eq(workItems.userId, currentUserId())))
        .get()
    : null;
  const children = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.parentId, item.id), eq(workItems.userId, currentUserId())))
    .all();

  return NextResponse.json({ workItem: item, parent, children });
}

export async function PATCH(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, PatchWorkItemBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const existing = findById(id);
  if (!existing) return apiError('not_found', 'Work item not found', 404);

  // Devlog entries are append-only
  if (existing.type === 'devlog-entry' && (body.title !== undefined || body.description !== undefined)) {
    return apiError(
      'devlog_append_only',
      'devlog-entry work items are append-only — cannot edit title or description',
      400,
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.assignee !== undefined) updates.assignee = body.assignee;
  if (body.labels !== undefined) updates.labels = JSON.stringify(body.labels);
  if (body.acceptanceCriteria !== undefined)
    updates.acceptanceCriteria = JSON.stringify(body.acceptanceCriteria);
  if (body.subtypeData !== undefined) updates.subtypeData = JSON.stringify(body.subtypeData);
  if (body.rank !== undefined) updates.rank = body.rank;

  if (body.parentId !== undefined) {
    if (body.parentId === null) {
      updates.parentId = null;
    } else if (body.parentId === existing.id) {
      return apiError('self_parent', 'A work item cannot be its own parent', 400);
    } else {
      // The candidate parent must not be a descendant of `existing`.
      // Walk upwards from the candidate parent; if we ever pass through `existing.id`,
      // making the link would create a cycle.
      if (isDescendant(body.parentId, existing.id)) {
        return apiError('parent_cycle', 'Cannot set parent — would create a cycle', 400);
      }
      const db = getDb();
      const candidate = db
        .select()
        .from(workItems)
        .where(and(eq(workItems.id, body.parentId), eq(workItems.userId, currentUserId())))
        .get();
      if (!candidate) return apiError('parent_not_found', 'Parent work item not found', 404);
      if (candidate.projectId !== existing.projectId) {
        return apiError(
          'parent_cross_project',
          'Parent must be in the same project — use the relationships table for cross-project parent links',
          400,
        );
      }
      updates.parentId = body.parentId;
    }
  }

  if (body.status !== undefined && body.status !== existing.status) {
    if (!isTransitionAllowed(existing.status as WorkItemStatus, body.status)) {
      return apiError(
        'invalid_transition',
        `Cannot transition from ${existing.status} to ${body.status}`,
        400,
        {
          from: existing.status,
          to: body.status,
          allowed: allowedNextStatuses(existing.status as WorkItemStatus),
        },
      );
    }
    updates.status = body.status;
    // Track previous_status when entering needs-human (HITL spec)
    if (body.status === 'needs-human') {
      updates.previousStatus = existing.status;
    }
  }

  const db = getDb();
  const [updated] = db
    .update(workItems)
    .set(updates)
    .where(eq(workItems.id, id))
    .returning()
    .all();
  return NextResponse.json({ workItem: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const existing = findById(id);
  if (!existing) return apiError('not_found', 'Work item not found', 404);
  const db = getDb();
  db.delete(workItems).where(eq(workItems.id, id)).run();
  return new NextResponse(null, { status: 204 });
}
