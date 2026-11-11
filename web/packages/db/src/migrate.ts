import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, '../../../.env.local') });

// Transaction pooler (6543) tidak cocok untuk migrasi: DATABASE_MIGRATE_URL boleh menunjuk ke koneksi langsung/session (5432).
const url = process.env.DATABASE_MIGRATE_URL || process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi (web/.env.local)');
const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: resolve(here, '../migrations') });
await client.end();
console.log('migrasi selesai');
