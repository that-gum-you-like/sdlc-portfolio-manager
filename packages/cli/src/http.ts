interface ApiErrorShape {
  error: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function apiRequest<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | null }> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return { status: 204, data: null };
  }

  const parsed = (await readJson(res)) as T | ApiErrorShape | null;

  if (!res.ok) {
    const err = parsed as ApiErrorShape | null;
    throw new ApiError(
      res.status,
      err?.error ?? 'unknown_error',
      err?.message ?? `HTTP ${res.status}`,
      err?.details,
    );
  }

  return { status: res.status, data: (parsed as T) ?? null };
}
