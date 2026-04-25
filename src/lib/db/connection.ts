import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

const getDatabaseUrl = (): string => {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
};

export const db = drizzle({
  connection: getDatabaseUrl(),
  schema,
});

export type Database = typeof db;
