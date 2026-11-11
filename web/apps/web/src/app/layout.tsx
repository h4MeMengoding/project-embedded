import type { Metadata } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import { LiveRefresher } from '@/components/LiveRefresher';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = { title: 'Stasiun Cuaca' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans">{children}<LiveRefresher /><Toaster position="bottom-right" richColors closeButton /></body>
    </html>
  );
}
