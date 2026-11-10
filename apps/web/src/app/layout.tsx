import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Avahui — Hụi On-Chain Minh Bạch Trên Avalanche',
  description:
    'Nền tảng Hụi / Họ tự động trên Blockchain Avalanche với ví bảo mật, tiền cọc tự bù và bỏ thăm kín.',
  icons: {
    icon: '/avahui-logo.jpg',
    shortcut: '/avahui-logo.jpg',
    apple: '/avahui-logo.jpg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-surface-bg text-zinc-100 antialiased selection:bg-avalanche-red selection:text-white">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
