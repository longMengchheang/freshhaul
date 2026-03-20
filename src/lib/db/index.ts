import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getDatabaseUrl } from '@/lib/env';
import * as schema from './schema';

declare global {
  var __freshhaulSqlClient: ReturnType<typeof postgres> | undefined;
}

// Reuse a single postgres client in dev so hot reloads do not exhaust Supabase pooler connections.
const client =
  globalThis.__freshhaulSqlClient ??
  postgres(getDatabaseUrl(), {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__freshhaulSqlClient = client;
}

export const db = drizzle(client, { schema });
