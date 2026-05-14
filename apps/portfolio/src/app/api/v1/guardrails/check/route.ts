import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { parseJson } from '@/lib/api';
import { checkGuardrails } from '@/lib/guardrails';

export const dynamic = 'force-dynamic';

const CheckBody = z.object({
  action: z.string().min(1).max(120),
  agent: z.string().min(1).max(120),
  workItemId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  context: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CheckBody);
  if (!parsed.ok) return parsed.response;

  const result = checkGuardrails(parsed.data);
  return NextResponse.json(result);
}
