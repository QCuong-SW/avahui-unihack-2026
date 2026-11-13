'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { TopNavbar } from './TopNavbar';
import { MobileBottomNav } from './MobileBottomNav';
import { PageTransition } from './PageTransition';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { TransactionLifecycleModal } from '@/features/transactions/components/TransactionLifecycleModal';
import { InteractiveTourProvider } from '@/features/guide/context/InteractiveTourContext';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isLanding = pathname === '/';

  return (
    <InteractiveTourProvider>
      <div className="relative flex min-h-screen flex-col bg-surface-bg bg-unihack-grid bg-[size:32px_32px] overflow-x-clip">
        {/* Ambient Subtle Glow Orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -top-40 left-1/4 h-[450px] w-[600px] -translate-x-1/2 rounded-full bg-avalanche-red/8 blur-[140px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -bottom-20 right-10 h-[380px] w-[450px] rounded-full bg-emerald-500/6 blur-[130px]"
        />

        <TopNavbar />
        <main
          className={
            isLanding
              ? 'w-full flex-1'
              : 'mx-auto w-full max-w-7xl flex-1 px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-8'
          }
        >
          <RouteGuard>
            <PageTransition>{children}</PageTransition>
          </RouteGuard>
        </main>
        <footer className="border-t border-zinc-800/80 bg-zinc-950/90 py-4 text-xs text-zinc-500 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900">
                <AvahuiLogo size={20} roundedClass="rounded-sm" />
              </div>
              <span className="font-mono font-bold uppercase tracking-wider text-zinc-300">
                Avahui On-Chain ROSCA
              </span>
              <span className="hidden sm:inline-block font-mono text-[10px] text-zinc-500">
                • Avalanche Fuji (43113)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Nghị định 19/2019/NĐ-CP</span>
              </span>
              <span>•</span>
              <span>Smart Contract Verified</span>
            </div>
          </div>
        </footer>
        <MobileBottomNav />
        <TransactionLifecycleModal />
      </div>
    </InteractiveTourProvider>
  );
}
