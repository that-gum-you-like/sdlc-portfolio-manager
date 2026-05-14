import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb, getRawDb } from '@/db';
import {
  discoveries,
  discoveryDrafts,
  relationships,
  workItems,
} from '@/db/schema';
import type { WorkItemType } from '@/lib/work-items';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string; draftId: string }>;
}

interface DraftData {
  title?: string;
  description?: string;
  acceptance_criteria?: Array<{ id: string; text: string }>;
  value?: number;
  complexity?: number;
}

interface RelationshipDraft {
  targetDraftId: string;
  type: 'parent_of' | 'blocks' | 'depends_on' | 'duplicates' | 'related_to' | 'predecessor_of';
}

// POST /api/v1/discoveries/:id/drafts/:draftId/accept
//
// Creates the real work item from the draft and persists any inter-draft
// relationship_drafts whose other side is already accepted. If the parent
// draft has been accepted, link via the canonical parent_id FK; if a related
// draft has been accepted, insert a relationships row.
export async function POST(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id, draftId } = await params;

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  const draft = db
    .select()
    .from(discoveryDrafts)
    .where(
      and(
        eq(discoveryDrafts.id, draftId),
        eq(discoveryDrafts.discoveryId, id),
        eq(discoveryDrafts.userId, userId),
      ),
    )
    .get();
  if (!draft) return apiError('not_found', 'Draft not found', 404);
  if (draft.status === 'accepted') {
    return apiError('already_accepted', 'Draft is already accepted', 409);
  }
  if (draft.status === 'rejected') {
    return apiError('rejected', 'Draft was rejected — un-reject before accepting', 409);
  }

  const discovery = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.id, id), eq(discoveries.userId, userId)))
    .get();
  if (!discovery) return apiError('not_found', 'Discovery not found', 404);

  let parsed: DraftData = {};
  try {
    parsed = JSON.parse(draft.draftData) as DraftData;
  } catch {
    return apiError('malformed_draft', 'Draft data is not valid JSON', 500);
  }

  let parsedRelationships: RelationshipDraft[] = [];
  try {
    const r = JSON.parse(draft.relationshipDrafts) as unknown;
    if (Array.isArray(r)) parsedRelationships = r as RelationshipDraft[];
  } catch {
    parsedRelationships = [];
  }

  // Resolve parent_id from the parent draft if it's been accepted already.
  let parentWorkItemId: string | null = null;
  if (draft.parentDraftId) {
    const parentDraft = db
      .select()
      .from(discoveryDrafts)
      .where(eq(discoveryDrafts.id, draft.parentDraftId))
      .get();
    if (parentDraft?.status === 'accepted' && parentDraft.resultingWorkItemId) {
      parentWorkItemId = parentDraft.resultingWorkItemId;
    }
  }

  const result = raw.transaction(() => {
    // Create the work item
    const [workItem] = db
      .insert(workItems)
      .values({
        userId,
        projectId: discovery.projectId,
        parentId: parentWorkItemId,
        type: draft.draftType as WorkItemType,
        status: 'backlog' as const,
        title: parsed.title ?? '(untitled draft)',
        description: parsed.description ?? null,
        labels: '[]',
        acceptanceCriteria: JSON.stringify(parsed.acceptance_criteria ?? []),
        subtypeData: JSON.stringify({
          ...(parsed.value !== undefined ? { value: parsed.value } : {}),
          ...(parsed.complexity !== undefined ? { complexity: parsed.complexity } : {}),
        }),
        sourceDiscoveryId: discovery.id,
      })
      .returning()
      .all();
    if (!workItem) throw new Error('failed to create work item');

    // Mark the draft accepted with FK to the new work item
    db.update(discoveryDrafts)
      .set({
        status: 'accepted',
        resultingWorkItemId: workItem.id,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(discoveryDrafts.id, draftId))
      .run();

    // For each relationship_draft whose target is also accepted, materialize
    // it in the relationships table. Skip parent_of (canonical FK above).
    const relationshipsCreated: string[] = [];
    for (const rel of parsedRelationships) {
      if (rel.type === 'parent_of') continue;
      const otherDraft = db
        .select()
        .from(discoveryDrafts)
        .where(eq(discoveryDrafts.id, rel.targetDraftId))
        .get();
      if (otherDraft?.status === 'accepted' && otherDraft.resultingWorkItemId) {
        const [created] = db
          .insert(relationships)
          .values({
            userId,
            sourceType: 'work_item',
            sourceId: workItem.id,
            targetType: 'work_item',
            targetId: otherDraft.resultingWorkItemId,
            type: rel.type,
          })
          .returning()
          .all();
        if (created) relationshipsCreated.push(created.id);
      }
    }

    return { workItem, relationshipsCreated };
  });
  const r = result();

  return NextResponse.json({
    workItem: r.workItem,
    relationshipsCreated: r.relationshipsCreated,
  }, { status: 201 });
}
