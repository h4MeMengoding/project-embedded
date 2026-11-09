import type { HomeState } from '../lib/homeState';

const nf = (d: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

export function SensorStrip({ state }: { state: HomeState }) {
  const s = state.kind === 'empty' ? null : state.sensors;
  const f = (v: number | null | undefined, d: number) => (v == null ? '—' : nf(d).format(v));
  const dp = s?.deltaP3h;
  const trend = dp == null ? 'Tren 3 jam: menunggu data' : `${Math.abs(dp) < 0.05 ? '▬' : dp > 0 ? '▲' : '▼'} ${nf(1).format(Math.abs(dp))} hPa / 3 jam`;
  const items: [string, string, string, string?][] = [
    ['Suhu', f(s?.temp, 1), '°C'],
    ['Kelembapan', f(s?.hum, 0), '%'],
    ['Tekanan', f(s?.pressure, 1), 'hPa', trend],
    ['Cahaya', f(s?.lux, 0), 'lux'],
    ['Titik embun', f(s?.dewPoint, 1), '°C'],
  ];
  const stale = state.kind === 'offline';
  return (
    <>
      <div className={`stats${stale ? ' stale' : ''}`} data-aos="fade-up">
        {items.map(([l, v, u, sub]) => (
          <div className="stat" key={l}>
            <div className="l"><b />{l}</div>
            <div className="v">{v}{v !== '—' && <small>{u}</small>}</div>
            {sub && <div className="trend">{sub}</div>}
          </div>
        ))}
      </div>
    </>
  );
}
