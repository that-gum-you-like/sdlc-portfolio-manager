import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import {
  LIBRARY_TYPES,
  deleteUserLibraryEntry,
  findLibraryEntry,
  isSafeSlug,
  readRawContent,
  validateContent,
  writeLibraryEntry,
  type LibraryEntryType,
} from '@/lib/library';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ type: string; slug: string }>;
}

function assertType(type: string): LibraryEntryType | null {
  return (LIBRARY_TYPES as string[]).includes(type) ? (type as LibraryEntryType) : null;
}

export async function GET(request: Request, { params }: Params) {
  ensureInitialized();
  const { type, slug } = await params;
  const t = assertType(type);
  if (!t) return apiError('invalid_type', `Unknown library type: ${type}`, 400);
  const entry = findLibraryEntry(t, slug);
  if (!entry) return apiError('not_found', `Entry ${type}/${slug} not found`, 404);

  const url = new URL(request.url);
  const wantRaw = url.searchParams.get('raw') === 'true';
  let raw: string | undefined;
  if (wantRaw) {
    try {
      raw = readRawContent(entry.filePath);
    } catch (err) {
      return apiError(
        'read_failed',
        err instanceof Error ? err.message : 'Failed to read source file',
        500,
      );
    }
  }
  return NextResponse.json({ entry, raw });
}

const PutBody = z.object({
  content: z.string().min(1).max(500_000),
});

export async function PUT(request: Request, { params }: Params) {
  ensureInitialized();
  const { type, slug } = await params;
  const t = assertType(type);
  if (!t) return apiError('invalid_type', `Unknown library type: ${type}`, 400);
  if (t === 'skill') {
    return apiError(
      'skill_editor_unsupported',
      'Skill folder editing is not supported in this pass — edit the SKILL.md directly on disk',
      400,
    );
  }
  if (!isSafeSlug(slug)) {
    return apiError(
      'invalid_slug',
      'Slug must be kebab-case (a-z, 0-9, hyphens) and 1–64 chars',
      400,
    );
  }
  const parsed = await parseJson(request, PutBody);
  if (!parsed.ok) return parsed.response;

  const validation = validateContent(t, parsed.data.content);
  if (!validation.ok) {
    return apiError(validation.error ?? 'invalid_content', 'Content failed validation', 400, {
      details: validation.details,
    });
  }

  try {
    const result = writeLibraryEntry(t, slug, parsed.data.content);
    const entry = findLibraryEntry(t, slug);
    return NextResponse.json({ entry, ...result }, { status: result.created ? 201 : 200 });
  } catch (err) {
    return apiError(
      'write_failed',
      err instanceof Error ? err.message : 'Failed to write entry',
      500,
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  ensureInitialized();
  const { type, slug } = await params;
  const t = assertType(type);
  if (!t) return apiError('invalid_type', `Unknown library type: ${type}`, 400);
  if (t === 'skill') {
    return apiError('skill_editor_unsupported', 'Skill editing not supported in this pass', 400);
  }
  try {
    const result = deleteUserLibraryEntry(t, slug);
    if (!result.deleted) {
      return apiError(
        'not_user_owned',
        'No user-dir copy exists. Seeded entries cannot be deleted — they are read-only on disk.',
        404,
      );
    }
    // After deletion, the seed (if any) becomes the canonical version again
    const entry = findLibraryEntry(t, slug);
    return NextResponse.json({ ...result, entry });
  } catch (err) {
    return apiError(
      'delete_failed',
      err instanceof Error ? err.message : 'Failed to delete entry',
      500,
    );
  }
}
