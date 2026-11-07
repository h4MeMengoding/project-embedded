'use client';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const stored = readStored();
    const t = stored ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(t);
    if (stored) document.documentElement.dataset.theme = stored;
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
  };

  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}>
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
