'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from './SidebarContext';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import { useInteractiveTour } from '@/features/guide/context/InteractiveTourContext';
import { UserRole } from '@avahui/shared';
import { HoverHint } from '@/components/ui/HoverHint';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Shield,
  Sparkles,
  UserCircle,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, desc: 'Dòng tiền & Quỹ hụi' },
  { href: '/circles', label: 'Dây hụi', icon: Compass, desc: 'Khám phá & Tham gia' },
  { href: '/circles/create', label: 'Mở dây', icon: PlusCircle, desc: 'Khởi tạo dây mới' },
  { href: '/profile', label: 'Hồ sơ', icon: UserCircle, desc: 'Uy tín & Xác thực' },
  { href: '/guide', label: 'Hướng dẫn', icon: BookOpen, desc: 'Quy trình hoạt động' },
];

export function AppSidebar() {
  const pathname = usePathname() || '/';
  const { isExpanded, toggleSidebar, isMobileOpen, closeMobile } = useSidebar();
  const { data: state } = useAvaHuiState();
  const { startTour } = useInteractiveTour();

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];
  const isStaff =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.VERIFIER;

  const allItems = [
    ...NAV_ITEMS,
    ...(isStaff
      ? [{ href: '/admin', label: 'Quản trị', icon: Shield, desc: 'Xác thực & Vận hành' }]
      : []),
  ];

  return (
    <>
      {/* ================================================================= */}
      {/* 1. DESKTOP UTILITY SIDEBAR (Fixed Left Rail / Drawer)             */}
      {/* ================================================================= */}
      <aside
        aria-label="Thanh tiện ích điều hướng"
        className={`fixed left-0 top-[57px] sm:top-[61px] bottom-0 z-30 hidden md:flex flex-col border-r border-zinc-800/80 bg-zinc-950/95 backdrop-blur-xl shadow-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isExpanded ? 'w-64' : 'w-[72px]'
        }`}
      >
        {/* Sidebar Header & Toggle */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-3">
          {isExpanded ? (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                Menu Tiện Ích
              </span>
              <span className="rounded-full border border-avalanche-red/30 bg-avalanche-red/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-avalanche-red">
                V2
              </span>
            </div>
          ) : (
            <div className="mx-auto">
              <AvahuiLogo size={22} roundedClass="rounded-sm" />
            </div>
          )}

          <HoverHint
            position="right"
            hint={isExpanded ? 'Thu gọn menu' : 'Mở rộng menu tiện ích'}
          >
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={isExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-850 hover:text-white active:scale-95"
            >
              {isExpanded ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </button>
          </HoverHint>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden p-2.5">
          {allItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/circles' && pathname?.startsWith(item.href));

            const buttonContent = (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  isActive
                    ? 'border-avalanche-red bg-avalanche-red text-white shadow-md shadow-avalanche-red/25'
                    : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/90 hover:text-white'
                } ${isExpanded ? 'w-full justify-start' : 'w-full justify-center px-0'}`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-zinc-400 group-hover:text-avalanche-red'
                  }`}
                />
                {isExpanded && (
                  <div className="flex flex-col items-start overflow-hidden leading-tight text-left">
                    <span className="truncate">{item.label}</span>
                    <span
                      className={`text-[9px] font-normal tracking-normal truncate ${
                        isActive ? 'text-white/80' : 'text-zinc-500'
                      }`}
                    >
                      {item.desc}
                    </span>
                  </div>
                )}
              </Link>
            );

            if (!isExpanded) {
              return (
                <HoverHint
                  key={item.href}
                  position="right"
                  hint={`${item.label} — ${item.desc}`}
                  className="w-full"
                >
                  {buttonContent}
                </HoverHint>
              );
            }

            return <React.Fragment key={item.href}>{buttonContent}</React.Fragment>;
          })}
        </div>

        {/* Bottom Utility Card & Network Status */}
        <div className="border-t border-zinc-800/80 p-2.5 space-y-2">
          {isExpanded ? (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-400">Mạng Blockchain</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Fuji (43113)
                </span>
              </div>

              <button
                type="button"
                onClick={() => startTour()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Hướng dẫn UI</span>
              </button>
            </div>
          ) : (
            <HoverHint position="right" hint="Mạng Avalanche Fuji (43113) • Hướng dẫn UI">
              <button
                type="button"
                onClick={() => startTour()}
                className="flex h-10 w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </HoverHint>
          )}

          {/* Expand/Collapse Footer Strip */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`flex w-full items-center rounded-lg border border-zinc-800/60 bg-zinc-900/40 py-1.5 font-mono text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors ${
              isExpanded ? 'justify-between px-2.5' : 'justify-center'
            }`}
          >
            {isExpanded ? (
              <>
                <span>Thu gọn tiện ích</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </>
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* 2. MOBILE DRAWER SLIDE-OVER (< md screens)                        */}
      {/* ================================================================= */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Thanh tiện ích di động"
          className="fixed inset-0 z-50 md:hidden animate-fade-in"
        >
          {/* Backdrop Overlay */}
          <div
            onClick={closeMobile}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Container */}
          <div className="fixed inset-y-0 left-0 flex w-72 flex-col border-r border-zinc-800 bg-zinc-950 p-4 shadow-2xl animate-slide-in-right">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-avalanche-red/40 bg-avalanche-red/10">
                  <AvahuiLogo size={24} roundedClass="rounded-sm" />
                </div>
                <span className="font-mono text-base font-black uppercase text-white">
                  AvaHui
                </span>
              </div>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Đóng menu"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 space-y-1.5 overflow-y-auto py-4">
              {allItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/circles' && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobile}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
                      isActive
                        ? 'border-avalanche-red bg-avalanche-red text-white shadow-md shadow-avalanche-red/25'
                        : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-850 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="flex flex-col leading-tight">
                      <span>{item.label}</span>
                      <span className="text-[10px] font-normal text-zinc-400">
                        {item.desc}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Tour Trigger */}
            <div className="border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  closeMobile();
                  startTour();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20"
              >
                <Sparkles className="h-4 w-4" />
                <span>Bắt đầu hướng dẫn UI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

