'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  LayoutDashboard,
  Plus,
  UserCircle,
} from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/circles', label: 'Circles', icon: Compass },
  { href: '/circles/create', label: 'Tạo hụi', icon: Plus, isPrimary: true },
  { href: '/profile', label: 'Hồ sơ', icon: UserCircle },
];

export function MobileBottomNav() {
  const pathname = usePathname() || '/';

  // Do not show bottom nav on public landing, auth, or onboarding screens
  const isHiddenScreen =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/onboarding/wallet');

  if (isHiddenScreen) return null;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/circles' &&
              item.href !== '/dashboard' &&
              pathname.startsWith(item.href));

          if (item.isPrimary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative -top-3 flex flex-col items-center"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-none border border-avalanche-red bg-avalanche-red text-white shadow-lg transition-transform duration-200 active:scale-90 ${
                    isActive
                      ? 'ring-2 ring-white/30 shadow-avalanche-red/40'
                      : 'hover:scale-105'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <span className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center py-1 transition-colors duration-150 active:scale-95 ${
                isActive ? 'text-avalanche-red' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 bg-avalanche-red" />
                )}
              </div>
              <span className="mt-1 font-mono text-[10px] font-medium uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
