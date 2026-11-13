'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { TopNavbar } from './TopNavbar';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { MobileBottomNav } from './MobileBottomNav';
import { PageTransition } from './PageTransition';
import { RouteGuard } from '@/components/auth/RouteGuard';
import { TransactionLifecycleModal } from '@/features/transactions/components/TransactionLifecycleModal';
import { InteractiveTourProvider } from '@/features/guide/context/InteractiveTourContext';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const isLanding = pathname === '/';
  const isStandaloneAuthScreen =
    pathname.startsWith('/login') || pathname.startsWith('/onboarding/wallet');
  const isAppView = !isLanding && !isStandaloneAuthScreen;
  const { isExpanded } = useSidebar();

  return (
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

      {/* Left Collapsible Utility Sidebar for App Views */}
      {isAppView && <AppSidebar />}

      <main
        className={`flex-1 transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isLanding
            ? 'w-full'
            : isStandaloneAuthScreen
            ? 'mx-auto w-full max-w-7xl px-3 sm:px-4 py-4 sm:py-6'
            : isExpanded
            ? 'md:pl-64 mx-auto w-full max-w-7xl px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-8'
            : 'md:pl-[72px] mx-auto w-full max-w-7xl px-3 sm:px-4 py-4 sm:py-6 pb-24 md:pb-8'
        }`}
      >
        <RouteGuard>
          <PageTransition>{children}</PageTransition>
        </RouteGuard>
      </main>

      <footer
        className={`border-t border-zinc-800/80 bg-zinc-950/90 py-4 text-xs text-zinc-500 backdrop-blur-md transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isAppView && isExpanded
            ? 'md:pl-64'
            : isAppView
            ? 'md:pl-[72px]'
            : ''
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4">
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
        </div>
      </footer>
      <MobileBottomNav />
      <TransactionLifecycleModal />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <InteractiveTourProvider>
        <AppShellContent>{children}</AppShellContent>
      </InteractiveTourProvider>
    </SidebarProvider>
  );
}
