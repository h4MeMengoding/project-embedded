'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { toast } from 'sonner';

export type FirmwareItem = { id: number; version: string; sizeKb: number; md5: string; uploadedAt: string };

const MAX_BYTES = 0x180000; // slot app di esp/partitions_ota.csv
const POLL_EVERY_S = 5;
const GIVE_UP_S = 180;

const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Kesalahan yang bisa dipastikan di browser sebelum mengunggah; null = lanjut (server tetap memeriksa ulang). */
async function checkFile(f: File): Promise<string | null> {
  if (!f.name.toLowerCase().endsWith('.bin')) return 'Pilih file berekstensi .bin (firmware.bin dari PlatformIO).';
  if (f.size === 0) return 'File kosong.';
  if (f.size > MAX_BYTES) return `File ${fmtSize(f.size)} melebihi slot firmware (${fmtSize(MAX_BYTES)}).`;
  const first = new Uint8Array(await f.slice(0, 1).arrayBuffer())[0];
  if (first !== 0xe9) return 'Bukan image firmware ESP32. Pakai .pio/build/esp32doit-devkit-v1/firmware.bin.';
  return null;
}

// fetch tidak punya progres unggah; XHR punya.
function uploadFile(file: File, onProgress: (ratio: number) => void): Promise<{ ok: boolean; body: { error?: string; version?: string } }> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/admin/firmware');
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      let body = {};
      try { body = JSON.parse(x.responseText); } catch { /* balasan bukan JSON */ }
      resolve({ ok: x.status >= 200 && x.status < 300, body });
    };
    x.onerror = () => resolve({ ok: false, body: { error: 'Koneksi terputus saat mengunggah.' } });
    x.send(file);
  });
}

