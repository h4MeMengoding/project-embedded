'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function RestartCard({ online }: { online: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  async function restart() {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/restart', { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      dialog.current?.close();
      if (!r.ok) toast.error(j.error ?? 'Gagal mengirim perintah.');
      else toast.success('Perintah restart terkirim. Perangkat online kembali dalam ±30 detik.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid max-w-sm gap-3">
      <p className="text-sm text-[var(--muted)]">
        ESP32 menyimpan antrean data ke flash lalu restart. Data live berhenti sebentar; record menit tidak hilang. Butuh firmware yang mendukung perintah restart.
      </p>
      <button type="button" className="btn btn-dark" disabled={!online} onClick={() => setOpen(true)} title={online ? undefined : 'Perangkat sedang offline'}>
        Restart perangkat
      </button>
      {!online && <p className="text-xs text-[var(--muted)]">Tombol aktif saat perangkat online.</p>}

      <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby="rs-confirm-title"
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-2xl bg-[var(--card)] p-6 text-[var(--ink)] shadow-2xl backdrop:bg-black/50">
        <h3 id="rs-confirm-title" className="text-lg font-bold">Restart perangkat?</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">ESP32 akan restart dan tersambung ulang otomatis. Pembacaan live berhenti sekitar 30 detik.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-light" onClick={() => dialog.current?.close()} disabled={busy}>Batal</button>
          <button type="button" className="btn btn-dark" onClick={restart} disabled={busy} autoFocus>{busy ? 'Mengirim…' : 'Restart sekarang'}</button>
        </div>
      </dialog>
    </div>
  );
}
