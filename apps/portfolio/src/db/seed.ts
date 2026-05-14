import { eq } from 'drizzle-orm';
import { getDb } from './index.ts';
import { portfolios, projects } from './schema.ts';
import { currentUserId } from '../lib/auth.ts';

const DEFAULT_PORTFOLIO_NAME = 'personal';
const DEFAULT_PROJECT_SLUG = 'general';

export interface SeedResult {
  portfolioId: string;
  projectId: string;
  created: boolean;
}

export function seedDefaultPortfolioAndProject(dbPath?: string): SeedResult {
  const db = getDb(dbPath);
  const userId = currentUserId();

  const existingPortfolio = db
    .select()
    .from(portfolios)
    .where(eq(portfolios.name, DEFAULT_PORTFOLIO_NAME))
    .all()
    .find((p) => p.userId === userId);

  if (existingPortfolio) {
    const existingProject = db
      .select()
      .from(projects)
      .where(eq(projects.portfolioId, existingPortfolio.id))
      .all()
      .find((p) => p.slug === DEFAULT_PROJECT_SLUG);
    if (existingProject) {
      return { portfolioId: existingPortfolio.id, projectId: existingProject.id, created: false };
    }
    const [newProject] = db
      .insert(projects)
      .values({
        portfolioId: existingPortfolio.id,
        userId,
        name: 'General',
        slug: DEFAULT_PROJECT_SLUG,
        description: 'Default project for items not yet routed elsewhere.',
      })
      .returning()
      .all();
    if (!newProject) throw new Error('failed to create default project');
    return { portfolioId: existingPortfolio.id, projectId: newProject.id, created: true };
  }

  const [newPortfolio] = db
    .insert(portfolios)
    .values({
      userId,
      name: DEFAULT_PORTFOLIO_NAME,
      description: 'Default portfolio for personal work.',
    })
    .returning()
    .all();
  if (!newPortfolio) throw new Error('failed to create default portfolio');

  const [newProject] = db
    .insert(projects)
    .values({
      portfolioId: newPortfolio.id,
      userId,
      name: 'General',
      slug: DEFAULT_PROJECT_SLUG,
      description: 'Default project for items not yet routed elsewhere.',
    })
    .returning()
    .all();
  if (!newProject) throw new Error('failed to create default project');

  return { portfolioId: newPortfolio.id, projectId: newProject.id, created: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = seedDefaultPortfolioAndProject();
  console.warn(
    result.created
      ? `Seeded personal/general (portfolio=${result.portfolioId}, project=${result.projectId})`
      : `personal/general already present`,
  );
}
