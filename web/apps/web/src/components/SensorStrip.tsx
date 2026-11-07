import type { HomeState } from '../lib/homeState';

const nf = (d: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

export function SensorStrip({ state }: { state: HomeState }) {
  const s = state.kind === 'empty' ? null : state.sensors;
  const f = (v: number | null | undefined, d: number) => (v == null ? '—' : nf(d).format(v));
  const items = [
    ['Suhu', f(s?.temp, 1), '°C'],
    ['Kelembapan', f(s?.hum, 0), '%'],
    ['Tekanan', f(s?.pressure, 1), 'hPa'],
    ['Cahaya', f(s?.lux, 0), 'lux'],
    ['Titik embun', f(s?.dewPoint, 1), '°C'],
  ];
  return (
    <div className="stats">
      {items.map(([l, v, u]) => (
        <div className="stat" key={l}>
          <div className="l"><b />{l}</div>
          <div className="v">{v}{v !== '—' && <small>{u}</small>}</div>
        </div>
      ))}
    </div>
  );
}
