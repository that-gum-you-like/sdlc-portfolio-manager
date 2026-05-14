import { TopNav } from '@/components/top-nav';
import { NewPortfolioForm } from './new-portfolio-form';

export const dynamic = 'force-dynamic';

export default async function NewPortfolioPage() {
  return (
    <main>
      <TopNav active="portfolios" />
      <h1>New portfolio</h1>
      <p className="muted">
        A portfolio groups related projects. Give it a name (e.g. "Personal", "Work", "Client X")
        and a short description. You can rename it later.
      </p>
      <NewPortfolioForm />
    </main>
  );
}
