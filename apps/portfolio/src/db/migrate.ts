import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRawDb } from './index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, 'migrations');

export function runMigrations(dbPath?: string): { applied: string[]; skipped: string[] } {
  const db = getRawDb(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((r) => (r as { name: string }).name),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedNow: string[] = [];
  const skipped: string[] = [];

  const insert = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      insert.run(file, new Date().toISOString());
    });
    tx();
    appliedNow.push(file);
  }

  return { applied: appliedNow, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runMigrations();
  if (result.applied.length === 0) {
    console.warn('No migrations applied. Already up to date.');
  } else {
    console.warn(`Applied ${result.applied.length} migration(s):`);
    for (const name of result.applied) console.warn(`  ${name}`);
  }
}
