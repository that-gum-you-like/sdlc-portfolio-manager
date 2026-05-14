import { TopNav } from '@/components/top-nav';
import { NewLibraryEntryForm } from './new-library-entry-form';

export const dynamic = 'force-dynamic';

interface Search {
  searchParams: Promise<{ type?: string }>;
}

export default async function NewLibraryEntryPage({ searchParams }: Search) {
  const params = await searchParams;
  return (
    <main>
      <TopNav active="library" />
      <h1>New library entry</h1>
      <p className="muted">
        Pick a type, give it a name, and start editing. The new entry lives in{' '}
        <code>~/.sdlc-portfolio-manager/library/</code> and shows up immediately on the library
        list with origin=user.
      </p>
      <NewLibraryEntryForm initialType={params.type ?? 'rule'} />
    </main>
  );
}
