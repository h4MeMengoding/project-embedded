import Link from 'next/link';
import { LogoMark } from './LogoMark';
import { LuActivity, LuChartColumn, LuCpu, LuHouse, LuListChecks, LuMenu, LuSettings } from 'react-icons/lu';

const ITEMS = [
  { key: 'beranda', href: '/', label: 'Beranda', Icon: LuHouse },
  { key: 'riwayat', href: '/riwayat', label: 'Riwayat', Icon: LuChartColumn },
  { key: 'evaluasi', href: '/evaluasi', label: 'Evaluasi', Icon: LuListChecks },
  { key: 'fuzzy', href: '/fuzzy', label: 'Fuzzy', Icon: LuActivity },
  { key: 'perangkat', href: '/perangkat', label: 'Perangkat', Icon: LuCpu },
  { key: 'pengaturan', href: '/pengaturan', label: 'Pengaturan', Icon: LuSettings },
] as const;

export type NavKey = (typeof ITEMS)[number]['key'];

export function NavBar({ active }: { active: NavKey }) {
  const links = ITEMS.map((it) => (
    <Link key={it.key} href={it.href} className={it.key === active ? 'on' : ''} aria-current={it.key === active ? 'page' : undefined}>
      <it.Icon aria-hidden="true" />
      {it.label}
    </Link>
  ));
  return (
    <div className="nav-wrap">
      <nav className="nav" aria-label="Navigasi utama">
        <div className="logo"><LogoMark />Stasiun Cuaca</div>
        <div className="sep" />
        <div className="nav-links">{links}</div>
        <div className="sp" />
        <details className="nav-menu">
          <summary aria-label="Menu"><LuMenu aria-hidden="true" /></summary>
          <div className="menu-list">{links}</div>
        </details>
      </nav>
    </div>
  );
}
