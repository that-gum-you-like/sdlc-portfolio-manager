import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveries, projects } from '@/db/schema';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  projectId: z.string().uuid(),
  rawDump: z.string().min(1).max(200_000),
  source: z.enum(['text', 'voice-transcript', 'meeting-notes', 'email']).optional(),
});

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const generationRequested = url.searchParams.get('generation_requested');
  const projectId = url.searchParams.get('projectId');

  const db = getDb();
  const userId = currentUserId();
  const conditions = [eq(discoveries.userId, userId)];
  if (status) {
    if (!['draft', 'generating', 'reviewing', 'accepted', 'archived'].includes(status)) {
      return apiError('invalid_status', `Unknown status: ${status}`, 400);
    }
    conditions.push(eq(discoveries.status, status as 'draft'));
  }
  if (generationRequested === 'true') conditions.push(eq(discoveries.generationRequested, true));
  if (projectId) conditions.push(eq(discoveries.projectId, projectId));

  const rows = db
    .select()
    .from(discoveries)
    .where(and(...conditions))
    .orderBy(desc(discoveries.createdAt))
    .all();
  return NextResponse.json({ discoveries: rows });
}

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CreateBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const userId = currentUserId();
  const project = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, userId)))
    .get();
  if (!project) return apiError('project_not_found', 'Project not found', 404);

  const [row] = db
    .insert(discoveries)
    .values({
      userId,
      projectId: parsed.data.projectId,
      rawDump: parsed.data.rawDump,
      source: parsed.data.source ?? 'text',
    })
    .returning()
    .all();

  return NextResponse.json({ discovery: row }, { status: 201 });
}
