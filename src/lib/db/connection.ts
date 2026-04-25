import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getEnv } from '@/config/env';
import * as schema from './schema';

declare global {
  var __docmindSqlClient: ReturnType<typeof postgres> | undefined;
}

const client =
  globalThis.__docmindSqlClient ??
  postgres(getEnv().DATABASE_URL);

if (process.env['NODE_ENV'] !== 'production') {
  globalThis.__docmindSqlClient = client;
}

export const db = drizzle({
  client,
  schema,
});

export type Database = typeof db;
