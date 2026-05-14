import { NextResponse } from 'next/server';
import { desc, eq, sql } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { automationRuns } from '@/db/schema';
import { listAutomationEntries } from '@/lib/automations';

export const dynamic = 'force-dynamic';

export async function GET() {
  ensureInitialized();
  const entries = listAutomationEntries();

  const db = getDb();
  const userId = currentUserId();
  const runs = db
    .select({
      automationSlug: automationRuns.automationSlug,
      count: sql<number>`count(*)`.as('count'),
      lastRun: sql<string>`max(${automationRuns.startedAt})`.as('lastRun'),
    })
    .from(automationRuns)
    .where(eq(automationRuns.userId, userId))
    .groupBy(automationRuns.automationSlug)
    .orderBy(desc(sql`max(${automationRuns.startedAt})`))
    .all();

  const stats = new Map<string, { count: number; lastRun: string | null }>();
  for (const r of runs) {
    if (r.automationSlug) stats.set(r.automationSlug, { count: r.count, lastRun: r.lastRun ?? null });
  }

  const enriched = entries.map((e) => ({
    ...e,
    runs: stats.get(e.slug) ?? { count: 0, lastRun: null },
  }));

  return NextResponse.json({ automations: enriched });
}
