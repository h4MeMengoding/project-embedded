// npm run device:create            (pakai DEVICE_ID dari web/.env.local)
// npm run device:create -- --id x   (ID lain)
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
const id = arg('id') ?? process.env.DEVICE_ID?.trim();
if (!id || !/^[a-z0-9-]{1,64}$/.test(id)) {
  console.error('Isi DEVICE_ID di web/.env.local atau pakai --id (huruf kecil, angka, tanda minus).');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi (web/.env.local)');

const token = randomBytes(32).toString('hex');
const db = createDb(url, { max: 1 });
const tokenHash = hashToken(token);
await db.insert(devices).values({ id, name: arg('name') ?? id, tokenHash })
  .onConflictDoUpdate({ target: devices.id, set: { tokenHash } });
console.log('Salin dua baris ini ke esp/include/config.h (ganti yang lama):\n');
console.log(`#define DEVICE_ID "${id}"`);
console.log(`#define DEVICE_TOKEN "${token}"\n`);
console.log('Token hanya ditampilkan sekali. Menjalankan perintah ini lagi membuat token baru (yang lama tidak berlaku).');
process.exit(0);
