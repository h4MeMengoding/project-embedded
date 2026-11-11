import { createHash } from 'node:crypto';
import { desc, eq, notInArray } from 'drizzle-orm';
import type { Db } from './client';
import { firmwareImages } from './schema';

const KEEP = 3; // image lama dibuang agar tabel tidak membengkak (±1,4 MB per baris)

const meta = { id: firmwareImages.id, version: firmwareImages.version, size: firmwareImages.size, md5: firmwareImages.md5, uploadedAt: firmwareImages.uploadedAt };
export type FirmwareMeta = { id: number; version: string; size: number; md5: string; uploadedAt: Date };

export async function saveFirmware(db: Db, version: string, data: Buffer): Promise<FirmwareMeta> {
  const [row] = await db.insert(firmwareImages)
    .values({ version, size: data.length, md5: createHash('md5').update(data).digest('hex'), data })
    .returning(meta);
  const keep = await db.select({ id: firmwareImages.id }).from(firmwareImages).orderBy(desc(firmwareImages.id)).limit(KEEP);
  await db.delete(firmwareImages).where(notInArray(firmwareImages.id, keep.map((k) => k.id)));
  return row;
}

export async function listFirmware(db: Db): Promise<FirmwareMeta[]> {
  return db.select(meta).from(firmwareImages).orderBy(desc(firmwareImages.id));
}

export async function getFirmware(db: Db, id: number): Promise<(FirmwareMeta & { data: Buffer }) | null> {
  const [row] = await db.select().from(firmwareImages).where(eq(firmwareImages.id, id));
  return row ?? null;
}

export async function deleteFirmware(db: Db, id: number): Promise<boolean> {
  const r = await db.delete(firmwareImages).where(eq(firmwareImages.id, id)).returning({ id: firmwareImages.id });
  return r.length > 0;
}
