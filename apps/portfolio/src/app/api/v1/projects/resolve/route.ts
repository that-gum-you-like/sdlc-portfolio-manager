import { NextResponse } from 'next/server';
import { resolve } from 'node:path';

import { ensureInitialized } from '@/lib/init';
import { apiError } from '@/lib/api';
import { findProjectByRepoPath, findProjectBySlug } from '@/lib/project-context';

export const dynamic = 'force-dynamic';

// GET /api/v1/projects/resolve[?slug=<slug>&repoPath=<absPath>]
//
// Cursor agents (and the CLI) call this to map a Cursor workspace path or a
// PC_PROJECT slug to a concrete project. Returns the project + portfolio plus
// the URL the human can open to see the project in this UI.
export async function GET(request: Request) {
  ensureInitialized();
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const repoPath = url.searchParams.get('repoPath');

  if (!slug && !repoPath) {
    return apiError('slug_or_repo_required', 'Pass slug or repoPath', 400);
  }

  if (slug) {
    const ctx = findProjectBySlug(slug);
    if (!ctx) return apiError('not_found', `No project with slug ${slug}`, 404);
    return NextResponse.json({
      project: ctx.project,
      portfolio: ctx.portfolio,
      url: `/projects/${ctx.project.slug}`,
      matchedBy: 'slug',
    });
  }

  const absolute = resolve(repoPath!);
  const ctx = findProjectByRepoPath(absolute);
  if (!ctx) {
    return apiError(
      'not_found',
      `No project has target_repo_path = ${absolute}. Set it in Settings → Target repo path.`,
      404,
    );
  }
  return NextResponse.json({
    project: ctx.project,
    portfolio: ctx.portfolio,
    url: `/projects/${ctx.project.slug}`,
    matchedBy: 'repo_path',
  });
}
