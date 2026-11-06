'use client';

import React from 'react';
import { TopNavbar } from './TopNavbar';
import { MobileBottomNav } from './MobileBottomNav';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { TransactionLifecycleModal } from '@/features/transactions/components/TransactionLifecycleModal';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-bg bg-unihack-grid bg-[size:32px_32px]">
      <TopNavbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-8">
        <RouteGuard>{children}</RouteGuard>
      </main>
      <footer className="hidden border-t border-zinc-800/80 bg-zinc-950/90 py-3 text-xs text-zinc-500 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <AvahuiLogo size={22} roundedClass="rounded-none" />
            <span className="font-semibold text-zinc-300">Avahui Protocol</span>
          </div>
          <span className="font-semibold text-avalanche-red">
            AVALANCHE UNIHACK 2026
          </span>
        </div>
      </footer>
      <MobileBottomNav />
      <TransactionLifecycleModal />
    </div>
  );
}
