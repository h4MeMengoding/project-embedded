import { getRainIntervals, getSeries } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { resolveRange } from '@/lib/range';
import { bucketSeries } from '@/lib/series';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { RangePicker } from '@/components/history/RangePicker';
import { SeriesChart } from '@/components/history/SeriesChart';
import { DownloadMenu } from '@/components/DownloadMenu';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Riwayat · Stasiun Cuaca' };

export default async function Riwayat({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  const range = resolveRange(sp, now);
  const [{ readings, predictions }, intervals] = await Promise.all([
    getSeries(db, env.deviceId, range.from, range.to),
    getRainIntervals(db, env.deviceId, range.from, range.to),
  ]);

  const f0 = range.from.getTime();
  const t0 = range.to.getTime();
  const main = bucketSeries(
    readings.map((r) => ({ t: r.ts.getTime(), tempDht: r.tempDht, tempBmp: r.tempBmp, hum: r.humDht, pressure: r.pressureHpa, lux: r.lux })),
    ['tempDht', 'tempBmp', 'hum', 'pressure', 'lux'], f0, t0,
  );
  const prob = bucketSeries(
    predictions.map((p) => ({ t: p.ts.getTime(), p: p.status === 'ok' ? p.probability : null, dp: p.status === 'ok' ? p.deltaP3h : null })),
    ['p', 'dp'], f0, t0,
  );
  const ri = intervals.map((i) => ({ start: i.start.getTime(), end: i.end.getTime() }));
    const q = `from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;

  const th = env.predictThreshold;
  const charts = [
    { title: 'Suhu', unit: '°C', data: main, series: [{ key: 'tempDht', label: 'DHT22', color: '#d1553b' }, { key: 'tempBmp', label: 'BMP280', color: '#2c7fb0' }] },
    { title: 'Kelembapan', unit: '%', data: main, series: [{ key: 'hum', label: 'RH', color: '#2c7fb0' }] },
    { title: 'Tekanan udara', unit: 'hPa', data: main, series: [{ key: 'pressure', label: 'Tekanan', color: '#6b4ba8' }], yStep: 0.5, tipDigits: 2 },
    { title: 'Perubahan tekanan 3 jam (ΔP3h)', unit: 'hPa · masukan fuzzy', data: prob, series: [{ key: 'dp', label: 'ΔP3h', color: '#6b4ba8' }], yStep: 0.5, include: [0], refLines: [{ y: 0, label: 'Stabil' }], tipDigits: 2 },
    { title: 'Intensitas cahaya', unit: 'lux', data: main, series: [{ key: 'lux', label: 'Lux', color: '#e0a21a' }], digits: 0 },
    { title: 'Peluang hujan (fuzzy)', unit: '%', data: prob, series: [{ key: 'p', label: 'Peluang', color: '#2fae4f' }], yDomain: [0, 100] as [number, number], yTicks: [0, 25, 50, 75, 100], refLines: [{ y: th, label: `Ambang ${th}%` }], digits: 0 },
  ];

  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="riwayat" />
          <div style={{ padding: '40px 0 120px', display: 'grid', gap: 24 }}>
            <div className="page-head">
              <div>
                <h1>Riwayat</h1>
                <p>Rekaman rata-rata per menit dari seluruh sensor dan peluang hujan fuzzy. Area berarsir menandai periode hujan terdeteksi.</p>
              </div>
              <div className="page-actions">
                <DownloadMenu query={q} items={[
                  { kind: 'readings', label: 'Data sensor per menit' },
                  { kind: 'predictions', label: 'Prediksi fuzzy' },
                  { kind: 'rain-events', label: 'Kejadian hujan' },
                  { kind: 'bmkg', label: 'Prakiraan BMKG' },
                ]} />
              </div>
            </div>
            <RangePicker preset={range.preset} from={range.from.toISOString()} to={range.to.toISOString()} />
          </div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          {charts.map((c) => (
            <SeriesChart key={c.title} {...c} rainIntervals={ri} from={f0} to={t0} />
          ))}
        </div>
        <div className="stamp" />
      </PageShell>
    </>
  );
}
