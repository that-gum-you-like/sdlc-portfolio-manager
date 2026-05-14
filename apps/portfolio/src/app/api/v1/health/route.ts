import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { getDb } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  ensureInitialized();
  const db = getDb();
  const result = db.get(sql`SELECT 1 as ok`) as { ok: number } | undefined;
  return NextResponse.json({
    ok: result?.ok === 1,
    version: '0.0.0',
    db: 'sqlite',
  });
}
