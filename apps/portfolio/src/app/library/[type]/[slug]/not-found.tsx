import Link from 'next/link';

import { TopNav } from '@/components/top-nav';

export default function NotFound() {
  return (
    <main>
      <TopNav active="library" />
      <h1>Library entry not found</h1>
      <p className="muted">
        That entry doesn&apos;t exist. Try the{' '}
        <Link href="/library">library</Link>.
      </p>
    </main>
  );
}
