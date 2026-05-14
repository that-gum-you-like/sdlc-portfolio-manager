import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { workItemLinks, workItems } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const LinkBody = z.object({
  provider: z
    .enum(['github', 'gitlab', 'bitbucket', 'local-git', 'other'])
    .optional(),
  kind: z.enum(['branch', 'commit', 'pr', 'mr', 'deploy', 'doc']).optional(),
  ref: z.string().min(1).max(200).optional(),
  url: z.string().min(1).max(2000),
  state: z.string().max(80).optional(),
});

function inferFromUrl(url: string): { provider: string; kind: string; ref: string } | null {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);
    if (host.includes('github.com')) {
      const i = parts.indexOf('pull');
      if (i >= 0 && parts[i + 1]) return { provider: 'github', kind: 'pr', ref: parts[i + 1]! };
      const ci = parts.indexOf('commit');
      if (ci >= 0 && parts[ci + 1]) return { provider: 'github', kind: 'commit', ref: parts[ci + 1]!.slice(0, 12) };
    }
    if (host.includes('gitlab.com')) {
      const i = parts.indexOf('merge_requests');
      if (i >= 0 && parts[i + 1]) return { provider: 'gitlab', kind: 'mr', ref: parts[i + 1]! };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();
  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  if (!item) return apiError('not_found', 'Work item not found', 404);
  const links = db
    .select()
    .from(workItemLinks)
    .where(and(eq(workItemLinks.workItemId, id), eq(workItemLinks.userId, userId)))
    .orderBy(desc(workItemLinks.createdAt))
    .all();
  return NextResponse.json({ links });
}

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, LinkBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const userId = currentUserId();
  const item = db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, id), eq(workItems.userId, userId)))
    .get();
  if (!item) return apiError('not_found', 'Work item not found', 404);

  // Auto-fill provider/kind/ref from URL if caller passed only url
  const inferred = inferFromUrl(parsed.data.url);
  const provider = parsed.data.provider ?? inferred?.provider ?? 'other';
  const kind = parsed.data.kind ?? inferred?.kind ?? 'doc';
  const ref = parsed.data.ref ?? inferred?.ref ?? parsed.data.url;

  const [link] = db
    .insert(workItemLinks)
    .values({
      userId,
      projectId: item.projectId,
      workItemId: item.id,
      provider: provider as 'github',
      kind: kind as 'pr',
      ref,
      url: parsed.data.url,
      state: parsed.data.state ?? null,
      createdBy: userId,
    })
    .returning()
    .all();

  return NextResponse.json({ link }, { status: 201 });
}
