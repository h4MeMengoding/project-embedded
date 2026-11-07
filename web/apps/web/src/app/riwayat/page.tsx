import { getDeviceStatus, getRainIntervals, getSeries } from '@ws/db';
import { getDb } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { resolveRange } from '@/lib/range';
import { downsample } from '@/lib/downsample';
import { NavBar } from '@/components/NavBar';
import { HeroBand, PageShell } from '@/components/PageShell';
import { RangePicker } from '@/components/history/RangePicker';
import { SeriesChart } from '@/components/history/SeriesChart';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Riwayat · Stasiun Cuaca' };

export default async function Riwayat({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const env = getEnv();
  const db = getDb();
  const now = new Date();
  const range = resolveRange(sp, now);
  const [{ readings, predictions }, intervals, device] = await Promise.all([
    getSeries(db, env.deviceId, range.from, range.to),
    getRainIntervals(db, env.deviceId, range.from, range.to),
    getDeviceStatus(db, env.deviceId, env.offlineAfterSec, now),
  ]);

  const rows = readings.map((r) => ({ t: r.ts.getTime(), tempDht: r.tempDht, tempBmp: r.tempBmp, hum: r.humDht, pressure: r.pressureHpa, lux: r.lux }));
  const main = downsample(rows, ['tempDht', 'tempBmp', 'hum', 'pressure', 'lux']);
  const prob = downsample(predictions.map((p) => ({ t: p.ts.getTime(), p: p.status === 'ok' ? p.probability : null })), ['p']);
  const ri = intervals.map((i) => ({ start: i.start.getTime(), end: i.end.getTime() }));
  const span = range.to.getTime() - range.from.getTime();
  const q = `from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`;

  const charts = [
    { title: 'Suhu', unit: '°C', data: main, series: [{ key: 'tempDht', label: 'DHT22', color: '#d1553b' }, { key: 'tempBmp', label: 'BMP280', color: '#2c7fb0' }] },
    { title: 'Kelembapan', unit: '%', data: main, series: [{ key: 'hum', label: 'RH', color: '#2c7fb0' }] },
    { title: 'Tekanan', unit: 'hPa', data: main, series: [{ key: 'pressure', label: 'Tekanan', color: '#6b4ba8' }] },
    { title: 'Intensitas cahaya', unit: 'lux', data: main, series: [{ key: 'lux', label: 'Lux', color: '#e0a21a' }] },
    { title: 'Peluang hujan', unit: '%', data: prob, series: [{ key: 'p', label: 'Peluang', color: '#2fae4f' }] },
  ];

  return (
    <>
      <HeroBand>
        <PageShell>
          <NavBar active="riwayat" online={device.online} deviceId={env.deviceId} />
          <div style={{ padding: '40px 0 120px', display: 'grid', gap: 20 }}>
            <h1 style={{ fontSize: 40, fontWeight: 800 }}>Riwayat</h1>
            <RangePicker preset={range.preset} />
          </div>
        </PageShell>
      </HeroBand>
      <PageShell>
        <div className="grid gap-7" style={{ marginTop: -90, position: 'relative', zIndex: 3 }}>
          {charts.map((c) => (
            <SeriesChart key={c.title} title={c.title} unit={c.unit} data={c.data as never} series={c.series} rainIntervals={ri} spanMs={span} />
          ))}
          <div>
            <a className="rounded-full px-5 py-3 font-bold bg-[var(--ink)] text-[var(--page)] inline-block" href={`/api/export/readings?${q}`}>Unduh CSV</a>
          </div>
        </div>
        <div className="stamp">Semua waktu dalam WIB</div>
      </PageShell>
    </>
  );
}
