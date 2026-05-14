import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { CreateRelationshipBody, SYMMETRIC } from '@/lib/relationships';
import { lookupEntity } from '@/lib/entity-lookup';
import { getDb } from '@/db';
import { relationships } from '@/db/schema';

export const dynamic = 'force-dynamic';

function detectParentOfCycle(sourceId: string, targetId: string): boolean {
  // Inserting `source parent_of target` creates a cycle if `source` is already
  // reachable as a descendant of `target` (i.e. target → ... → source via parent_of).
  // Walk down from target's children iteratively.
  const db = getDb();
  const visited = new Set<string>();
  const queue: string[] = [targetId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (current === sourceId) return true;
    const children = db
      .select({ targetId: relationships.targetId })
      .from(relationships)
      .where(
        and(
          eq(relationships.userId, currentUserId()),
          eq(relationships.sourceId, current),
          eq(relationships.type, 'parent_of'),
        ),
      )
      .all();
    for (const c of children) queue.push(c.targetId);
  }
  return false;
}

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CreateRelationshipBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (body.sourceType === body.targetType && body.sourceId === body.targetId) {
    return apiError('self_relationship_forbidden', 'An entity cannot relate to itself', 400);
  }

  const source = lookupEntity(body.sourceType, body.sourceId);
  if (!source) return apiError('source_not_found', 'Source entity not found', 404);
  const target = lookupEntity(body.targetType, body.targetId);
  if (!target) return apiError('target_not_found', 'Target entity not found', 404);

  const db = getDb();
  const userId = currentUserId();

  // Cycle detection for parent_of
  if (body.type === 'parent_of' && detectParentOfCycle(body.sourceId, body.targetId)) {
    return apiError(
      'cycle_detected',
      'Cannot create parent_of — would form a cycle with existing relationships',
      400,
    );
  }

  // Dedup symmetric related_to in either direction
  if (SYMMETRIC[body.type]) {
    const reverse = db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.userId, userId),
          eq(relationships.type, body.type),
          eq(relationships.sourceType, body.targetType),
          eq(relationships.sourceId, body.targetId),
          eq(relationships.targetType, body.sourceType),
          eq(relationships.targetId, body.sourceId),
        ),
      )
      .get();
    if (reverse) {
      return NextResponse.json({ relationship: reverse, deduped: true }, { status: 200 });
    }
  }

  // Check for exact duplicate
  const existing = db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.userId, userId),
        eq(relationships.sourceType, body.sourceType),
        eq(relationships.sourceId, body.sourceId),
        eq(relationships.targetType, body.targetType),
        eq(relationships.targetId, body.targetId),
        eq(relationships.type, body.type),
      ),
    )
    .get();
  if (existing) {
    return NextResponse.json({ relationship: existing, duplicate: true }, { status: 200 });
  }

  const [created] = db
    .insert(relationships)
    .values({
      userId,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      targetType: body.targetType,
      targetId: body.targetId,
      type: body.type,
      note: body.note ?? null,
      createdBy: userId,
    })
    .returning()
    .all();

  return NextResponse.json({ relationship: created }, { status: 201 });
}
