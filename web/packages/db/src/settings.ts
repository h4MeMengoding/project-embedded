import { eq } from 'drizzle-orm';
import type { Db } from './client';
import { appConfig } from './schema';

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const [r] = await db.select().from(appConfig).where(eq(appConfig.key, key));
  return r?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.insert(appConfig).values({ key, value }).onConflictDoUpdate({ target: appConfig.key, set: { value } });
}

/** Kode wilayah BMKG aktif: disetel dari dashboard (`app_config.bmkg_adm4`), cadangan env. */
export async function getActiveAdm4(db: Db, envFallback: string): Promise<string> {
  return (await getSetting(db, 'bmkg_adm4')) ?? envFallback;
}
