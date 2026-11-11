import { getMode, type AppMode, type Db } from '@ws/db';

// Dibaca tiap pesan perangkat (~1/dtk), jadi di-cache singkat. Perubahan mode dari proses ini langsung berlaku (invalidateMode).
const TTL_MS = 5000;
const g = globalThis as unknown as { __wsMode?: { v: AppMode; at: number } };

export async function getModeCached(db: Db): Promise<AppMode> {
  if (g.__wsMode && Date.now() - g.__wsMode.at < TTL_MS) return g.__wsMode.v;
  const v = await getMode(db);
  g.__wsMode = { v, at: Date.now() };
  return v;
}

export function invalidateMode(): void {
  g.__wsMode = undefined;
}
