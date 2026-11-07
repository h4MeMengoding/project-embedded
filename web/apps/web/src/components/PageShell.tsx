import type { ReactNode } from 'react';

/** Lebar dan padding sesuai Global Constraints. */
export function PageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`shell ${className}`}>{children}</div>;
}

/** Pita hijau di atas halaman; kartu halaman boleh menimpa tepinya dengan margin negatif. */
export function HeroBand({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`hero-band ${className}`}>{children}</div>;
}
