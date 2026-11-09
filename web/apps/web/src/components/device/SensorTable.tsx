import type { SensorFlags } from '@ws/core';
import type { ReadingRow } from '@ws/db';
import { Card } from '../Card';

function Spark({ values }: { values: (number | null)[] }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const lo = Math.min(...v), hi = Math.max(...v), W = 140, H = 36;
  const pts = values.map((x, i) => (x == null ? null : `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 4 - ((x - lo) / (hi - lo || 1)) * (H - 8)).toFixed(1)}`)).filter(Boolean).join(' ');
  return <svg width={W} height={H} role="img" aria-label="Grafik mini 24 jam"><polyline points={pts} fill="none" stroke="#2c7fb0" strokeWidth="2" /></svg>;
}

const statusText = (v: boolean | undefined) => (v == null ? '—' : v ? 'Terhubung' : 'Belum terhubung');

export function SensorTable({ latest, history, sensors }: { latest: ReadingRow | null; history: ReadingRow[]; sensors: SensorFlags | null }) {
  const step = Math.max(1, Math.floor(history.length / 60));
  const pick = (f: (r: ReadingRow) => number | null) => history.filter((_, i) => i % step === 0).map(f);
  const rows: [string, string, string, (number | null)[], boolean | undefined][] = [
    ['DHT22', 'Suhu & kelembapan', latest ? `${latest.tempDht ?? '—'} °C · ${latest.humDht ?? '—'} %` : '—', pick((r) => r.tempDht), sensors?.dht22],
    ['BMP280', 'Tekanan udara', latest?.pressureHpa != null ? `${latest.pressureHpa} hPa` : '—', pick((r) => r.pressureHpa), sensors?.bmp280],
    ['BH1750', 'Intensitas cahaya', latest?.lux != null ? `${latest.lux} lux` : '—', pick((r) => r.lux), sensors?.bh1750],
    ['FC-37', 'Sensor hujan', latest ? `AO ${latest.rainAnalogAvg ?? '—'} · basah ${latest.rainWetSeconds ?? '—'} dtk/mnt` : '—', pick((r) => r.rainAnalogAvg), sensors?.rain],
  ];
  return (
    <Card tone="light" title="Status sensor" subtitle="Nilai terakhir dan grafik mini 24 jam">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', minWidth: 520 }}>
          <tbody>
            {rows.map(([n, d, v, s, ok]) => (
              <tr key={n} style={{ borderTop: '1px solid var(--card2)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 700 }}>{n}<div style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>{d}</div></td>
                <td style={{ color: ok === false ? 'var(--muted)' : undefined }}>{statusText(ok)}</td>
                <td>{v}</td><td><Spark values={s} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
