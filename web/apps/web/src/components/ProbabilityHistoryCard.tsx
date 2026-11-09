import { Card } from './Card';

export function ProbabilityHistoryCard({ points, configVersion, threshold = 50 }: { points: { t: number; p: number }[]; configVersion: string | null; threshold?: number }) {
  const W = 400, H = 180, L = 40;
  const t0 = points[0]?.t ?? 0;
  const t1 = points[points.length - 1]?.t ?? 1;
  const x = (t: number) => (t1 === t0 ? W - 6 : L + ((t - t0) / (t1 - t0)) * (W - L - 6));
  const y = (p: number) => H - 20 - (p / 100) * (H - 60);
  const d = points.map((q, i) => `${i ? 'L' : 'M'}${x(q.t).toFixed(1)} ${y(q.p).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <Card tone="dark" title="Riwayat peluang hujan" subtitle={`6 jam terakhir · config ${configVersion ?? 'v2'}`}>
      {points.length < 2 ? (
        <p style={{ marginTop: 26, opacity: 0.7 }}>Data tidak tersedia pada rentang ini</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginTop: 26 }} role="img" aria-label="Grafik peluang hujan 6 jam terakhir">
            <g stroke="rgba(255,255,255,.12)"><path d={`M${L} ${y(100)}H${W}M${L} ${y(0)}H${W}`} /></g>
            <path d={`M${L} ${y(threshold)}H${W}`} stroke="#ffd84a" strokeWidth="1.5" strokeDasharray="5 5" />
            <g fill="rgba(255,255,255,.7)" fontSize="11" fontWeight="600" textAnchor="end">
              <text x={L - 6} y={y(100) + 4}>100%</text>
              <text x={L - 6} y={y(threshold) + 4} fill="#ffd84a">{threshold}%</text>
              <text x={L - 6} y={y(0) + 4}>0%</text>
            </g>
            <path d={d} fill="none" stroke="#8fe39a" strokeWidth="3" strokeLinejoin="round" />
            {last && <circle cx={x(last.t)} cy={y(last.p)} r="6" fill="#fff" />}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.6, marginTop: 12 }}>
            <span>−6 jam · garis putus-putus: ambang {threshold}%</span><span>sekarang{last ? ` · ${Math.round(last.p)}%` : ''}</span>
          </div>
        </>
      )}
    </Card>
  );
}
