import { notFound } from 'next/navigation';

import { ensureInitialized } from '@/lib/init';
import { findProjectBySlug, listAllProjects } from '@/lib/project-context';
import { TopNav } from '@/components/top-nav';
import { ProjectContextBar } from '@/components/project-context-bar';
import { ProjectSettingsForm } from './project-settings-form';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ slug: string }>;
}

export default async function ProjectSettingsPage({ params }: Params) {
  ensureInitialized();
  const { slug } = await params;
  const ctx = findProjectBySlug(slug);
  if (!ctx) notFound();

  let settings: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(ctx.project.settingsJson) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      settings = parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }

  const allProjects = listAllProjects();

  return (
    <main>
      <TopNav active="portfolios" />
      <ProjectContextBar
        activeProjectSlug={ctx.project.slug}
        activeProjectName={ctx.project.name}
        activePortfolioName={ctx.portfolio.name}
        activePortfolioId={ctx.portfolio.id}
        allProjects={allProjects}
        subRoute="settings"
      />

      <h1>{ctx.project.name} — settings</h1>
      <ProjectSettingsForm
        slug={ctx.project.slug}
        initialName={ctx.project.name}
        initialDescription={ctx.project.description ?? ''}
        initialTargetRepoPath={ctx.project.targetRepoPath ?? ''}
        initialSettings={settings}
      />
    </main>
  );
}
