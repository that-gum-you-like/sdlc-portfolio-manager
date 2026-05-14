import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import {
  CreateWorkItemBody,
  WORK_ITEM_STATUSES,
  WORK_ITEM_TYPES,
  validateSubtypeOnCreate,
} from '@/lib/work-items';
import { getDb } from '@/db';
import { projects, workItems, workItemStatusChanges } from '@/db/schema';

export const dynamic = 'force-dynamic';

const ALLOWED_FILTER_STATUSES = new Set<string>(WORK_ITEM_STATUSES);
const ALLOWED_FILTER_TYPES = new Set<string>(WORK_ITEM_TYPES);

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const params = url.searchParams;

  const userId = currentUserId();
  const db = getDb();

  const conditions = [eq(workItems.userId, userId)];

  const projectId = params.get('projectId');
  if (projectId) conditions.push(eq(workItems.projectId, projectId));

  const statusParam = params.getAll('status').flatMap((s) => s.split(','));
  if (statusParam.length > 0) {
    const valid = statusParam.filter((s) => ALLOWED_FILTER_STATUSES.has(s)) as (typeof WORK_ITEM_STATUSES)[number][];
    if (valid.length === 0) {
      return apiError('invalid_status_filter', 'No valid status values in filter', 400);
    }
    conditions.push(inArray(workItems.status, valid));
  }

  const typeParam = params.getAll('type').flatMap((s) => s.split(','));
  if (typeParam.length > 0) {
    const valid = typeParam.filter((t) => ALLOWED_FILTER_TYPES.has(t)) as (typeof WORK_ITEM_TYPES)[number][];
    if (valid.length === 0) {
      return apiError('invalid_type_filter', 'No valid type values in filter', 400);
    }
    conditions.push(inArray(workItems.type, valid));
  }

  const assignee = params.get('assignee');
  if (assignee) conditions.push(eq(workItems.assignee, assignee));

  const parentId = params.get('parentId');
  if (parentId) conditions.push(eq(workItems.parentId, parentId));

  const rows = db
    .select()
    .from(workItems)
    .where(and(...conditions))
    .orderBy(desc(workItems.updatedAt))
    .all();

  const label = params.get('label');
  const filteredByLabel = label
    ? rows.filter((r) => {
        try {
          const labels = JSON.parse(r.labels) as string[];
          return Array.isArray(labels) && labels.includes(label);
        } catch {
          return false;
        }
      })
    : rows;

  return NextResponse.json({ workItems: filteredByLabel });
}

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CreateWorkItemBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const db = getDb();
  const userId = currentUserId();

  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId)))
    .get();
  if (!project) return apiError('project_not_found', 'Project not found', 404);

  if (body.parentId) {
    const parent = db
      .select()
      .from(workItems)
      .where(and(eq(workItems.id, body.parentId), eq(workItems.userId, userId)))
      .get();
    if (!parent) return apiError('parent_not_found', 'Parent work item not found', 404);
    if (parent.projectId !== body.projectId) {
      return apiError(
        'parent_cross_project',
        'parent_id must belong to the same project (cross-project parent relationships use the relationships table)',
        400,
      );
    }
  }

  const subtypeCheck = validateSubtypeOnCreate(body.type, body.acceptanceCriteria);
  if (!subtypeCheck.ok) {
    return apiError(subtypeCheck.code, subtypeCheck.message, 400);
  }

  const [created] = db
    .insert(workItems)
    .values({
      userId,
      projectId: body.projectId,
      parentId: body.parentId ?? null,
      type: body.type,
      status: body.status ?? 'backlog',
      title: body.title,
      description: body.description,
      assignee: body.assignee ?? null,
      labels: JSON.stringify(body.labels ?? []),
      acceptanceCriteria: JSON.stringify(body.acceptanceCriteria ?? []),
      subtypeData: JSON.stringify(body.subtypeData ?? {}),
    })
    .returning()
    .all();

  if (created) {
    db.insert(workItemStatusChanges)
      .values({
        userId,
        projectId: created.projectId,
        workItemId: created.id,
        fromStatus: null,
        toStatus: created.status,
        changedBy: userId,
      })
      .run();
  }

  return NextResponse.json({ workItem: created }, { status: 201 });
}
