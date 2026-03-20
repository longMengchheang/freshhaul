import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || value.trim().length === 0) {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }

  return value;
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  verbose: true,
  strict: true,
});
