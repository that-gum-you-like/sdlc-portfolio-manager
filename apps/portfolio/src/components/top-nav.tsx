import Link from 'next/link';

interface TopNavProps {
  active?:
    | 'home'
    | 'dashboard'
    | 'board'
    | 'backlog'
    | 'automations'
    | 'library'
    | 'discoveries'
    | 'inbox';
}

export function TopNav({ active }: TopNavProps) {
  return (
    <nav className="top-nav">
      <Link href="/" className={['brand', active === 'home' ? 'active' : ''].join(' ')}>
        sdlc-portfolio-manager
      </Link>
      <Link href="/dashboard" className={active === 'dashboard' ? 'active' : ''}>
        Dashboard
      </Link>
      <Link href="/board" className={active === 'board' ? 'active' : ''}>
        Board
      </Link>
      <Link href="/backlog" className={active === 'backlog' ? 'active' : ''}>
        Backlog
      </Link>
      <Link href="/discoveries" className={active === 'discoveries' ? 'active' : ''}>
        Discoveries
      </Link>
      <Link href="/automations" className={active === 'automations' ? 'active' : ''}>
        Automations
      </Link>
      <Link href="/library" className={active === 'library' ? 'active' : ''}>
        Library
      </Link>
      <Link href="/inbox" className={active === 'inbox' ? 'active' : ''}>
        Inbox
      </Link>
    </nav>
  );
}
