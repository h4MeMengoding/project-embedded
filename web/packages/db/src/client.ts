import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

/** prepare:false agar cocok dengan transaction pooler Supabase (6543). */
export function createDb(url: string, opts: { max?: number } = {}): Db {
  const client = postgres(url, { prepare: false, max: opts.max ?? 5 });
  return drizzle(client, { schema });
}
