import { config } from 'dotenv';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import {
  buildSamples, fitSemidiurnal, FUZZY_CONFIG_V2, FUZZY_CONFIG_V3, hourlyProfile, overallConfusion, rainOnsets, sampleBefore,
  type CalibRow,
} from '@ws/core';
import { createDb, readingsMinute } from '@ws/db';
import { renderCsv, renderMarkdown, type ReportData } from './report';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: resolve(root, '.env.local') });

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const date = (name: string, v: string | undefined): Date => {
  if (!v || v.trim() === '') throw new Error(`${name} belum diisi (env atau argumen --${name === 'CALIB_START' ? 'from' : 'to'}); isi periode kalibrasi dulu`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`${name} bukan tanggal ISO yang valid: "${v}"`);
  return d;
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi (web/.env.local)');
const from = date('CALIB_START', arg('from') ?? process.env.CALIB_START);
const to = date('CALIB_END', arg('to') ?? process.env.CALIB_END);
if (from >= to) throw new Error('CALIB_START harus lebih awal dari CALIB_END');
const deviceId = arg('device') ?? process.env.DEVICE_ID ?? 'stasiun-01';
const threshold = Number(process.env.PREDICT_THRESHOLD ?? 50);
const minWetMinutes = Number(process.env.RAIN_MIN_WET_MINUTES ?? 10);

const db = createDb(url, { max: 2 });
// 3 jam + jendela 10 menit sebelum awal diperlukan untuk menghitung ΔP3h; tidak ada data setelah CALIB_END
const readStart = new Date(from.getTime() - 195 * 60_000);
const rows: CalibRow[] = (await db.select().from(readingsMinute)
  .where(and(eq(readingsMinute.deviceId, deviceId), gte(readingsMinute.ts, readStart), lt(readingsMinute.ts, to)))
  .orderBy(asc(readingsMinute.ts)))
  .map((r) => ({ ts: r.ts, tempDht: r.tempDht, humDht: r.humDht, pressureHpa: r.pressureHpa, rainWetSeconds: r.rainWetSeconds }));

const configs = [FUZZY_CONFIG_V2, FUZZY_CONFIG_V3];
const versions = configs.map((c) => c.version);
const samples = buildSamples(rows, from, to, { configs, threshold, minWetMinutes });
const inPeriod = rows.filter((r) => r.ts >= from && r.ts < to);
const data: ReportData = {
  deviceId, from, to,
  expectedMinutes: Math.round((to.getTime() - from.getTime()) / 60_000),
  readingMinutes: inPeriod.length,
  samples,
  hours: hourlyProfile(samples, versions),
  confusion: overallConfusion(samples, versions),
  onsets: rainOnsets(inPeriod, minWetMinutes).map((onset) => ({ onset, before: sampleBefore(samples, onset.start) })),
  tide: fitSemidiurnal(inPeriod),
  configs, threshold, minWetMinutes,
};

const stamp = new Date().toISOString().slice(0, 10);
const out = resolve(arg('out') ?? resolve(root, 'reports', `kalibrasi-${deviceId}-${stamp}.md`));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, renderMarkdown(data));
writeFileSync(out.replace(/\.md$/, '.csv'), renderCsv(data));
console.log(`laporan: ${out}\ncsv: ${out.replace(/\.md$/, '.csv')}\nsampel: ${samples.length}, kejadian hujan: ${data.onsets.length}`);
process.exit(0);
