import Link from 'next/link';

import { TopNav } from '@/components/top-nav';

export default function NotFound() {
  return (
    <main>
      <TopNav />
      <h1>Item not found</h1>
      <p className="muted">
        That work item id doesn&apos;t exist or you don&apos;t have access to it. Try the{' '}
        <Link href="/board">board</Link>.
      </p>
    </main>
  );
}
