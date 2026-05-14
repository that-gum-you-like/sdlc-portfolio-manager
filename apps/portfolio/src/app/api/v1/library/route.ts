import { NextResponse } from 'next/server';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { LIBRARY_TYPES, listLibraryEntries, type LibraryEntryType } from '@/lib/library';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const typeParam = url.searchParams.get('type');
  if (typeParam && !(LIBRARY_TYPES as string[]).includes(typeParam)) {
    return apiError('invalid_type', `Unknown library type: ${typeParam}`, 400);
  }
  const entries = listLibraryEntries(typeParam ? (typeParam as LibraryEntryType) : undefined);
  return NextResponse.json({ entries });
}
