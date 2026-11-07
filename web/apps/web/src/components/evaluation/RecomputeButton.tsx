'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RecomputeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/evaluation/recompute', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) setMsg(`Terlalu sering. Coba lagi dalam ${j.retryAfterSec ?? r.headers.get('Retry-After')} detik.`);
      else if (!r.ok) setMsg(j.error ?? 'Gagal menghitung ulang.');
      else {
        setMsg(`Selesai: ${j.slots} slot dihitung ulang.`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={run} className="rounded-full px-5 py-3 font-bold bg-[var(--accent)] text-[#2d2308]">{busy ? 'Menghitung…' : 'Hitung ulang evaluasi'}</button>
      {msg && <span role="status">{msg}</span>}
    </span>
  );
}
