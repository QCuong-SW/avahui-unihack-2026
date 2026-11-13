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
  LogIn,
  Menu,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';

const LANDING_NAV_ITEMS = [
  { id: 'giao-dien', label: 'Giao diện' },
  { id: 'co-che', label: 'Cơ chế' },
  { id: 'bao-mat', label: 'Bảo mật V2' },
  { id: 'lo-trinh', label: 'Lộ trình' },
];

export function TopNavbar() {
  const pathname = usePathname() || '/';
  const activeLandingSection = useActiveLandingSection('hero');
  const { toggleMobile } = useSidebar();

  // Dedicated Marketing/Product Navbar for the public Landing Page (`/`)
  if (pathname === '/') {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl animate-fade-down shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                onClick={() => scrollToLandingSection('hero')}
                className="flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-avalanche-red/40 bg-avalanche-red/10 shadow-[0_0_12px_rgba(232,65,66,0.2)]">
                  <AvahuiLogo size={28} roundedClass="rounded-sm" />
                </div>
                <span className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                  Avahui
                </span>
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
                          : 'text-zinc-400 hover:text-zinc-200'
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
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-avalanche-red bg-gradient-to-r from-avalanche-red via-red-600 to-avalanche-darkRed px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-avalanche-red/25 transition hover:brightness-110 hover:shadow-avalanche-red/40 active:scale-95"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập / Đăng ký</span>
              </Link>
            </div>
          </div>
        </header>
        <div className="h-[61px] shrink-0 pointer-events-none" aria-hidden="true" />
      </>
    );
  }

  // Standalone minimalist navbar for Auth & Wallet Onboarding screens
  const isStandaloneAuthScreen =
    pathname.startsWith('/login') || pathname.startsWith('/onboarding/wallet');

  if (isStandaloneAuthScreen) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl animate-fade-down shadow-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-3 sm:px-4 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-avalanche-red/40 bg-avalanche-red/10 shadow-[0_0_12px_rgba(232,65,66,0.2)]">
                <AvahuiLogo size={28} roundedClass="rounded-sm" />
              </div>
              <span className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                Avahui
              </span>
            </Link>
            <span className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-[11px] font-medium text-zinc-400">
              Fuji Testnet (43113)
            </span>
          </div>
        </header>
        <div className="h-[61px] shrink-0 pointer-events-none" aria-hidden="true" />
      </>
    );
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl animate-fade-down shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3">
          {/* Brand & Left Sidebar Toggles */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={toggleMobile}
              aria-label="Mở menu di động"
              className="inline-flex md:hidden items-center justify-center h-8 w-8 rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            <Link
              href="/dashboard"
              className="flex items-center gap-2 sm:gap-2.5 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-avalanche-red/40 bg-avalanche-red/10 shadow-[0_0_12px_rgba(232,65,66,0.2)]">
                <AvahuiLogo size={28} roundedClass="rounded-sm" />
              </div>
              <span className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
                Avahui
              </span>
            </Link>
          </div>

          {/* Right Tools: Embedded Wallet & Notifications */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <EmbeddedWalletBar />
            <NotificationPopover />
          </div>
        </div>
      </header>
      <div className="h-[57px] sm:h-[61px] shrink-0 pointer-events-none" aria-hidden="true" />
    </>
  );
}
