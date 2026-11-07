import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

// Pemakaian: npm run db:set-env -w @ws/db -- dev|prod
const value = process.argv[2];
if (value !== 'dev' && value !== 'prod') throw new Error('argumen harus dev atau prod');
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local') });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi');
const sql = postgres(url, { max: 1 });
await sql`insert into app_config (key, value) values ('environment', ${value}) on conflict (key) do nothing`;
const [row] = await sql`select value from app_config where key = 'environment'`;
console.log('app_config.environment =', row.value);
await sql.end();
