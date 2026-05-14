import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import {
  LIBRARY_TYPES,
  findLibraryEntry,
  getTemplateForType,
  isSafeSlug,
  listLibraryEntries,
  slugify,
  validateContent,
  writeLibraryEntry,
  type LibraryEntryType,
} from '@/lib/library';

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

const CreateBody = z.object({
  type: z.enum(['rule', 'automation', 'validator', 'doc', 'guardrail']),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).optional(),
  content: z.string().min(1).max(500_000).optional(),
});

export async function POST(request: Request) {
  ensureInitialized();
  const parsed = await parseJson(request, CreateBody);
  if (!parsed.ok) return parsed.response;

  const type = parsed.data.type as LibraryEntryType;
  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  if (!isSafeSlug(slug)) {
    return apiError(
      'invalid_slug',
      'Slug must be kebab-case (a-z, 0-9, hyphens) and 1–64 chars',
      400,
    );
  }
  if (findLibraryEntry(type, slug)) {
    return apiError(
      'slug_taken',
      `An entry of type ${type} with slug ${slug} already exists`,
      409,
    );
  }

  const content = parsed.data.content ?? getTemplateForType(type, slug, parsed.data.name);
  const validation = validateContent(type, content);
  if (!validation.ok) {
    return apiError(validation.error ?? 'invalid_content', 'Content failed validation', 400, {
      details: validation.details,
    });
  }

  try {
    const result = writeLibraryEntry(type, slug, content);
    const entry = findLibraryEntry(type, slug);
    return NextResponse.json({ entry, ...result }, { status: 201 });
  } catch (err) {
    return apiError(
      'write_failed',
      err instanceof Error ? err.message : 'Failed to write entry',
      500,
    );
  }
}
