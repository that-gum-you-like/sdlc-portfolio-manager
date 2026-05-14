import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { endSession, heartbeat } from '@/lib/agent-sessions';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const HeartbeatBody = z
  .object({
    state: z.record(z.unknown()).optional(),
    complete: z.boolean().optional(),
    cancel: z.boolean().optional(),
  })
  .optional();

export async function PATCH(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, HeartbeatBody);
  if (!parsed.ok) return parsed.response;

  if (parsed.data?.complete) {
    if (!endSession(id, 'completed')) {
      return apiError('not_found', 'Session not found', 404);
    }
    return NextResponse.json({ ok: true, status: 'completed' });
  }
  if (parsed.data?.cancel) {
    if (!endSession(id, 'cancelled')) {
      return apiError('not_found', 'Session not found', 404);
    }
    return NextResponse.json({ ok: true, status: 'cancelled' });
  }
  const ok = heartbeat(id, parsed.data?.state);
  if (!ok) {
    return apiError('not_active', 'Session is not active or does not exist', 404);
  }
  return NextResponse.json({ ok: true });
}
