import { defineConfig } from 'drizzle-kit';
import { dataPath } from './src/db/paths.ts';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dataPath(),
  },
});
