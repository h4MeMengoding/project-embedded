import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb } from '../src/client';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local') });

export const HAS_DB = !!process.env.DATABASE_URL;
if (!HAS_DB) console.warn('[db tests] DATABASE_URL tidak ada: tes database dilewati');

export const testDb = () => createDb(process.env.DATABASE_URL!, { max: 2 });
