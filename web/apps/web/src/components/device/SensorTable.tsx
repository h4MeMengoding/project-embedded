import type { ReadingRow } from '@ws/db';
import { Card } from '../Card';

function Spark({ values }: { values: (number | null)[] }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <span style={{ color: 'var(--muted)' }}>—</span>;
  const lo = Math.min(...v), hi = Math.max(...v), W = 140, H = 36;
  const pts = values.map((x, i) => (x == null ? null : `${((i / (values.length - 1)) * W).toFixed(1)},${(H - 4 - ((x - lo) / (hi - lo || 1)) * (H - 8)).toFixed(1)}`)).filter(Boolean).join(' ');
  return <svg width={W} height={H} role="img" aria-label="Grafik mini 24 jam"><polyline points={pts} fill="none" stroke="#2c7fb0" strokeWidth="2" /></svg>;
}

export function SensorTable({ latest, history }: { latest: ReadingRow | null; history: ReadingRow[] }) {
  const step = Math.max(1, Math.floor(history.length / 60));
  const pick = (f: (r: ReadingRow) => number | null) => history.filter((_, i) => i % step === 0).map(f);
  const rows: [string, string, string, (number | null)[]][] = [
    ['DHT22', 'Suhu & kelembapan', latest ? `${latest.tempDht ?? '—'} °C · ${latest.humDht ?? '—'} %` : '—', pick((r) => r.tempDht)],
    ['BMP280', 'Tekanan udara', latest?.pressureHpa != null ? `${latest.pressureHpa} hPa` : '—', pick((r) => r.pressureHpa)],
    ['BH1750', 'Intensitas cahaya', latest?.lux != null ? `${latest.lux} lux` : '—', pick((r) => r.lux)],
    ['FC-37', 'Sensor hujan', latest ? `AO ${latest.rainAnalogAvg ?? '—'} · basah ${latest.rainWetSeconds ?? '—'} dtk/mnt` : '—', pick((r) => r.rainAnalogAvg)],
  ];
  return (
    <Card tone="light" title="Status sensor" subtitle="Nilai terakhir dan grafik mini 24 jam">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse', minWidth: 520 }}>
          <tbody>
            {rows.map(([n, d, v, s]) => (
              <tr key={n} style={{ borderTop: '1px solid var(--card2)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 700 }}>{n}<div style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)' }}>{d}</div></td>
                <td>{v}</td><td><Spark values={s} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
