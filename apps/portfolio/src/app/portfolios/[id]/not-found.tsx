import Link from 'next/link';

import { TopNav } from '@/components/top-nav';

export default function NotFound() {
  return (
    <main>
      <TopNav active="portfolios" />
      <h1>Portfolio not found</h1>
      <p className="muted">
        That portfolio doesn&apos;t exist. <Link href="/portfolios">Browse all portfolios</Link>.
      </p>
    </main>
  );
}
