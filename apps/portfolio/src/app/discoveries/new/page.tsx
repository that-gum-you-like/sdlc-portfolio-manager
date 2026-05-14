import { eq } from 'drizzle-orm';

import { ensureInitialized } from '@/lib/init';
import { currentUserId } from '@/lib/auth';
import { getDb } from '@/db';
import { projects } from '@/db/schema';
import { TopNav } from '@/components/top-nav';
import { NewDiscoveryForm } from './new-discovery-form';

export const dynamic = 'force-dynamic';

export default async function NewDiscoveryPage() {
  ensureInitialized();
  const db = getDb();
  const userId = currentUserId();
  const projectRows = db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.userId, userId))
    .all();

  return (
    <main>
      <TopNav active="discoveries" />
      <h1>New discovery</h1>
      <p className="muted">
        Paste a meeting transcript, dictation, or just write what&apos;s on your mind. The default
        generator turns the dump into an epic plus draft user stories with acceptance criteria —
        no LLM dependency required for the MVP path.
      </p>
      <NewDiscoveryForm projects={projectRows} />
    </main>
  );
}
