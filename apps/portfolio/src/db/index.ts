import Database, { type Database as DB } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.ts';
import { dataPath } from './paths.ts';

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _raw: DB | null = null;

export function getDb(path?: string): BetterSQLite3Database<typeof schema> {
  if (_db) return _db;
  const file = path ?? dataPath();
  mkdirSync(dirname(file), { recursive: true });
  _raw = new Database(file);
  _raw.pragma('journal_mode = WAL');
  _raw.pragma('foreign_keys = ON');
  _db = drizzle(_raw, { schema });
  return _db;
}

export function getRawDb(path?: string): DB {
  getDb(path);
  if (!_raw) throw new Error('database not initialized');
  return _raw;
}

export function closeDb(): void {
  if (_raw) {
    _raw.close();
    _raw = null;
    _db = null;
  }
}

export { schema };
