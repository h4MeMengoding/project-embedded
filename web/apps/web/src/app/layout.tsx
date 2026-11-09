import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AosInit } from '@/components/AosInit';
import { Toaster } from 'sonner';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

export const metadata: Metadata = { title: 'Stasiun Cuaca' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${jakarta.variable} font-sans`}>{children}<AosInit /><Toaster position="bottom-right" richColors closeButton /></body>
    </html>
  );
}
