import { ringGeometry } from '../lib/ringGeometry';

export function RingGauge({ percent, label = 'peluang hujan' }: { percent: number | null; label?: string }) {
  const g = ringGeometry(percent ?? 0);
  const aria = percent == null ? 'Peluang hujan belum tersedia' : `Peluang hujan ${Math.round(percent)} persen`;
  return (
    <svg viewBox="0 0 210 210" role="img" aria-label={aria} style={{ width: 'clamp(200px,17vw,260px)', height: 'auto', flex: 'none', filter: 'drop-shadow(0 8px 28px rgba(0,0,0,.18))' }}>
      <defs>
        <linearGradient id="ring-grad" x1="0" x2="1" y1="1" y2="0">
          <stop offset="0" stopColor="#8cff9a" />
          <stop offset=".55" stopColor="#ffd84a" />
          <stop offset="1" stopColor="#ff8a5a" />
        </linearGradient>
      </defs>
      <circle cx="105" cy="105" r="86" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="20" strokeLinecap="round" strokeDasharray={g.track} transform="rotate(135 105 105)" />
      {percent != null && percent > 0 && (
        <circle cx="105" cy="105" r="86" fill="none" stroke="url(#ring-grad)" strokeWidth="20" strokeLinecap="round" strokeDasharray={g.dash} transform="rotate(135 105 105)" />
      )}
      {percent != null && (
        <>
          <text x="105" y="118" textAnchor="middle" fill="#fff" fontSize="58" fontWeight="800">
            {Math.round(percent)}
            <tspan fontSize="24" fontWeight="700" dx="2">%</tspan>
          </text>
          <text x="105" y="142" textAnchor="middle" fill="rgba(255,255,255,.75)" fontSize="13" fontWeight="600">{label}</text>
        </>
      )}
    </svg>
  );
}
