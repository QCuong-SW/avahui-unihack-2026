import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Avahui — On-Chain ROSCA Platform on Avalanche | UniHack 2026',
  description:
    'Trustless On-Chain ROSCA (Hụi) Platform on Avalanche Fuji with Embedded Wallets & Collateral Protection. Built for Avalanche UniHack 2026.',
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
