'use client';

import Link from 'next/link';
import { useState } from 'react';

interface ProjectOption {
  id: string;
  name: string;
  slug: string;
  portfolioName: string;
}

interface Props {
  activeProjectSlug: string;
  activeProjectName: string;
  activePortfolioName: string;
  activePortfolioId: string;
  allProjects: ProjectOption[];
  subRoute?: 'board' | 'backlog' | 'dashboard' | 'settings' | 'home';
}

const SUB_LABEL: Record<string, string> = {
  home: 'Overview',
  board: 'Board',
  backlog: 'Backlog',
  dashboard: 'Dashboard',
  settings: 'Settings',
};

export function ProjectContextBar({
  activeProjectSlug,
  activeProjectName,
  activePortfolioName,
  activePortfolioId,
  allProjects,
  subRoute = 'home',
}: Props) {
  const [switcherOpen, setSwitcherOpen] = useState(false);

  return (
    <div className="project-context-bar">
      <div className="project-breadcrumb">
        <Link href="/portfolios">Portfolios</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/portfolios/${activePortfolioId}`}>{activePortfolioName}</Link>
        <span aria-hidden="true">›</span>
        <button
          type="button"
          className="project-switcher-trigger"
          onClick={() => setSwitcherOpen((v) => !v)}
          aria-expanded={switcherOpen}
        >
          <strong>{activeProjectName}</strong>
          <span style={{ marginLeft: 4, fontSize: 10 }}>▾</span>
        </button>
        {switcherOpen ? (
          <ul className="project-switcher-menu" role="menu">
            <li className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 12px' }}>
              Switch project
            </li>
            {allProjects.map((p) => (
              <li key={p.id} role="menuitem">
                <Link
                  href={`/projects/${p.slug}${subRoute === 'home' ? '' : '/' + subRoute}`}
                  className={p.slug === activeProjectSlug ? 'active' : ''}
                  onClick={() => setSwitcherOpen(false)}
                >
                  <span>{p.name}</span>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {p.portfolioName}
                  </span>
                </Link>
              </li>
            ))}
            <li role="menuitem" className="project-switcher-create">
              <Link href="/projects/new" onClick={() => setSwitcherOpen(false)}>
                + New project
              </Link>
            </li>
          </ul>
        ) : null}
      </div>

      <nav className="project-tabs" aria-label="Project sub-navigation">
        <Link
          href={`/projects/${activeProjectSlug}`}
          className={subRoute === 'home' ? 'active' : ''}
        >
          {SUB_LABEL.home}
        </Link>
        <Link
          href={`/projects/${activeProjectSlug}/board`}
          className={subRoute === 'board' ? 'active' : ''}
        >
          {SUB_LABEL.board}
        </Link>
        <Link
          href={`/projects/${activeProjectSlug}/backlog`}
          className={subRoute === 'backlog' ? 'active' : ''}
        >
          {SUB_LABEL.backlog}
        </Link>
        <Link
          href={`/projects/${activeProjectSlug}/dashboard`}
          className={subRoute === 'dashboard' ? 'active' : ''}
        >
          {SUB_LABEL.dashboard}
        </Link>
        <Link
          href={`/projects/${activeProjectSlug}/settings`}
          className={subRoute === 'settings' ? 'active' : ''}
        >
          {SUB_LABEL.settings}
        </Link>
      </nav>
    </div>
  );
}
