'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { subscribeLive } from '../lib/liveStream';

/** Saat record menit baru masuk, render ulang komponen server (kartu, grafik, tabel) tanpa reload halaman. */
export function LiveRefresher() {
  const router = useRouter();
  useEffect(() => subscribeLive((e) => { if (e.type === 'minute') router.refresh(); }), [router]);
  return null;
}
