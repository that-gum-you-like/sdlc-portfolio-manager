import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { relationships } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const existing = db
    .select()
    .from(relationships)
    .where(and(eq(relationships.id, id), eq(relationships.userId, currentUserId())))
    .get();
  if (!existing) return apiError('not_found', 'Relationship not found', 404);
  db.delete(relationships).where(eq(relationships.id, id)).run();
  return new NextResponse(null, { status: 204 });
}
