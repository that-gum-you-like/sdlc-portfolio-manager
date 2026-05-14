import { eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { portfolios } from '@/db/schema';
import { TopNav } from '@/components/top-nav';
import { NewProjectForm } from './new-project-form';

export const dynamic = 'force-dynamic';

interface Search {
  searchParams: Promise<{ portfolioId?: string }>;
}

export default async function NewProjectPage({ searchParams }: Search) {
  ensureInitialized();
  const params = await searchParams;
  const db = getDb();
  const userId = currentUserId();

  const portfolioRows = db
    .select({ id: portfolios.id, name: portfolios.name })
    .from(portfolios)
    .where(eq(portfolios.userId, userId))
    .all();

  return (
    <main>
      <TopNav active="portfolios" />
      <h1>New project</h1>
      <p className="muted">
        A project holds work items. Bind it to a target repo path (the absolute path on this
        machine) so library entries — rules, automations, validators — can publish into it.
      </p>
      <NewProjectForm portfolios={portfolioRows} initialPortfolioId={params.portfolioId ?? null} />
    </main>
  );
}
