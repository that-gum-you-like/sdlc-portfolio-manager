import { runMigrations } from '../db/migrate.ts';
import { seedDefaultPortfolioAndProject } from '../db/seed.ts';

let initialized = false;

export function ensureInitialized(): void {
  if (initialized) return;
  runMigrations();
  seedDefaultPortfolioAndProject();
  initialized = true;
}
