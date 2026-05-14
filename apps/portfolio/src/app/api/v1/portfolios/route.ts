import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios } from '@/db/schema';

export const dynamic = 'force-dynamic';

const CreatePortfolioBody = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(1000).optional(),
});

export async function GET() {
  ensureInitialized();
  const db = getDb();
  const rows = db
    .select()
    .from(portfolios)
    .where(eq(portfolios.userId, currentUserId()))
    .all();
  return NextResponse.json({ portfolios: rows });
}

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CreatePortfolioBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const existing = db
    .select()
    .from(portfolios)
    .where(and(eq(portfolios.userId, currentUserId()), eq(portfolios.name, parsed.data.name)))
    .get();
  if (existing) {
    return apiError('portfolio_name_taken', 'A portfolio with that name already exists', 409);
  }

  const [row] = db
    .insert(portfolios)
    .values({
      userId: currentUserId(),
      name: parsed.data.name,
      description: parsed.data.description,
    })
    .returning()
    .all();
  return NextResponse.json({ portfolio: row }, { status: 201 });
}
