'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { INPUT } from './inputClass';
import { RegionPicker } from './RegionPicker';

type Mode = 'dev' | 'prod';

/** Pilih mode. Memilih prod tanpa wilayah BMKG: minta wilayah dulu, lalu aktifkan otomatis. */
export function ModeCard({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [askRegion, setAskRegion] = useState(false);

  async function change(next: Mode) {
    setBusy(true);
    try {
      const r = await fetch('/api/settings/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setAskRegion(false);
        toast.success(next === 'prod' ? 'Mode produksi aktif: data disimpan.' : 'Dev mode aktif: data tidak disimpan.');
        router.refresh();
      } else if (j.needRegion) setAskRegion(true);
      else toast.error(j.error ?? 'Gagal mengganti mode.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="flex flex-wrap gap-3">
        {(['dev', 'prod'] as const).map((m) => (
          <button key={m} type="button" className={`btn ${m === mode ? 'btn-dark' : 'btn-light'}`} disabled={busy || m === mode} onClick={() => change(m)}>
            {m === 'dev' ? 'Dev mode' : 'Prod mode'}{m === mode ? ' (aktif)' : ''}
          </button>
        ))}
      </div>
      {askRegion && (
        <div>
          <p className="text-sm font-semibold">Pilih wilayah BMKG dulu untuk mengaktifkan mode produksi:</p>
          <RegionPicker onSaved={() => change('prod')} />
        </div>
      )}
    </div>
  );
}

/** Hapus semua data pengukuran; hanya tampil di prod. Wajib mengetik RESET. */
export function ResetCard() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  async function reset() {
    setBusy(true);
    try {
      const r = await fetch('/api/settings/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast.error(j.error ?? 'Reset gagal.');
      else { toast.success('Semua data pengukuran dihapus.'); setText(''); router.refresh(); }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 grid max-w-sm gap-3">
      <p className="text-sm text-[var(--muted)]">
        Menghapus semua data sensor, kejadian hujan, prediksi fuzzy, prakiraan BMKG, dan evaluasi. Perangkat, wilayah, dan firmware tetap. Tidak bisa dibatalkan; ekspor CSV dulu jika perlu.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Ketik RESET untuk konfirmasi</span>
        <input className={INPUT} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />
      </label>
      <button type="button" className="btn btn-dark" disabled={busy || text !== 'RESET'} onClick={reset}>{busy ? 'Menghapus…' : 'Reset database'}</button>
    </div>
  );
}
