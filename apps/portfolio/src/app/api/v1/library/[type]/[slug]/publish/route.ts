import { NextResponse } from 'next/server';
import { copyFileSync, cpSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureInitialized } from '@/lib/init';
import { apiError, parseJson } from '@/lib/api';
import { currentUserId } from '@/lib/auth';
import {
  EXT_FOR_TYPE,
  LIBRARY_TYPES,
  TARGET_REPO_DIR,
  findLibraryEntry,
  type LibraryEntryType,
} from '@/lib/library';
import { getDb } from '@/db';
import { projects, publishHistory } from '@/db/schema';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ type: string; slug: string }>;
}

const PublishBody = z.object({
  projectId: z.string().uuid().optional(),
  targetRepoPath: z.string().min(1).max(500).optional(),
  overwrite: z.boolean().optional(),
});

// POST /api/v1/library/:type/:slug/publish
//
// Writes the library entry into the target repo's .cursor/<dir>/ folder.
// Resolve target path from either explicit targetRepoPath OR the project's
// settings.target_repo_path. Refuses to overwrite an existing file unless
// overwrite=true is passed.
export async function POST(request: Request, { params }: Params) {
  ensureInitialized();
  const { type, slug } = await params;
  if (!(LIBRARY_TYPES as string[]).includes(type)) {
    return apiError('invalid_type', `Unknown library type: ${type}`, 400);
  }
  const parsed = await parseJson(request, PublishBody);
  if (!parsed.ok) return parsed.response;

  const entry = findLibraryEntry(type as LibraryEntryType, slug);
  if (!entry) return apiError('not_found', `Entry ${type}/${slug} not found`, 404);

  const db = getDb();
  const userId = currentUserId();

  // Resolve target_repo_path
  let targetRoot = parsed.data.targetRepoPath ?? null;
  if (!targetRoot && parsed.data.projectId) {
    const project = db
      .select()
      .from(projects)
      .where(and(eq(projects.id, parsed.data.projectId), eq(projects.userId, userId)))
      .get();
    if (!project) return apiError('project_not_found', 'Project not found', 404);
    targetRoot = project.targetRepoPath;
  }

  if (!targetRoot) {
    return apiError(
      'target_path_required',
      'Either projectId (with target_repo_path set) or targetRepoPath must be provided',
      400,
    );
  }

  const absoluteRoot = resolve(targetRoot);
  if (!existsSync(absoluteRoot)) {
    return apiError('target_not_found', `Target repo path does not exist: ${absoluteRoot}`, 404);
  }
  if (!statSync(absoluteRoot).isDirectory()) {
    return apiError(
      'target_not_directory',
      `Target repo path is not a directory: ${absoluteRoot}`,
      400,
    );
  }

  const subdir = TARGET_REPO_DIR[entry.type];
  const writeDir = join(absoluteRoot, subdir);
  const ext = EXT_FOR_TYPE[entry.type];

  let writtenPath: string;
  let overwrote = false;

  try {
    if (entry.type === 'skill') {
      // Skills are folders — copy the SKILL.md (and any sibling assets) into <writeDir>/<slug>/
      const targetFolder = join(writeDir, entry.slug);
      const existedBefore = existsSync(targetFolder);
      if (existedBefore && !parsed.data.overwrite) {
        return apiError(
          'would_overwrite',
          `Skill folder already exists at ${targetFolder}. Pass overwrite=true to replace.`,
          409,
        );
      }
      const sourceFolder = dirname(entry.filePath);
      mkdirSync(writeDir, { recursive: true });
      cpSync(sourceFolder, targetFolder, { recursive: true, force: true });
      writtenPath = targetFolder;
      overwrote = existedBefore;
    } else {
      mkdirSync(writeDir, { recursive: true });
      writtenPath = join(writeDir, `${entry.slug}${ext}`);
      const existedBefore = existsSync(writtenPath);
      if (existedBefore && !parsed.data.overwrite) {
        return apiError(
          'would_overwrite',
          `File already exists at ${writtenPath}. Pass overwrite=true to replace.`,
          409,
        );
      }
      copyFileSync(entry.filePath, writtenPath);
      overwrote = existedBefore;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return apiError('write_failed', `Failed to write to target: ${message}`, 500);
  }

  const [row] = db
    .insert(publishHistory)
    .values({
      userId,
      projectId: parsed.data.projectId ?? null,
      entryType: entry.type,
      entrySlug: entry.slug,
      targetRepoPath: absoluteRoot,
      writtenPath,
      sourcePath: entry.filePath,
      overwrote,
      writtenBy: userId,
    })
    .returning()
    .all();

  return NextResponse.json({ publish: row, writtenPath, overwrote }, { status: 201 });
}
