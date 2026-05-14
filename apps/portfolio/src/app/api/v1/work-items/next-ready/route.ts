import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb, getRawDb } from '@/db';
import { projects, workItems } from '@/db/schema';
import { WORK_ITEM_TYPES, type WorkItemType } from '@/lib/work-items';

export const dynamic = 'force-dynamic';

// GET /api/v1/work-items/next-ready[?agent=<name>&projectId=<uuid>&projectSlug=<slug>&type=task,bug&label=urgent]
//
// Cursor Automations call this on a poll. Atomically claims at most one
// `ready` work item that matches the supplied filters: transitions it to
// `in_progress`, assigns it to <agent>, and returns it. Returns 204 if
// nothing matches.
export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const params = url.searchParams;

  const agent = params.get('agent');
  if (!agent) {
    return apiError(
      'agent_required',
      'agent query param is required so we can record who is picking up the work',
      400,
    );
  }

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  // Resolve project filter — accept either projectId or projectSlug.
  let projectIdFilter: string | null = params.get('projectId');
  const projectSlug = params.get('projectSlug');
  if (!projectIdFilter && projectSlug) {
    const matches = db
      .select()
      .from(projects)
      .where(and(eq(projects.slug, projectSlug), eq(projects.userId, userId)))
      .all();
    if (matches.length === 0) {
      return apiError('project_not_found', `No project with slug ${projectSlug}`, 404);
    }
    if (matches.length > 1) {
      return apiError(
        'ambiguous_slug',
        `Slug ${projectSlug} matches ${matches.length} projects across portfolios; use projectId`,
        409,
      );
    }
    projectIdFilter = matches[0]!.id;
  }

  const typeParam = params.getAll('type').flatMap((s) => s.split(','));
  const validTypes = typeParam.filter((t) => (WORK_ITEM_TYPES as readonly string[]).includes(t)) as WorkItemType[];
  if (typeParam.length > 0 && validTypes.length === 0) {
    return apiError('invalid_type_filter', 'No valid type values', 400);
  }

  const label = params.get('label');

  const tx = raw.transaction(() => {
    const baseConditions = [
      eq(workItems.userId, userId),
      eq(workItems.status, 'ready' as const),
    ];
    if (projectIdFilter) baseConditions.push(eq(workItems.projectId, projectIdFilter));
    if (validTypes.length > 0) baseConditions.push(inArray(workItems.type, validTypes));

    const candidates = db
      .select()
      .from(workItems)
      .where(and(...baseConditions))
      .orderBy(asc(workItems.rank), asc(workItems.createdAt))
      .all();

    // Label filter is a JSON-array string in the column, so check after selection.
    const filtered = label
      ? candidates.filter((c) => {
          try {
            const labels = JSON.parse(c.labels) as unknown;
            return Array.isArray(labels) && (labels as string[]).includes(label);
          } catch {
            return false;
          }
        })
      : candidates;

    if (filtered.length === 0) return null;
    const target = filtered[0];
    if (!target) return null;

    // Conditional UPDATE: only succeeds if the row is still in 'ready'.
    // Two concurrent calls cannot both win.
    const [updated] = db
      .update(workItems)
      .set({
        status: 'in_progress' as const,
        assignee: agent,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(workItems.id, target.id), eq(workItems.status, 'ready' as const)))
      .returning()
      .all();
    return updated ?? null;
  });
  const claimed = tx();

  if (!claimed) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ workItem: claimed });
}

// Keep `sql` referenced for future query needs
void sql;
