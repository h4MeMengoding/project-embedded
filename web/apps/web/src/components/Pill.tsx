import type { ReactNode } from 'react';

export function Pill({ tone = 'glass', children }: { tone?: 'white' | 'glass' | 'ok' | 'warn'; children: ReactNode }) {
  const cls = tone === 'white' ? 'pl white ok' : tone === 'ok' ? 'pl ok' : tone === 'warn' ? 'pl warn' : 'pl';
  return (
    <span className={cls}>
      <i />
      {children}
    </span>
  );
}
