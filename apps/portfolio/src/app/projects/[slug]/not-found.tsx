import Link from 'next/link';

import { TopNav } from '@/components/top-nav';

export default function NotFound() {
  return (
    <main>
      <TopNav active="portfolios" />
      <h1>Project not found</h1>
      <p className="muted">
        That project slug doesn&apos;t exist (or it&apos;s in a portfolio you can&apos;t see).{' '}
        <Link href="/portfolios">Browse portfolios</Link> or{' '}
        <Link href="/projects/new">create a project</Link>.
      </p>
    </main>
  );
}
