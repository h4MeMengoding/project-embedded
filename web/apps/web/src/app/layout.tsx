import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import { LiveRefresher } from '@/components/LiveRefresher';
import { InstallPrompt } from '@/components/InstallPrompt';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stasiun Cuaca',
  applicationName: 'Stasiun Cuaca',
  appleWebApp: { capable: true, title: 'Stasiun Cuaca', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#1b6232', viewportFit: 'cover', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans">{children}<LiveRefresher /><InstallPrompt /><Toaster position="bottom-right" richColors closeButton /></body>
    </html>
  );
}
