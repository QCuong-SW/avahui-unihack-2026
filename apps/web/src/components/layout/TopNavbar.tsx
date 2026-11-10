'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EmbeddedWalletBar } from '@/features/wallet/components/EmbeddedWalletBar';
import { NotificationPopover } from './NotificationPopover';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import {
  scrollToLandingSection,
  useActiveLandingSection,
} from '@/components/ui/ScrollFocusSection';
import {
  Compass,
  LayoutDashboard,
  LogIn,
  PlusCircle,
  Shield,
  UserCircle,
  Zap,
} from 'lucide-react';
import { UserRole } from '@avahui/shared';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/circles', label: 'Circles', icon: Compass },
  { href: '/circles/create', label: 'Create', icon: PlusCircle },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

const LANDING_NAV_ITEMS = [
  { id: 'co-che', label: 'Cơ chế' },
  { id: 'bao-mat', label: 'Bảo mật V2' },
  { id: 'lo-trinh', label: 'Lộ trình' },
];

export function TopNavbar() {
  const pathname = usePathname() || '/';
  const activeLandingSection = useActiveLandingSection('hero');
  const { data: state } = useAvaHuiState();
  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];
  const isStaff =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.VERIFIER;

  // Dedicated Marketing/Product Navbar for the public Landing Page (`/`)
  if (pathname === '/') {
    return (
      <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-surface-bg/90 backdrop-blur-md animate-fade-down">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              onClick={() => scrollToLandingSection('hero')}
              className="flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <AvahuiLogo size={34} roundedClass="rounded-none" />
              <div>
                <span className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-white">
                  Avahui
                </span>
                <span className="ml-2 hidden sm:inline-block border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-avalanche-red">
                  V2 ON-CHAIN
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-5 font-mono text-xs font-bold uppercase tracking-wider md:flex">
              {LANDING_NAV_ITEMS.map((item) => {
                const isActive = activeLandingSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToLandingSection(item.id)}
                    className={`relative py-1 transition-all duration-300 ${
                      isActive
                        ? 'text-white'
                        : 'text-zinc-500 hover:text-zinc-200'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2px] bg-avalanche-red shadow-[0_0_8px_rgba(232,65,66,0.9)] transition-all duration-300 ${
                        isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'
                      }`}
                    />
                  </button>
                );
              })}

              <Link
                href="/circles"
                className="relative py-1 text-zinc-400 transition-colors hover:text-emerald-400"
              >
                Dây hụi Live
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-none border border-zinc-700 bg-zinc-900 px-3 sm:px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Đăng nhập</span>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-none border border-avalanche-red bg-avalanche-red px-3 sm:px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-avalanche-red/25 transition hover:bg-avalanche-darkRed"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Mở App</span>
            </Link>
          </div>
        </div>
      </header>
    );
  }

  // Standalone minimalist navbar for Auth & Wallet Onboarding screens
  const isStandaloneAuthScreen =
    pathname.startsWith('/login') || pathname.startsWith('/onboarding/wallet');

  if (isStandaloneAuthScreen) {
    return (
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-surface-bg/95 backdrop-blur-md animate-fade-down">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <AvahuiLogo size={34} roundedClass="rounded-none" />
            <span className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-white">
              Avahui
            </span>
          </Link>
          <span className="rounded-none border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-400">
            Fuji Testnet (43113)
          </span>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-surface-bg/95 backdrop-blur-md animate-fade-down">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 sm:gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
          >
            <AvahuiLogo size={34} roundedClass="rounded-none" />
            <span className="text-base sm:text-lg font-extrabold uppercase tracking-wider text-white">
              Avahui
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              ...NAV_ITEMS,
              ...(isStaff
                ? [{ href: '/admin', label: 'Admin', icon: Shield }]
                : []),
            ].map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/circles' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-none border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
                    isActive
                      ? 'border-avalanche-red bg-avalanche-red text-white'
                      : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Tools: Embedded Wallet & Notifications */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <EmbeddedWalletBar />
          <NotificationPopover />
        </div>
      </div>
    </header>
  );
}
