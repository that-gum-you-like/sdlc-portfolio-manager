import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { discoveries, discoveryDrafts, projects } from '@/db/schema';
import { TopNav } from '@/components/top-nav';
import { DiscoveryReview } from './discovery-review';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export default async function DiscoveryPage({ params }: Params) {
  ensureInitialized();
  const { id } = await params;
  const db = getDb();
  const userId = currentUserId();

  const discovery = db
    .select()
    .from(discoveries)
    .where(and(eq(discoveries.id, id), eq(discoveries.userId, userId)))
    .get();
  if (!discovery) notFound();

  const project = db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, discovery.projectId))
    .get();

  const drafts = db
    .select()
    .from(discoveryDrafts)
    .where(and(eq(discoveryDrafts.discoveryId, id), eq(discoveryDrafts.userId, userId)))
    .orderBy(asc(discoveryDrafts.createdAt))
    .all();

  return (
    <main>
      <TopNav active="discoveries" />
      <nav className="muted" aria-label="Breadcrumb" style={{ fontSize: 13, marginBottom: 8 }}>
        <Link href="/discoveries">Discoveries</Link>
        {project ? <> › <span>{project.name}</span></> : null}
      </nav>
      <h1>Discovery</h1>

      <DiscoveryReview
        discoveryId={discovery.id}
        initialStatus={discovery.status}
        initialDump={discovery.rawDump}
        initialDrafts={drafts.map((d) => ({
          id: d.id,
          draftType: d.draftType,
          status: d.status,
          draftData: d.draftData,
          parentDraftId: d.parentDraftId,
          resultingWorkItemId: d.resultingWorkItemId,
          generatedBy: d.generatedBy,
        }))}
      />
    </main>
  );
}
