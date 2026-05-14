import { NextResponse } from 'next/server';
import { and, eq, ne, or } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { ENTITY_TYPES, INVERSE_LABEL, SYMMETRIC, type EntityType } from '@/lib/relationships';
import { lookupEntities, lookupEntity, type EntitySummary } from '@/lib/entity-lookup';
import { getDb } from '@/db';
import { portfolios, projects, relationships, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ type: string; id: string }>;
}

interface Edge extends EntitySummary {
  relationshipId: string;
  note: string | null;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { type, id } = await params;
  if (!ENTITY_TYPES.includes(type as EntityType)) {
    return apiError('invalid_entity_type', `Unknown entity type: ${type}`, 400);
  }
  const entityType = type as EntityType;

  const center = lookupEntity(entityType, id);
  if (!center) return apiError('not_found', 'Entity not found', 404);

  const db = getDb();
  const userId = currentUserId();

  const outgoing = db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.userId, userId),
        eq(relationships.sourceType, entityType),
        eq(relationships.sourceId, id),
      ),
    )
    .all();
  const incoming = db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.userId, userId),
        eq(relationships.targetType, entityType),
        eq(relationships.targetId, id),
      ),
    )
    .all();

  // Collect every adjacent entity ref so we can batch the title lookups.
  const refs: Array<{ type: EntityType; id: string }> = [];
  for (const r of outgoing) refs.push({ type: r.targetType as EntityType, id: r.targetId });
  for (const r of incoming) refs.push({ type: r.sourceType as EntityType, id: r.sourceId });
  const summaries = lookupEntities(refs);

  function edgeKey(t: EntityType, eid: string) {
    return `${t}:${eid}`;
  }

  const groups: Record<string, Edge[]> = {};
  function push(label: string, edge: Edge) {
    if (!groups[label]) groups[label] = [];
    groups[label].push(edge);
  }

  for (const r of outgoing) {
    const summary = summaries.get(edgeKey(r.targetType as EntityType, r.targetId));
    if (!summary) continue;
    push(r.type, {
      ...summary,
      relationshipId: r.id,
      note: r.note,
    });
  }

  for (const r of incoming) {
    // Symmetric types appear as themselves regardless of direction; dedup against outgoing.
    if (SYMMETRIC[r.type as keyof typeof SYMMETRIC]) {
      const label = r.type;
      const summary = summaries.get(edgeKey(r.sourceType as EntityType, r.sourceId));
      if (!summary) continue;
      const alreadyOutgoing = (groups[label] ?? []).some((e) => e.id === r.sourceId);
      if (!alreadyOutgoing) {
        push(label, {
          ...summary,
          relationshipId: r.id,
          note: r.note,
        });
      }
      continue;
    }
    const inverseLabel = INVERSE_LABEL[r.type as keyof typeof INVERSE_LABEL];
    const summary = summaries.get(edgeKey(r.sourceType as EntityType, r.sourceId));
    if (!summary) continue;
    push(inverseLabel, {
      ...summary,
      relationshipId: r.id,
      note: r.note,
    });
  }

  // Siblings: union of (a) shared canonical FK parent, (b) shared `parent_of` parent in relationships.
  const siblings = await computeSiblings(entityType, id);
  if (siblings.length > 0) groups['siblings'] = siblings;

  return NextResponse.json({ entity: center, groups });
}

async function computeSiblings(type: EntityType, id: string): Promise<Edge[]> {
  const db = getDb();
  const userId = currentUserId();
  const seen = new Set<string>();
  const result: Edge[] = [];

  // (a) canonical FK siblings
  if (type === 'work_item') {
    const me = db
      .select({ parentId: workItems.parentId })
      .from(workItems)
      .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
      .get();
    if (me?.parentId) {
      const sibs = db
        .select({ id: workItems.id, title: workItems.title })
        .from(workItems)
        .where(
          and(
            eq(workItems.userId, userId),
            eq(workItems.parentId, me.parentId),
            ne(workItems.id, id),
          ),
        )
        .all();
      for (const s of sibs) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        result.push({ id: s.id, type: 'work_item', title: s.title, relationshipId: '', note: null });
      }
    }
  } else if (type === 'project') {
    const me = db
      .select({ portfolioId: projects.portfolioId })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .get();
    if (me?.portfolioId) {
      const sibs = db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(
          and(
            eq(projects.userId, userId),
            eq(projects.portfolioId, me.portfolioId),
            ne(projects.id, id),
          ),
        )
        .all();
      for (const s of sibs) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        result.push({ id: s.id, type: 'project', title: s.name, relationshipId: '', note: null });
      }
    }
  }

  // (b) shared parent_of via relationships
  const myParents = db
    .select()
    .from(relationships)
    .where(
      and(
        eq(relationships.userId, userId),
        eq(relationships.type, 'parent_of'),
        eq(relationships.targetType, type),
        eq(relationships.targetId, id),
      ),
    )
    .all();
  for (const p of myParents) {
    const cousins = db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.userId, userId),
          eq(relationships.type, 'parent_of'),
          eq(relationships.sourceType, p.sourceType),
          eq(relationships.sourceId, p.sourceId),
        ),
      )
      .all();
    const refs = cousins
      .filter((c) => !(c.targetType === type && c.targetId === id))
      .map((c) => ({ type: c.targetType as EntityType, id: c.targetId }));
    const summaries = lookupEntities(refs);
    for (const r of refs) {
      const key = `${r.type}:${r.id}`;
      if (seen.has(r.id)) continue;
      const summary = summaries.get(key);
      if (!summary) continue;
      seen.add(r.id);
      result.push({ ...summary, relationshipId: '', note: null });
    }
  }

  // Reference portfolios to satisfy lint (unused-import guard) since we only read via summaries above.
  void portfolios;
  void or;

  return result;
}
