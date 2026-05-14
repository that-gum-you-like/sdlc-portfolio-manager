import Link from 'next/link';

import { TopNav } from '@/components/top-nav';

export default function NotFound() {
  return (
    <main>
      <TopNav active="discoveries" />
      <h1>Discovery not found</h1>
      <p className="muted">
        That discovery id doesn&apos;t exist. Try <Link href="/discoveries">discoveries</Link>.
      </p>
    </main>
  );
}
