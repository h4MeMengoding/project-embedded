'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { INPUT } from './inputClass';

type Item = { code: string; name: string };
const LEVELS = [
  { level: 'provinces', label: 'Provinsi' },
  { level: 'regencies', label: 'Kabupaten/Kota' },
  { level: 'districts', label: 'Kecamatan' },
  { level: 'villages', label: 'Kelurahan/Desa' },
] as const;

async function load(level: string, code?: string): Promise<Item[]> {
  const r = await fetch(`/api/wilayah?level=${level}${code ? `&code=${code}` : ''}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? 'Gagal memuat daftar wilayah');
  return j.data;
}

/** Dropdown bertingkat (bisa diketik untuk menyaring) → cek ke BMKG → simpan. */
export function RegionPicker({ onSaved }: { onSaved?: () => void } = {}) {
  const router = useRouter();
  const [lists, setLists] = useState<Item[][]>([[], [], [], []]);
  const [text, setText] = useState(['', '', '', '']);
  const [picked, setPicked] = useState<(Item | null)[]>([null, null, null, null]);
  const [preview, setPreview] = useState<{ adm4: string; label: string; forecasts: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load('provinces').then((d) => setLists((l) => [d, l[1], l[2], l[3]])).catch((e) => toast.error(e.message));
  }, []);

  function choose(i: number, value: string) {
    const item = lists[i].find((x) => x.name.toLowerCase() === value.trim().toLowerCase()) ?? null;
    setText((t) => t.map((v, k) => (k === i ? value : k > i ? '' : v)));
    setPicked((p) => p.map((v, k) => (k === i ? item : k > i ? null : v)));
    setLists((l) => l.map((v, k) => (k > i ? [] : v)));
    setPreview(null);
    if (item && i < 3) {
      load(LEVELS[i + 1].level, item.code).then((d) => setLists((l) => l.map((v, k) => (k === i + 1 ? d : v)))).catch((e) => toast.error(e.message));
    }
  }

  const village = picked[3];

  async function check() {
    if (!village) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/settings/region?adm4=${village.code}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast.error(j.error ?? 'Gagal mengecek ke BMKG.');
      else setPreview({ adm4: village.code, label: j.label, forecasts: j.forecasts });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await fetch('/api/settings/region', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adm4: preview.adm4 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast.error(j.error ?? 'Gagal menyimpan.');
      else {
        toast.success(`Wilayah disimpan: ${j.label}. ${j.stored} prakiraan baru diambil.`);
        setPreview(null);
        router.refresh();
        onSaved?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {LEVELS.map((lv, i) => (
          <label key={lv.level} className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{lv.label}</span>
            <input
              className={INPUT} list={`wl-${lv.level}`} value={text[i]} placeholder={lists[i].length ? 'Ketik untuk mencari…' : '—'}
              disabled={i > 0 && !picked[i - 1]} onChange={(e) => choose(i, e.target.value)} autoComplete="off"
            />
            <datalist id={`wl-${lv.level}`}>{lists[i].map((x) => <option key={x.code} value={x.name} />)}</datalist>
          </label>
        ))}
      </div>
      {village && <div className="text-sm text-[var(--muted)]">Kode wilayah: <b className="text-[var(--ink)]">{village.code}</b></div>}
      {preview && (
        <div className="li" role="status">
          <span><small>Lokasi menurut BMKG</small><br /><b>{preview.label}</b><br /><small>{preview.forecasts} prakiraan 3 jam tersedia</small></span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn btn-light" disabled={!village || busy} onClick={check}>{busy && !preview ? 'Mengecek…' : 'Cek ke BMKG'}</button>
        <button type="button" className="btn btn-accent" disabled={!preview || busy} onClick={save}>{busy && preview ? 'Menyimpan…' : 'Simpan wilayah'}</button>
      </div>
    </div>
  );
}
