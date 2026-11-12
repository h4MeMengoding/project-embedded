'use client';
import { useEffect, useRef, useState } from 'react';
import { LuChevronDown, LuDownload } from 'react-icons/lu';

export type DownloadItem = { kind: string; label: string };

/** Tombol "Unduh" dengan pilihan data dan format (CSV/JSON) untuk /api/export. */
export function DownloadMenu({ items, query }: { items: DownloadItem[]; query: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button type="button" className="btn btn-light" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <LuDownload aria-hidden="true" />Unduh data<LuChevronDown aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-white p-2 text-[#0f2a1b] shadow-2xl ring-1 ring-black/5">
          {items.map((it) => (
            <div key={it.kind} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
              <span className="text-sm font-semibold">{it.label}</span>
              <span className="flex gap-1.5">
                {(['csv', 'json'] as const).map((f) => (
                  <a key={f} role="menuitem" href={`/api/export/${it.kind}?${query}&format=${f}`} onClick={() => setOpen(false)}
                    className="rounded-lg bg-[#e6ede6] px-2.5 py-1 text-xs font-bold uppercase text-[#0f2a1b] no-underline hover:bg-[#d4e2d4]">
                    {f}
                  </a>
                ))}
              </span>
            </div>
          ))}
          <p className="px-3 pb-1 pt-2 text-xs text-[#587062]">Rentang mengikuti filter di halaman.</p>
        </div>
      )}
    </div>
  );
}
