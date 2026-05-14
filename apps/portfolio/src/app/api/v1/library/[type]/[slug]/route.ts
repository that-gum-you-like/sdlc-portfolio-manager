import { NextResponse } from 'next/server';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import {
  LIBRARY_TYPES,
  findLibraryEntry,
  type LibraryEntryType,
} from '@/lib/library';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ type: string; slug: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  ensureInitialized();
  const { type, slug } = await params;
  if (!(LIBRARY_TYPES as string[]).includes(type)) {
    return apiError('invalid_type', `Unknown library type: ${type}`, 400);
  }
  const entry = findLibraryEntry(type as LibraryEntryType, slug);
  if (!entry) return apiError('not_found', `Entry ${type}/${slug} not found`, 404);
  return NextResponse.json({ entry });
}
