'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { INPUT } from './inputClass';

export function LoginForm() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast.error(j.error ?? 'Login gagal.');
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-4 grid max-w-sm gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Password admin</span>
        <input type="password" autoComplete="current-password" className={INPUT} value={pw} onChange={(e) => setPw(e.target.value)} required />
      </label>
      <button type="submit" className="btn btn-dark" disabled={busy || !pw}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button type="button" className="btn btn-light" onClick={async () => { await fetch('/api/admin/login', { method: 'DELETE' }); router.refresh(); }}>
      Keluar
    </button>
  );
}
