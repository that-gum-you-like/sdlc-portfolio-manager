import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { parseJson } from '@/lib/api';
import { startSession, sweepStaleSessions } from '@/lib/agent-sessions';

export const dynamic = 'force-dynamic';

const StartBody = z.object({
  agent: z.string().min(1).max(120),
  workItemId: z.string().uuid().nullish(),
  projectId: z.string().uuid().nullish(),
});

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, StartBody);
  if (!parsed.ok) return parsed.response;
  sweepStaleSessions();
  const session = startSession(
    parsed.data.agent,
    parsed.data.workItemId ?? null,
    parsed.data.projectId ?? null,
  );
  return NextResponse.json({ session }, { status: 201 });
}
