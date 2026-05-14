import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { VALIDATION_GATES, type ValidationGate } from '@/lib/validators';
import { runAllGates, runGate } from '@/lib/validation-orchestrator';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const Body = z
  .object({
    gate: z.enum(VALIDATION_GATES).optional(),
  })
  .optional();

export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  let gate: ValidationGate | undefined;
  if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 0) {
    const parsed = await parseJson(request, Body);
    if (!parsed.ok) return parsed.response;
    gate = parsed.data?.gate;
  }

  try {
    if (gate) {
      const result = await runGate(id, gate);
      return NextResponse.json({ runs: [result] });
    }
    const results = await runAllGates(id);
    return NextResponse.json({ runs: results });
  } catch (err) {
    return apiError(
      'validate_failed',
      err instanceof Error ? err.message : 'Validation run failed',
      500,
    );
  }
}