const PATHS = {
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5',
  check: 'M20 6 9 17l-5-5',
  up: 'M12 19V5m0 0-6 6m6-6 6 6',
  x: 'M18 6 6 18M6 6l12 12',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  spin: 'M21 12a9 9 0 1 1-6.2-8.6',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6m4 5v6m4-6v6',
};
function Icon({ name, className = '' }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${name === 'spin' ? 'motion-safe:animate-spin' : ''} ${className}`}>
      <path d={PATHS[name]} />
    </svg>
  );
}

const TONE = { ok: 'var(--ok)', warn: 'var(--yellow)', muted: 'var(--muted)', busy: 'var(--ok)' } as const;
/** Lencana status: ikon + teks (bukan hanya warna) di atas latar tipis. */
function Badge({ tone, icon, children }: { tone: keyof typeof TONE; icon: keyof typeof PATHS; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-[var(--ink)]"
      style={{ background: `color-mix(in srgb, ${TONE[tone]} 22%, transparent)` }}>
      <Icon name={icon} className="h-4 w-4" />
      {children}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--card2)] px-4 py-3">
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 flex min-h-7 items-center text-[15px] font-bold break-all">{children}</div>
    </div>
  );
}

export function FirmwareCard({ items, online, fwVersion, ip }: { items: FirmwareItem[]; online: boolean; fwVersion: string | null; ip: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null); // 0..1 saat mengunggah
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'send' | 'delete'; item: FirmwareItem } | null>(null);
  // Versi yang sedang dikirim ke perangkat; selama terisi, halaman di-refresh berkala sampai versi perangkat berubah.
  const [updating, setUpdating] = useState<{ version: string; elapsed: number } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const uploading = progress !== null;
  const latest = items[0]?.version ?? null;
  const upToDate = fwVersion != null && fwVersion === latest;

  useEffect(() => {
    if (confirm) dialog.current?.showModal();
  }, [confirm]);

  useEffect(() => {
    if (!updating) return;
    if (fwVersion === updating.version) {
      toast.success(`Perangkat sekarang memakai firmware ${fwVersion}.`);
      setUpdating(null);
      return;
    }
    if (updating.elapsed >= GIVE_UP_S) {
      toast.error('Versi perangkat belum berubah setelah 3 menit. Cek log Serial ([ota]).');
      setUpdating(null);
      return;
    }
    const t = setTimeout(() => {
      if ((updating.elapsed + 1) % POLL_EVERY_S === 0) router.refresh();
      setUpdating({ ...updating, elapsed: updating.elapsed + 1 });
    }, 1000);
    return () => clearTimeout(t);
  }, [updating, fwVersion, router]);

  async function choose(f: File | undefined) {
    if (!f) return;
    const bad = await checkFile(f);
    setFileError(bad);
    setFile(bad ? null : f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    if (!uploading) void choose(e.dataTransfer.files[0]);
  }

  async function upload() {
    if (!file) return;
    setProgress(0);
    const r = await uploadFile(file, setProgress);
    setProgress(null);
    if (!r.ok) return void setFileError(r.body.error ?? 'Unggah gagal.');
    toast.success(`Firmware ${r.body.version} tersimpan.`);
    setFile(null);
    setFileError(null);
    router.refresh();
  }

  async function remove() {
    const it = confirm?.item;
    if (!it) return;
    setSending(true);
    try {
      const r = await fetch(`/api/admin/firmware/${it.id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      dialog.current?.close();
      if (!r.ok) toast.error(j.error ?? 'Gagal menghapus.');
      else { toast.success(`Firmware ${it.version} dihapus.`); router.refresh(); }
    } finally { setSending(false); }
  }

  async function deploy() {
    const it = confirm?.item;
    if (!it) return;
    setSending(true);
    try {
      const r = await fetch('/api/admin/ota', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firmwareId: it.id }) });
      const j = await r.json().catch(() => ({}));
      dialog.current?.close();
      if (!r.ok) toast.error(j.error ?? 'Gagal mengirim perintah.');
      else setUpdating({ version: it.version, elapsed: 0 });
    } finally { setSending(false); }
  }

  return (
    <div className="grid gap-6">
      {/* Status perangkat */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Firmware terpasang">{fwVersion ?? '—'}</Stat>
        <Stat label="Status">
          {updating ? <Badge tone="busy" icon="spin">Memperbarui</Badge>
            : fwVersion == null ? <Badge tone="muted" icon="alert">Belum diketahui</Badge>
            : latest == null ? <Badge tone="muted" icon="file">Belum ada unggahan</Badge>
            : upToDate ? <Badge tone="ok" icon="check">Terbaru</Badge>
            : <Badge tone="warn" icon="up">Ada versi {latest}</Badge>}
        </Stat>
        <Stat label="Alamat IP">{ip ?? '—'}</Stat>
        <Stat label="Perangkat">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: online ? 'var(--ok)' : 'var(--muted)' }} />
            {online ? 'Online' : 'Offline'}
          </span>
        </Stat>
      </div>

      {updating && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-[var(--card2)] px-4 py-3 text-sm">
          <Icon name="spin" className="text-[var(--ok)]" />
          <span>Perangkat mengunduh firmware <b>{updating.version}</b> lalu restart. Menunggu versi baru… <span className="tabular-nums text-[var(--muted)]">{mmss(updating.elapsed)}</span></span>
        </div>
      )}

      {/* Unggah */}
      <section aria-labelledby="fw-upload">
        <h3 id="fw-upload" className="mb-2 text-sm font-bold">Unggah firmware baru</h3>
        <label
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-[#2c8640]/40 ${uploading ? 'cursor-not-allowed opacity-60' : ''}`}
          style={{ borderColor: over ? 'var(--ok)' : 'color-mix(in srgb, var(--muted) 55%, transparent)', background: over ? 'color-mix(in srgb, var(--ok) 10%, transparent)' : 'transparent' }}
        >
          <input ref={picker} type="file" accept=".bin" className="sr-only" disabled={uploading}
            onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
          <Icon name="upload" className="h-8 w-8 text-[var(--muted)]" />
          <span className="text-[15px] font-bold">{over ? 'Lepaskan untuk memilih file' : 'Tarik firmware.bin ke sini'}</span>
          <span className="text-sm text-[var(--muted)]">atau <u>klik untuk memilih file</u> · maksimal {fmtSize(MAX_BYTES)}</span>
        </label>

        {fileError && (
          <p role="alert" className="mt-2 flex items-start gap-2 text-sm text-[var(--ink)]">
            <Icon name="alert" className="mt-0.5 h-4 w-4 text-[#d14343]" />{fileError}
          </p>
        )}

        {file && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--card2)] px-4 py-3">
            <Icon name="file" className="text-[var(--muted)]" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{file.name}</div>
              <div className="text-sm text-[var(--muted)]">{fmtSize(file.size)}</div>
            </div>
            {!uploading && (
              <button type="button" className="btn btn-light" onClick={() => { setFile(null); setFileError(null); }} aria-label={`Hapus ${file.name} dari pilihan`}>
                <Icon name="x" className="h-4 w-4" />Batal
              </button>
            )}
            <button type="button" className="btn btn-dark" onClick={upload} disabled={uploading}>
              {uploading ? <><Icon name="spin" className="h-4 w-4" />Mengunggah {Math.round((progress ?? 0) * 100)}%</> : <><Icon name="upload" className="h-4 w-4" />Unggah</>}
            </button>
            {uploading && (
              <div role="progressbar" aria-label="Progres unggah" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress ?? 0) * 100)}
                className="h-2 w-full overflow-hidden rounded-full bg-[var(--card)]">
                <div className="h-full rounded-full bg-[var(--ok)] transition-[width]" style={{ width: `${(progress ?? 0) * 100}%` }} />
              </div>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Bangun dengan <code>pio run</code> (versi naik otomatis). Versi dibaca dari file; tiga unggahan terakhir disimpan.
        </p>
      </section>

      {/* Daftar firmware */}
      <section aria-labelledby="fw-list">
        <h3 id="fw-list" className="mb-2 text-sm font-bold">Firmware tersimpan</h3>
        {items.length === 0 ? (
          <p className="rounded-2xl bg-[var(--card2)] px-4 py-6 text-center text-sm text-[var(--muted)]">Belum ada firmware. Unggah firmware.bin di atas.</p>
        ) : (
          <ul className="grid gap-2">
            {items.map((it) => {
              const installed = it.version === fwVersion;
              return (
                <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--card2)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[15px] font-bold">
                      {it.version}
                      {installed && <Badge tone="ok" icon="check">Terpasang</Badge>}
                    </div>
                    <div className="text-sm text-[var(--muted)]">{fmtSize(it.sizeKb * 1024)} · md5 {it.md5.slice(0, 8)} · {it.uploadedAt}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn btn-light" onClick={() => setConfirm({ kind: 'send', item: it })}
                      disabled={!online || !!updating || installed}
                      title={!online ? 'Perangkat sedang offline' : installed ? 'Versi ini sudah terpasang' : undefined}>
                      {installed ? 'Sudah terpasang' : 'Kirim ke perangkat'}
                    </button>
                    <button type="button" className="btn btn-light" onClick={() => setConfirm({ kind: 'delete', item: it })}
                      disabled={!!updating} aria-label={`Hapus firmware ${it.version}`} title="Hapus dari server">
                      <Icon name="trash" className="h-4 w-4 text-[#d14343]" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!online && items.length > 0 && <p className="mt-2 text-xs text-[var(--muted)]">Tombol kirim aktif saat perangkat online.</p>}
      </section>

      {/* Konfirmasi (dialog bawaan: fokus terkunci, Esc menutup) */}
      <dialog ref={dialog} onClose={() => setConfirm(null)} aria-labelledby="fw-confirm-title"
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-2xl bg-[var(--card)] p-6 text-[var(--ink)] shadow-2xl backdrop:bg-black/50">
        <h3 id="fw-confirm-title" className="text-lg font-bold">
          {confirm?.kind === 'delete' ? `Hapus firmware ${confirm.item.version}?` : `Kirim firmware ${confirm?.item.version} ke perangkat?`}
        </h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {confirm?.kind === 'delete'
            ? 'File dihapus dari server dan tidak bisa dikembalikan; unggah ulang firmware.bin jika dibutuhkan. Firmware yang sudah terpasang di perangkat tidak berubah.'
            : 'ESP32 akan mengunduh firmware lalu restart. Data sensor berhenti sekitar 1 menit. Jangan matikan daya selama proses.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn btn-light" onClick={() => dialog.current?.close()} disabled={sending}>Batal</button>
          <button type="button" className="btn btn-dark" onClick={confirm?.kind === 'delete' ? remove : deploy} disabled={sending} autoFocus>
            {sending ? <><Icon name="spin" className="h-4 w-4" />{confirm?.kind === 'delete' ? 'Menghapus…' : 'Mengirim…'}</> : confirm?.kind === 'delete' ? 'Hapus' : 'Kirim sekarang'}
          </button>
        </div>
      </dialog>
    </div>
  );
}
