'use client';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { ACTIVE_FUZZY_CONFIG, isPredictRain } from '@ws/core';
import { buildCalculatorModel } from '../../lib/calculatorModel';
import { AggregatedChart } from './AggregatedChart';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
const f = (v: number, d = 3) => v.toFixed(d).replace(/\.?0+$/, '') || '0';
// tampilan: derajat keanggotaan dan kekuatan aturan 4 desimal, peluang 1 desimal (sama dengan pembulatan keputusan)
const id = (d: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const deg = (v: number) => id(4).format(v);
const pct1 = (v: number) => id(1).format(Math.round(v * 10) / 10);

const INPUT = 'h-11 w-full rounded-xl border border-[var(--card2)] bg-white pl-3 pr-14 text-[15px] text-[var(--ink)] outline-none focus:border-[#2c8640] focus:ring-2 focus:ring-[#2c8640]/25 disabled:bg-[var(--page)] disabled:text-[var(--muted)]';

function Field({ label, unit, hint, children }: { label: string; unit: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      <span className="relative block">
        {children}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted)]">{unit}</span>
      </span>
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Calculator({ threshold = 50 }: { threshold?: number }) {
  const [dp, setDp] = useState('-0.9');
  const [rh, setRh] = useState('87.5');
  const [temp, setTemp] = useState('');
  const [dpd, setDpd] = useState('3');
  const [minute, setMinute] = useState('');
  const [busy, setBusy] = useState(false);

  const model = useMemo(() => {
    try {
      return { ok: buildCalculatorModel({ deltaP3h: Number(dp), rh: Number(rh), temp: num(temp), dpd: num(dpd) }) };
    } catch (e) {
      return { err: (e as Error).message };
    }
  }, [dp, rh, temp, dpd]);

  async function loadMinute() {
    if (!minute) return;
    setBusy(true);
    try {
      const iso = new Date(`${minute}:00+07:00`).toISOString();
      const r = await fetch(`/api/fuzzy/minute?ts=${encodeURIComponent(iso)}`);
      const j = await r.json();
      if (!r.ok || j.status !== 'ok') return void toast.error(j.error ?? 'Data pada menit tersebut belum mencukupi (diperlukan data tekanan 3 jam).');
      setDp(f(j.deltaP3h, 3)); setRh(f(j.rh, 2)); setTemp(f(j.temp, 2)); setDpd('');
    } catch {
      toast.error('Data menit tidak dapat dimuat.');
    } finally {
      setBusy(false);
    }
  }

  const tempFilled = temp.trim() !== '';
  return (
    <section className="card light">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3>Kalkulator Fuzzy Mamdani</h3>
          <div className="sub">Hitung peluang hujan dari masukan manual atau dari data menit tertentu</div>
        </div>
        <span className="rounded-full bg-[var(--card2)] px-3 py-1 text-xs font-bold text-[var(--ink)]">Konfigurasi {ACTIVE_FUZZY_CONFIG.version}</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="grid content-start gap-5">
          <div className="grid gap-4 rounded-2xl bg-[var(--page)] p-5">
            <div className="text-sm font-bold">Masukan</div>
            <Field label="ΔP3h terkoreksi" unit="hPa" hint="Selisih tekanan 3 jam setelah koreksi variasi harian."><input className={INPUT} inputMode="decimal" value={dp} onChange={(e) => setDp(e.target.value)} /></Field>
            <Field label="Kelembapan (RH)" unit="%"><input className={INPUT} inputMode="decimal" value={rh} onChange={(e) => setRh(e.target.value)} /></Field>
            <Field label="Suhu" unit="°C" hint="Opsional. Jika diisi, DPD dihitung dari suhu dan RH.">
              <input className={INPUT} inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value)} />
            </Field>
            <Field label="DPD" unit="°C" hint={tempFilled ? 'Dihitung otomatis dari suhu dan RH.' : 'Dipakai apabila suhu dikosongkan.'}>
              <input className={INPUT} inputMode="decimal" value={tempFilled && model.ok ? f(model.ok.dpd, 2) : dpd} disabled={tempFilled} onChange={(e) => setDpd(e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 rounded-2xl bg-[var(--page)] p-5">
            <div className="text-sm font-bold">Muat dari data historis</div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Menit pengamatan</span>
              <input type="datetime-local" className={INPUT.replace('pr-14', 'pr-3')} value={minute} onChange={(e) => setMinute(e.target.value)} />
            </label>
            <button type="button" onClick={loadMinute} disabled={!minute || busy} className="btn btn-dark w-full">{busy ? 'Memuat…' : 'Muat data'}</button>
          </div>
        </aside>

        <div className="min-w-0">
          {model.err ? (
            <p role="alert" className="rounded-2xl bg-[#fbe9e4] p-5 font-semibold text-[#8a2f1d]">{model.err}</p>
          ) : (
            <Steps m={model.ok!} threshold={threshold} />
          )}
        </div>
      </div>
    </section>
  );
}

const CAT_COLOR = { Rendah: '#2fae4f', Sedang: '#e0a21a', Tinggi: '#d1553b' } as const;

function Bar({ label, value, color = '#2c7fb0' }: { label: string; value: number; color?: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr_64px] items-center gap-3 text-sm" style={{ opacity: value > 0 ? 1 : 0.5 }}>
      <span className="font-semibold">{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full bg-[var(--card2)]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%`, background: color }} /></span>
      <span className="text-right font-bold tabular-nums">{deg(value)}</span>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--card2)] p-5">
      <h4 className="flex items-center gap-3 font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--ink)] text-sm text-[var(--page)]">{n}</span>
        {title}
      </h4>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Steps({ m, threshold }: { m: ReturnType<typeof buildCalculatorModel>; threshold: number }) {
  const rain = isPredictRain(m.result.probability, threshold);
  const r = m.result;
  const groups: [string, string, Record<string, number>][] = [
    ['ΔP3h terkoreksi', 'hPa', r.memberships.dp],
    ['RH', '%', r.memberships.rh],
    ['DPD', `°C · nilai ${f(m.dpd, 2)}`, r.memberships.dpd],
  ];
  return (
    <div className="grid gap-4">
      <Step n={1} title="Fuzzifikasi: derajat keanggotaan">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {groups.map(([name, unit, o]) => (
            <div key={name} className="grid content-start gap-2.5">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{name} <span className="font-medium normal-case">({unit})</span></div>
              {Object.entries(o).map(([k, v]) => <Bar key={k} label={k} value={v} />)}
            </div>
          ))}
        </div>
      </Step>

      <Step n={2} title="Evaluasi aturan aktif (operator AND = min)">
        {m.activeRules.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Tidak ada aturan yang aktif sehingga peluang bernilai 0.</p>
        ) : (
          <ul className="grid gap-2.5">
            {m.activeRules.map((a) => (
              <li key={a.no} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-xl bg-[var(--page)] px-3 py-2.5 text-sm">
                <span className="rounded-lg bg-[var(--ink)] py-1 text-center text-xs font-bold text-[var(--page)]">{a.no}</span>
                <span>{a.text}</span>
                <span className="font-bold tabular-nums">{deg(a.strength)}</span>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step n={3} title="Implikasi (min) dan agregasi (max)">
        <div className="grid gap-2.5">
          {(['Rendah', 'Sedang', 'Tinggi'] as const).map((k) => <Bar key={k} label={k} value={r.clipped[k]} color={CAT_COLOR[k]} />)}
        </div>
        <div className="mt-4"><AggregatedChart x={r.aggregated.x} mu={r.aggregated.mu} centroid={r.probability} /></div>
      </Step>

      <section className="rounded-2xl p-6 text-[#eaf5e7]" style={{ background: 'linear-gradient(160deg, #12331f, #0a2113)' }}>
        <h4 className="flex items-center gap-3 font-bold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--accent)] text-sm text-[#2d2308]">4</span>
          Defuzzifikasi (centroid) dan keputusan biner
        </h4>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-5xl font-extrabold leading-none">{pct1(r.probability)}<span className="ml-1 text-2xl font-bold opacity-70">%</span></div>
            <div className="mt-2 text-sm opacity-70">Peluang hujan 3 jam ke depan</div>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-full px-4 py-1.5 text-sm font-bold text-[#0a2113]" style={{ background: CAT_COLOR[r.category as keyof typeof CAT_COLOR] ?? '#fff' }}>Kategori {r.category}</span>
            <div className="mt-2 text-lg font-extrabold" style={{ color: rain ? '#ffb48a' : '#8fe39a' }}>Prediksi: {rain ? 'Hujan' : 'Tidak hujan'} (&gt; {threshold}%)</div>
            {r.noRuleFired && <div className="mt-2 text-xs opacity-70">Tidak ada aturan aktif</div>}
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${r.probability}%` }} /></div>
      </section>
    </div>
  );
}
