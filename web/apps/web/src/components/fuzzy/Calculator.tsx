'use client';
import { useMemo, useState } from 'react';
import { FUZZY_CONFIG_V1 } from '@ws/core';
import { buildCalculatorModel } from '../../lib/calculatorModel';
import { AggregatedChart } from './AggregatedChart';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const f = (v: number, d = 3) => v.toFixed(d).replace(/\.?0+$/, '') || '0';

export function Calculator() {
  const [dp, setDp] = useState('-0.9');
  const [rh, setRh] = useState('87.5');
  const [temp, setTemp] = useState('');
  const [dpd, setDpd] = useState('3');
  const [minute, setMinute] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const model = useMemo(() => {
    try {
      return { ok: buildCalculatorModel({ deltaP3h: Number(dp), rh: Number(rh), temp: num(temp), dpd: num(dpd) }) };
    } catch (e) {
      return { err: (e as Error).message };
    }
  }, [dp, rh, temp, dpd]);

  async function loadMinute() {
    setMsg(null);
    if (!minute) return;
    const iso = new Date(`${minute}:00+07:00`).toISOString();
    const r = await fetch(`/api/fuzzy/minute?ts=${encodeURIComponent(iso)}`);
    const j = await r.json();
    if (!r.ok || j.status !== 'ok') return setMsg(j.error ?? 'Data menit itu belum cukup (butuh 3 jam data tekanan)');
    setDp(f(j.deltaP3h, 3)); setRh(f(j.rh, 2)); setTemp(f(j.temp, 2)); setDpd('');
  }

  const field = 'rounded-xl px-3 py-2 w-full border border-[var(--card2)] bg-[var(--page)] text-[var(--ink)]';
  return (
    <div className="card light">
      <h3>Kalkulator fuzzy Mamdani (config {FUZZY_CONFIG_V1.version})</h3>
      <div className="grid gap-4 mt-5 sm:grid-cols-2 lg:grid-cols-4">
        <label>ΔP3h (hPa)<input className={field} inputMode="decimal" value={dp} onChange={(e) => setDp(e.target.value)} /></label>
        <label>RH (%)<input className={field} inputMode="decimal" value={rh} onChange={(e) => setRh(e.target.value)} /></label>
        <label>Suhu (°C), opsional<input className={field} inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} /></label>
        <label>DPD (°C), bila suhu kosong<input className={field} inputMode="decimal" value={dpd} onChange={(e) => setDpd(e.target.value)} /></label>
      </div>
      <div className="flex flex-wrap items-end gap-3 mt-4">
        <label>Ambil dari data menit (WIB)<input type="datetime-local" className={field} value={minute} onChange={(e) => setMinute(e.target.value)} /></label>
        <button type="button" onClick={loadMinute} className="rounded-xl px-4 py-2 font-bold bg-[var(--ink)] text-[var(--page)]">Muat</button>
        {msg && <span role="alert">{msg}</span>}
      </div>

      {'err' in model ? (
        <p role="alert" style={{ marginTop: 20, fontWeight: 700 }}>{model.err}</p>
      ) : (
        <Steps m={model.ok} />
      )}
    </div>
  );
}

function Steps({ m }: { m: ReturnType<typeof buildCalculatorModel> }) {
  const r = m.result;
  const row = (label: string, o: Record<string, number>) => (
    <tr key={label}><th style={{ textAlign: 'left', padding: 6 }}>{label}</th>{Object.entries(o).map(([k, v]) => <td key={k} style={{ padding: 6 }}>{k}: <b>{f(v)}</b></td>)}</tr>
  );
  return (
    <div style={{ marginTop: 24, display: 'grid', gap: 24 }}>
      <section>
        <h4 style={{ fontWeight: 700 }}>1. Derajat keanggotaan (DPD = {f(m.dpd, 2)} °C)</h4>
        <div style={{ overflowX: 'auto' }}><table><tbody>{row('ΔP3h', r.memberships.dp)}{row('RH', r.memberships.rh)}{row('DPD', r.memberships.dpd)}</tbody></table></div>
      </section>
      <section>
        <h4 style={{ fontWeight: 700 }}>2. Aturan aktif (AND = min)</h4>
        {m.activeRules.length === 0 ? <p>Tidak ada aturan yang aktif; hasil 0.</p> : (
          <ul>{m.activeRules.map((a) => <li key={a.no}><b>{a.no}</b> ({f(a.strength, 4)}): {a.text}</li>)}</ul>
        )}
      </section>
      <section>
        <h4 style={{ fontWeight: 700 }}>3. Himpunan output terpotong (implikasi = min, agregasi = max)</h4>
        <p>Rendah {f(r.clipped.Rendah)} · Sedang {f(r.clipped.Sedang)} · Tinggi {f(r.clipped.Tinggi)}</p>
        <AggregatedChart x={r.aggregated.x} mu={r.aggregated.mu} centroid={r.probability} />
      </section>
      <section>
        <h4 style={{ fontWeight: 700 }}>4. Defuzzifikasi centroid dan kategori</h4>
        <p style={{ fontSize: 20 }}>Peluang hujan = <b>{f(r.probability, 2)}%</b> → kategori <b>{r.category}</b>{r.noRuleFired ? ' (tidak ada aturan aktif)' : ''}</p>
      </section>
    </div>
  );
}
