import { and, eq, lt } from 'drizzle-orm';

import { getDb } from '@/db';
import { agentSessions } from '@/db/schema';
import { currentUserId } from './auth';

// How long without a heartbeat before we mark a session as crashed
const CRASH_THRESHOLD_MS = 10 * 60 * 1000; // 10 min

// Called lazily before reads — sweeps active sessions whose last heartbeat is
// older than the threshold and flips them to 'crashed'. No background timer
// needed; the next request triggers cleanup.
export function sweepStaleSessions(): number {
  const db = getDb();
  const userId = currentUserId();
  const threshold = new Date(Date.now() - CRASH_THRESHOLD_MS).toISOString();
  const stale = db
    .update(agentSessions)
    .set({ status: 'crashed', completedAt: new Date().toISOString() })
    .where(
      and(
        eq(agentSessions.userId, userId),
        eq(agentSessions.status, 'active'),
        lt(agentSessions.lastHeartbeatAt, threshold),
      ),
    )
    .returning()
    .all();
  return stale.length;
}

export function startSession(
  agentName: string,
  workItemId: string | null,
  projectId: string | null,
): { id: string } {
  const db = getDb();
  const userId = currentUserId();
  const [row] = db
    .insert(agentSessions)
    .values({
      userId,
      projectId,
      agentName,
      workItemId,
    })
    .returning()
    .all();
  if (!row) throw new Error('failed to create agent session');
  return { id: row.id };
}

export function heartbeat(sessionId: string, stateBlob?: Record<string, unknown>): boolean {
  const db = getDb();
  const userId = currentUserId();
  const set: Record<string, unknown> = {
    lastHeartbeatAt: new Date().toISOString(),
  };
  if (stateBlob !== undefined) set.stateBlob = JSON.stringify(stateBlob);
  const updated = db
    .update(agentSessions)
    .set(set)
    .where(
      and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.userId, userId),
        eq(agentSessions.status, 'active'),
      ),
    )
    .returning()
    .all();
  return updated.length > 0;
}

export function endSession(
  sessionId: string,
  status: 'completed' | 'cancelled' = 'completed',
): boolean {
  const db = getDb();
  const userId = currentUserId();
  const updated = db
    .update(agentSessions)
    .set({ status, completedAt: new Date().toISOString() })
    .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
    .returning()
    .all();
  return updated.length > 0;
}
