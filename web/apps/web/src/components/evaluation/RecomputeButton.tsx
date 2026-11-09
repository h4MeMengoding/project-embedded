'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LuRefreshCw } from 'react-icons/lu';
import { toast } from 'sonner';

export function RecomputeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await fetch('/api/evaluation/recompute', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) toast.warning(`Permintaan terlalu sering. Ulangi dalam ${j.retryAfterSec ?? r.headers.get('Retry-After')} detik.`);
      else if (!r.ok) toast.error(j.error ?? 'Perhitungan ulang gagal.');
      else {
        toast.success(`${j.slots} slot berhasil dihitung ulang.`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="page-actions">
      <button type="button" disabled={busy} onClick={run} className="btn btn-accent"><LuRefreshCw aria-hidden="true" className={busy ? 'spin' : undefined} />{busy ? 'Menghitung…' : 'Hitung ulang evaluasi'}</button>
    </span>
  );
}
