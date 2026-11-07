'use client';
import Link from 'next/link';
import { useState } from 'react';

const PRESETS = [['6h', '6 jam'], ['24h', '24 jam'], ['7d', '7 hari']] as const;

export function RangePicker({ preset, basePath = '/riwayat', showPresets = true }: { preset: string; basePath?: string; showPresets?: boolean }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const wib = (v: string) => new Date(`${v}:00+07:00`).toISOString();
  const href = from && to ? `${basePath}?from=${encodeURIComponent(wib(from))}&to=${encodeURIComponent(wib(to))}` : null;
  const pill = (on: boolean) => `rounded-full px-4 py-2 font-semibold ${on ? 'bg-[var(--ink)] text-[var(--page)]' : 'bg-white/20 text-white'}`;
  return (
    <div className="flex flex-wrap items-end gap-3">
      {showPresets && PRESETS.map(([k, l]) => <Link key={k} href={`${basePath}?range=${k}`} className={pill(preset === k)}>{l}</Link>)}
      <label className="text-sm">Dari (WIB)<input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="block rounded-xl px-3 py-2 text-[#0f2a1b]" /></label>
      <label className="text-sm">Sampai (WIB)<input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="block rounded-xl px-3 py-2 text-[#0f2a1b]" /></label>
      {href ? <Link href={href} className={pill(preset === 'custom')}>Terapkan</Link> : <span className={pill(false) + ' opacity-60'}>Terapkan</span>}
    </div>
  );
}
