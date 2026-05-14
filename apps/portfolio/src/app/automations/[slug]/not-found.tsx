import Link from 'next/link';

import { TopNav } from '@/components/top-nav';

export default function NotFound() {
  return (
    <main>
      <TopNav active="library" />
      <h1>Automation not found</h1>
      <p className="muted">
        That automation slug doesn&apos;t exist. Try the{' '}
        <Link href="/automations">automations list</Link>.
      </p>
    </main>
  );
}
