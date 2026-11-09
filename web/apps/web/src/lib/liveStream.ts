'use client';
// Satu koneksi WebSocket (/ws/live) dipakai bersama semua komponen di halaman.
// Menyambung ulang sendiri (jeda 1 → 15 detik); event { type: 'open' } dikirim setiap kali tersambung.

type Fn = (e: { type: string; [k: string]: unknown }) => void;
let ws: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let delay = 1000;
const fns = new Set<Fn>();

function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/live`);
  const cur = ws;
  cur.onopen = () => { delay = 1000; fns.forEach((f) => f({ type: 'open' })); };
  cur.onmessage = (m) => {
    try {
      const e = JSON.parse(m.data);
      fns.forEach((f) => f(e));
    } catch {}
  };
  cur.onclose = () => {
    if (ws !== cur) return; // ditutup sengaja
    ws = null;
    retry = setTimeout(connect, delay);
    delay = Math.min(delay * 2, 15_000);
  };
}

export function subscribeLive(fn: Fn): () => void {
  fns.add(fn);
  if (!ws && !retry && typeof WebSocket !== 'undefined') connect();
  return () => {
    fns.delete(fn);
    if (fns.size === 0) {
      clearTimeout(retry);
      retry = undefined;
      const w = ws;
      ws = null;
      w?.close();
    }
  };
}
