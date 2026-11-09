'use client';
import Link from 'next/link';
import { useState } from 'react';

const PRESETS = [['6h', '6 jam'], ['24h', '24 jam'], ['7d', '7 hari']] as const;

// ISO UTC -> "YYYY-MM-DDTHH:mm" dalam WIB untuk nilai awal input
const toWibInput = (iso?: string) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 16) : '');

type Props = { preset: string; basePath?: string; showPresets?: boolean; from?: string; to?: string; summary?: string; resetHref?: string; resetLabel?: string };

export function RangePicker({ preset, basePath = '/riwayat', showPresets = true, from: f0, to: t0, summary, resetHref, resetLabel = 'Atur ulang' }: Props) {
  const [from, setFrom] = useState(toWibInput(f0));
  const [to, setTo] = useState(toWibInput(t0));
  const wib = (v: string) => new Date(`${v}:00+07:00`).toISOString();
  const valid = Boolean(from && to && from < to);
  const href = valid ? `${basePath}?from=${encodeURIComponent(wib(from))}&to=${encodeURIComponent(wib(to))}` : null;
  return (
    <div className="filter" data-aos="fade-up">
      {showPresets && (
        <>
          <div>
            <span className="filter-label">Rentang cepat</span>
            <div className="seg">
              {PRESETS.map(([k, l]) => <Link key={k} href={`${basePath}?range=${k}`} className={preset === k ? 'on' : ''}>{l}</Link>)}
            </div>
          </div>
          <div className="sep-v" />
        </>
      )}
      <div>
        <label className="filter-label" htmlFor="rp-from">Dari (WIB)</label>
        <input id="rp-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="filter-label" htmlFor="rp-to">Sampai (WIB)</label>
        <input id="rp-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {summary && <div style={{ alignSelf: 'center', fontSize: 13, fontWeight: 700, color: '#587062' }}>Periode: <span style={{ color: '#0f2a1b' }}>{summary}</span></div>}
      {href ? <Link href={href} className="btn btn-dark">Terapkan</Link> : <span className="btn btn-dark" aria-disabled="true">Terapkan</span>}
      {resetHref && <Link href={resetHref} style={{ fontSize: 14, fontWeight: 700, color: '#2c8640', alignSelf: 'center' }}>{resetLabel}</Link>}
      {from && to && from >= to && <span style={{ fontSize: 13, color: '#b3402a', fontWeight: 600 }}>Waktu awal harus sebelum waktu akhir.</span>}
    </div>
  );
}
