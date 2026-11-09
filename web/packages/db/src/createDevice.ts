// npm run device:create -- --id stasiun-01 [--name "Stasiun Pakintelan"]
// Membuat (atau mengganti token) perangkat dan mencetak token SEKALI. Hanya hash yang disimpan.
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createDb } from './client';
import { devices } from './schema';
import { hashToken } from './token';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env.local') });

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const id = arg('id');
if (!id || !/^[a-z0-9-]{1,64}$/.test(id)) {
  console.error('Pakai: npm run device:create -- --id stasiun-01 (huruf kecil, angka, tanda minus)');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi (web/.env.local)');

const token = randomBytes(32).toString('hex');
const db = createDb(url, { max: 1 });
const tokenHash = hashToken(token);
await db.insert(devices).values({ id, name: arg('name') ?? id, tokenHash })
  .onConflictDoUpdate({ target: devices.id, set: { tokenHash } });
console.log(`Perangkat: ${id}`);
console.log(`Token    : ${token}`);
console.log('Salin token ke esp/include/config.h (DEVICE_TOKEN). Token ini tidak bisa ditampilkan lagi;');
console.log('menjalankan perintah ini lagi membuat token baru dan token lama tidak berlaku.');
process.exit(0);
