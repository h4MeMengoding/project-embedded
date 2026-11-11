import { eq } from 'drizzle-orm';
import type { Db } from './client';
import { appConfig, bmkgForecasts, evaluationSlots, fuzzyPredictions, rainEvents, readingsMinute } from './schema';

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

export type AppMode = 'dev' | 'prod';

/** Mode operasi (`app_config.mode`). Dev: data tidak disimpan. Bukan `app_config.environment` (penanda proyek DB untuk seed). Default prod. */
export async function getMode(db: Db): Promise<AppMode> {
  return (await getSetting(db, 'mode')) === 'dev' ? 'dev' : 'prod';
}

export const setMode = (db: Db, mode: AppMode) => setSetting(db, 'mode', mode);

/** Hapus semua data pengukuran dan hasil olahannya. Perangkat/token, wilayah, firmware, dan pengaturan tetap. */
export async function resetMeasurements(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    for (const t of [evaluationSlots, fuzzyPredictions, readingsMinute, rainEvents, bmkgForecasts]) await tx.delete(t);
  });
}
