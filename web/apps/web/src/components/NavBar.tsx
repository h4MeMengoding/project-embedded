import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

const ITEMS = [
  { key: 'beranda', href: '/', label: 'Beranda', d: 'M12 3 2 12h3v8h5v-5h4v5h5v-8h3z' },
  { key: 'riwayat', href: '/riwayat', label: 'Riwayat', d: 'M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z' },
  { key: 'evaluasi', href: '/evaluasi', label: 'Evaluasi', d: 'M4 4h16v4H4zm0 6h10v4H4zm0 6h16v4H4z' },
  { key: 'fuzzy', href: '/fuzzy', label: 'Fuzzy', d: 'M3 18c4-12 6-12 9 0 3 12 5 12 9 0v2c-4 8-6 8-9-2-3-10-5-10-9 0z' },
  { key: 'perangkat', href: '/perangkat', label: 'Perangkat', d: 'M9 3h6v3h3v15H6V6h3zm2 1v2h2V4z' },
] as const;

export type NavKey = (typeof ITEMS)[number]['key'];

export function NavBar({ active, online, deviceId = 'stasiun-01' }: { active: NavKey; online: boolean; deviceId?: string }) {
  const links = ITEMS.map((it) => (
    <Link key={it.key} href={it.href} className={it.key === active ? 'on' : ''} aria-current={it.key === active ? 'page' : undefined}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={it.d} /></svg>
      {it.label}
    </Link>
  ));
  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Navigasi utama">
        <div className="logo"><i />Stasiun Cuaca</div>
        <div className="sep" />
        <div className="nav-links">{links}</div>
        <div className="sp" />
        <div className="status-pill"><span className={`dot ${online ? '' : 'off'}`} /><span className="pill-id">{deviceId} · </span>{online ? 'Online' : 'Offline'}</div>
        <ThemeToggle />
        <details className="nav-menu">
          <summary aria-label="Menu">☰</summary>
          <div className="menu-list">{links}</div>
        </details>
      </nav>
    </div>
  );
}
