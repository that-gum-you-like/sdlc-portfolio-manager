import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb, getRawDb } from '@/db';
import { automationRuns, comments, projects, workItems } from '@/db/schema';
import { WORK_ITEM_TYPES, type WorkItemType } from '@/lib/work-items';

export const dynamic = 'force-dynamic';

const NewFinding = z.object({
  type: z.enum(WORK_ITEM_TYPES),
  title: z.string().min(1).max(200),
  description: z.string().max(50_000).optional(),
  labels: z.array(z.string().min(1).max(40)).optional(),
  acceptanceCriteria: z
    .array(z.object({ id: z.string(), text: z.string() }))
    .optional(),
});

const ResultsBody = z.object({
  // Either a parent work item to scope under OR an explicit project.
  parentWorkItemId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),

  automationSlug: z.string().max(120).optional(),
  automationEntryId: z.string().uuid().optional(),

  status: z.enum(['completed', 'failed']).default('completed'),
  summary: z.string().max(2000).optional(),

  // Side effects to apply
  comments: z
    .array(
      z.object({
        workItemId: z.string().uuid().optional(),
        author: z.string().min(1).max(120),
        body: z.string().min(1).max(50_000),
      }),
    )
    .optional(),
  findings: z.array(NewFinding).optional(),

  startedAt: z.string().datetime().optional(),
});

// POST /api/v1/automation-results
//
// A Cursor Automation reports its run outcome here. Each call:
//  * Records a row in automation_runs
//  * Optionally creates "finding" work items linked to a parent
//  * Optionally appends comments to existing work items
// All side effects are wrapped in a single transaction.
export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, ResultsBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  if (!body.parentWorkItemId && !body.projectId) {
    return apiError(
      'project_or_parent_required',
      'Provide either projectId or parentWorkItemId so the run can be project-scoped',
      400,
    );
  }

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  // Resolve project from parent if not provided directly
  let projectId = body.projectId;
  let parent: typeof workItems.$inferSelect | undefined;
  if (body.parentWorkItemId) {
    parent = db
      .select()
      .from(workItems)
      .where(and(eq(workItems.id, body.parentWorkItemId), eq(workItems.userId, userId)))
      .get();
    if (!parent) return apiError('parent_not_found', 'Parent work item not found', 404);
    projectId = parent.projectId;
  }

  if (projectId) {
    const project = db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .get();
    if (!project) return apiError('project_not_found', 'Project not found', 404);
  }

  const startedAt = body.startedAt ?? new Date().toISOString();
  const completedAt = new Date().toISOString();
  const createdItemIds: string[] = [];

  const result = raw.transaction(() => {
    // Comments first
    if (body.comments?.length) {
      for (const c of body.comments) {
        const targetId = c.workItemId ?? body.parentWorkItemId;
        if (!targetId) continue;
        const wi = db
          .select()
          .from(workItems)
          .where(and(eq(workItems.id, targetId), eq(workItems.userId, userId)))
          .get();
        if (!wi) continue;
        db.insert(comments)
          .values({
            userId,
            projectId: wi.projectId,
            workItemId: wi.id,
            author: c.author,
            body: c.body,
          })
          .run();
      }
    }

    // Findings: create new work items linked to the parent
    if (body.findings?.length && projectId) {
      for (const f of body.findings) {
        const [created] = db
          .insert(workItems)
          .values({
            userId,
            projectId,
            parentId: body.parentWorkItemId ?? null,
            type: f.type,
            status: 'backlog' as const,
            title: f.title,
            description: f.description,
            labels: JSON.stringify(f.labels ?? []),
            acceptanceCriteria: JSON.stringify(f.acceptanceCriteria ?? []),
          })
          .returning()
          .all();
        if (created) createdItemIds.push(created.id);
      }
    }

    // Record the run
    const [run] = db
      .insert(automationRuns)
      .values({
        userId,
        projectId: projectId ?? null,
        automationEntryId: body.automationEntryId ?? null,
        automationSlug: body.automationSlug ?? null,
        startedAt,
        completedAt,
        status: body.status,
        summary: body.summary ?? null,
        createdItemIdsJson: JSON.stringify(createdItemIds),
      })
      .returning()
      .all();
    return run;
  });

  return NextResponse.json(
    { run: result(), createdItemIds, parentWorkItemId: body.parentWorkItemId ?? null },
    { status: 201 },
  );
}
