'use client';
import { useEffect, useState } from 'react';
import { LuEllipsis, LuShare, LuSquarePlus, LuX } from 'react-icons/lu';
import { LogoMark } from './LogoMark';

// Event Chrome/Edge/Samsung Internet (Android & desktop); belum ada di tipe DOM standar.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const DISMISS_KEY = 'pwa-install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
// iPadOS melaporkan diri sebagai Mac; bedakan lewat layar sentuh.
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Daftarkan service worker dan tampilkan ajakan instal bila aplikasi belum terpasang. */
export function InstallPrompt() {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null);
  const [evt, setEvt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (isStandalone()) return;
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { /* storage diblokir */ }
    if (dismissed) return;

    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); setMode('android'); };
    const onInstalled = () => setMode(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // iOS tidak punya beforeinstallprompt: tampilkan petunjuk manual.
    const t = isIos() ? setTimeout(() => setMode('ios'), 1500) : undefined;
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(t);
    };
  }, []);

  function close() {
    setMode(null);
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage diblokir */ }
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === 'accepted') setMode(null);
    else close();
  }

  if (!mode) return null;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="pwa-title"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-md rounded-3xl bg-[var(--card)] p-5 text-[var(--ink)] shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #1b6232, #4aa653)' }}>
            <LogoMark />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="pwa-title" className="text-base font-bold">Pasang Stasiun Cuaca</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Buka dari layar utama seperti aplikasi, layar penuh tanpa bilah browser.</p>
          </div>
          <button type="button" onClick={close} aria-label="Tutup" className="-m-2 rounded-full p-2 text-[var(--muted)] hover:bg-[var(--card2)]">
            <LuX aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {mode === 'android' ? (
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" className="btn btn-light" onClick={close}>Nanti</button>
            <button type="button" className="btn btn-dark" onClick={install}>Pasang</button>
          </div>
        ) : (
          <ol className="mt-4 grid gap-2 rounded-2xl bg-[var(--card2)] p-4 text-sm">
            <li className="flex items-center gap-2">
              <b>1.</b> Ketuk <LuShare aria-label="Bagikan" className="h-5 w-5 text-[#0a84ff]" /> <b>Bagikan</b>
              <span className="text-[var(--muted)]">(atau <LuEllipsis aria-label="menu" className="inline h-4 w-4" /> lalu Bagikan)</span>
            </li>
            <li className="flex items-center gap-2">
              <b>2.</b> Pilih <LuSquarePlus aria-hidden="true" className="h-5 w-5" /> <b>Tambah ke Layar Utama</b>
            </li>
            <li className="flex items-center gap-2"><b>3.</b> Ketuk <b>Tambah</b></li>
          </ol>
        )}
      </div>
    </div>
  );
}
