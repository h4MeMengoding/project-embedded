import { getActiveAdm4, recomputeEvaluation, type Db } from '@ws/db';
import { getDb } from './db';
import { getEnv } from './env';
import { runBmkgJob } from './bmkgJob';

export async function runEvaluationJob(db: Db): Promise<{ slots: number }> {
  const env = getEnv();
  return recomputeEvaluation(db, {
    deviceId: env.deviceId,
    adm4: await getActiveAdm4(db, env.adm4),
    from: env.evalStart ?? new Date(0),
    to: env.evalEnd ?? new Date(),
    slotMode: env.slotMode,
    minWetMinutes: env.rainMinWetMinutes,
    predictThreshold: env.predictThreshold,
  });
}

export async function runActiveBmkgJob(): Promise<number> {
  const db = getDb();
  return runBmkgJob(db, await getActiveAdm4(db, getEnv().adm4));
}

const safe = (name: string, fn: () => Promise<unknown>) =>
  fn().catch((e) => console.error(`[jobs] ${name} gagal:`, e instanceof Error ? e.message : e));

/**
 * Cron di dalam proses Next.js (web berjalan terus di VPS; asumsi satu instance).
 * Menit ke-5 tiap jam: BMKG. Menit ke-10: evaluasi. BMKG juga sekali saat start.
 */
export function startJobs(): void {
  const g = globalThis as unknown as { __wsJobs?: boolean };
  if (g.__wsJobs) return;
  g.__wsJobs = true;
  let last = -1;
  safe('bmkg', runActiveBmkgJob);
  setInterval(() => {
    const now = new Date();
    const key = Math.floor(now.getTime() / 60_000);
    if (key === last) return;
    last = key;
    if (now.getUTCMinutes() === 5) safe('bmkg', runActiveBmkgJob);
    if (now.getUTCMinutes() === 10) safe('evaluasi', () => runEvaluationJob(getDb()));
  }, 20_000).unref();
  console.log('[jobs] cron BMKG (menit 5) dan evaluasi (menit 10) aktif');
}
