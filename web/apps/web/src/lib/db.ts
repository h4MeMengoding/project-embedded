import { createDb, type Db } from '@ws/db';

const g = globalThis as unknown as { __wsDb?: Db };

/** Singleton; max kecil karena runtime serverless/pooler. */
export function getDb(): Db {
  if (!g.__wsDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL belum diisi');
    g.__wsDb = createDb(url, { max: 3 });
  }
  return g.__wsDb;
}
