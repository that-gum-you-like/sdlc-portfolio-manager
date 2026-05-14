import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import { getDb, getRawDb } from '@/db';
import { discoveries, discoveryDrafts } from '@/db/schema';
import { generateDefaultDrafts } from '@/lib/discovery-default-generator';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

const GenerateBody = z.object({
  generator: z.string().min(1).max(120).default('default'),
});

const KNOWN_PERSONAS = new Set(['bill-crouse', 'judy', 'barbara', 'april']);

// POST /api/v1/discoveries/:id/generate
//
// MVP behaviour:
//  * generator="default" — run the built-in deterministic generator immediately
//    and return drafts synchronously. No LLM dependency.
//  * generator=<known persona slug> — mark the discovery `generating` and set
//    generation_requested=true so the Cursor Automation can pick it up.
//    (Personas are seeded via the agentic-sdlc-framework-port change; without
//    them, return 400 persona_not_seeded.)
//  * any other generator — same as named persona path (assume future plugin).
export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const parsed = await parseJson(request, GenerateBody);
  if (!parsed.ok) return parsed.response;

  const db = getDb();
  const raw = getRawDb();
  const userId = currentUserId();

  const discovery = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.id, id), eq(discoveries.userId, userId)))
    .get();
  if (!discovery) return apiError('not_found', 'Discovery not found', 404);

  const generator = parsed.data.generator ?? 'default';
  if (generator !== 'default') {
    if (!KNOWN_PERSONAS.has(generator)) {
      return apiError('generator_unknown', `Unknown generator: ${generator}`, 400);
    }
    // Persona generators run via Cursor Automation. We don't have the personas
    // seeded yet (that's the agentic-sdlc-framework-port change), so we surface
    // the contract without claiming to have run.
    return apiError(
      'persona_not_seeded',
      `Generator ${generator} requires the agentic-sdlc-framework-port change to seed its persona. Use generator: "default" for now.`,
      400,
    );
  }

  // Default: run the built-in generator synchronously.
  const generatedDrafts = generateDefaultDrafts(discovery.rawDump);

  const tx = raw.transaction(() => {
    const now = new Date().toISOString();
    db.update(discoveries)
      .set({ status: 'reviewing', generationRequested: false, updatedAt: now })
      .where(eq(discoveries.id, id))
      .run();

    const inserted: typeof discoveryDrafts.$inferSelect[] = [];
    // Map from generator's internal ids to inserted DB ids so parent links resolve.
    const idMap = new Map<string, string>();
    for (const d of generatedDrafts) {
      const parentDbId = d.parentDraftId ? idMap.get(d.parentDraftId) ?? null : null;
      const [row] = db
        .insert(discoveryDrafts)
        .values({
          userId,
          discoveryId: id,
          draftType: d.draftType,
          draftData: JSON.stringify(d.draftData),
          parentDraftId: parentDbId,
          relationshipDrafts: JSON.stringify(d.relationshipDrafts ?? []),
          generatedBy: 'default',
        })
        .returning()
        .all();
      if (row) {
        inserted.push(row);
        idMap.set(d.id, row.id);
      }
    }
    return inserted;
  });
  const inserted = tx();

  return NextResponse.json({ generated: inserted.length, drafts: inserted });
}
