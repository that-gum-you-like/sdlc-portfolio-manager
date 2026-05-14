import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { automationRuns } from '@/db/schema';
import { findAutomationEntry } from '@/lib/automations';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const entry = findAutomationEntry(slug);
  if (!entry) return apiError('not_found', `Automation ${slug} not found`, 404);

  const db = getDb();
  const userId = currentUserId();
  const runs = db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.userId, userId), eq(automationRuns.automationSlug, slug)))
    .orderBy(desc(automationRuns.startedAt))
    .limit(50)
    .all();

  return NextResponse.json({ automation: entry, runs });
}
