'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { EmbeddedWalletBar } from '@/features/wallet/components/EmbeddedWalletBar';
import { NotificationPopover } from './NotificationPopover';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import {
  Compass,
  LayoutDashboard,
  PlusCircle,
  UserCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/circles', label: 'Circles', icon: Compass },
  { href: '/circles/create', label: 'Create', icon: PlusCircle },
  { href: '/profile', label: 'Profile', icon: UserCircle },
];

export function TopNavbar() {
  const pathname = usePathname() || '/';

  // Standalone minimalist navbar for Auth & Wallet Onboarding screens
  const isStandaloneAuthScreen =
    pathname.startsWith('/login') || pathname.startsWith('/onboarding/wallet');

  if (isStandaloneAuthScreen) {
    return (
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-surface-bg/95 backdrop-blur-md animate-fade-down">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 py-3">
          <Link
            href="/login"
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
            {NAV_ITEMS.map((item) => {
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
