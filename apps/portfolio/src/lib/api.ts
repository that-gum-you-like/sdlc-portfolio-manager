import { NextResponse } from 'next/server';
import { ZodError, type ZodSchema } from 'zod';

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiError> {
  const body: ApiError = { error: code, message };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export async function parseJson<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<ApiError> }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: apiError('invalid_json', 'Request body must be valid JSON', 400),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: apiError('validation_error', 'Request body failed validation', 400, {
        issues: (result.error as ZodError).issues,
      }),
    };
  }
  return { ok: true, data: result.data };
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
