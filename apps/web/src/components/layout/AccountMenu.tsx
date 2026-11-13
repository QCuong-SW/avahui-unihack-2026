'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  useAvaHuiState,
  useSwitchDemoUser,
} from '@/hooks/useAvaHuiMockQuery';
import {
  useAuthSession,
  useWalletStatusMutation,
} from '@/lib/auth/useAuthSession';
import { WALLET_STATUS_META } from '@/lib/wallet/walletStatus';
import { WalletConnectionState } from '@/lib/auth/authSession';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { LogoutDialog } from '@/components/auth/LogoutDialog';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  Check,
  ChevronDown,
  Copy,
  LogOut,
  Settings,
  Shield,
  Users,
  Wallet,
} from 'lucide-react';
import { UserRole } from '@avahui/shared';
import { frontendEnv } from '@/config/env';

export function AccountMenu() {
  const { data: state } = useAvaHuiState();
  const { data: session } = useAuthSession();
  const switchUserMutation = useSwitchDemoUser();
  const walletStatusMutation = useWalletStatusMutation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!state) return null;

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const walletStatus: WalletConnectionState =
    session?.walletStatus || 'WALLET_CONNECTED_READY';
  const walletMeta = WALLET_STATUS_META[walletStatus];

  const shortName = (currentUser.displayName || currentUser.email || 'User').split(' (')[0];
  const initials = shortName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCopyAddress = () => {
    if (!currentUser.walletAddress) return;
    navigator.clipboard.writeText(currentUser.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className="relative">
        <HoverHint
          side="bottom"
          hint={`${shortName} • ${walletMeta.label}`}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-2.5 py-1.5 text-left text-xs transition hover:border-zinc-500 hover:text-white shadow-sm"
          >
            {/* Avatar with Wallet Status Indicator */}
            <div className="relative flex h-6 w-6 items-center justify-center rounded-md border border-avalanche-red/50 bg-gradient-to-tr from-avalanche-red to-red-600 font-mono text-[11px] font-extrabold text-white">
              {initials}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-zinc-950 ${walletMeta.dotColorClass}`}
              />
            </div>

            <div className="hidden sm:block">
              <div className="max-w-[105px] truncate font-mono text-xs font-bold text-zinc-100">
                {shortName}
              </div>
            </div>

            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        </HoverHint>

        {menuOpen && (
          <div className="absolute right-0 z-50 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-zinc-800/90 bg-zinc-950/90 p-4 shadow-2xl space-y-3.5 animate-scale-in origin-top-right backdrop-blur-2xl overflow-hidden">
            {/* Top Crimson Accent Beam */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-avalanche-red/80 to-transparent" />

            {/* 1. User Identity Header */}
            <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-avalanche-red/50 bg-gradient-to-tr from-avalanche-red to-red-600 font-mono text-sm font-extrabold text-white shadow-md shadow-avalanche-red/25">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">
                  {currentUser.displayName}
                </div>
                <div className="truncate font-mono text-xs text-zinc-400">
                  {currentUser.email}
                </div>
              </div>
            </div>

            {/* 2. Wallet Address & Network Status */}
            <div className="space-y-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Địa chỉ ví</span>
                <div className="flex items-center gap-1.5">
                  <code className="font-mono font-semibold text-zinc-200">
                    {currentUser.walletAddress
                      ? shortenAddress(currentUser.walletAddress, 5)
                      : 'Đang khởi tạo...'}
                  </code>
                  {currentUser.walletAddress && (
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="rounded-md border border-zinc-800 p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2">
                <span className="text-zinc-400">Mạng lưới</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-zinc-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Avalanche Fuji (43113)</span>
                </span>
              </div>

              {/* 3. Explicit Wallet Status Selector */}
              <div className="border-t border-zinc-800/80 pt-2">
                <div
                  className={`flex items-center justify-between ${
                    frontendEnv.enableDevDemoTools ? 'mb-1.5' : ''
                  }`}
                >
                  <span className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                    <Wallet className="h-3 w-3 text-avalanche-red" />
                    <span>Trạng thái ví</span>
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${walletMeta.badgeClass}`}
                  >
                    {walletMeta.shortLabel}
                  </span>
                </div>

                {frontendEnv.enableDevDemoTools && (
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        'WALLET_CREATED',
                        'WALLET_CONNECTED_READY',
                        'WALLET_DISCONNECTED',
                      ] as const
                    ).map((st) => {
                      const meta = WALLET_STATUS_META[st];
                      const active = walletStatus === st;
                      return (
                        <HoverHint key={st} side="top" hint={meta.hint}>
                          <button
                            type="button"
                            onClick={() => walletStatusMutation.mutate(st)}
                            className={`w-full rounded-md border px-1.5 py-1 text-center font-mono text-[10px] font-bold uppercase transition ${
                              active
                                ? meta.badgeClass
                                : 'border-zinc-800 bg-zinc-950/60 text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {meta.shortLabel}
                          </button>
                        </HoverHint>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Quick Demo Account Switcher (Only in explicit Local Dev Mode) */}
            {frontendEnv.enableDevDemoTools && (
              <div className="border-t border-zinc-800 pt-2.5">
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  <Users className="h-3 w-3 text-avalanche-red" />
                  <span>[DEV] Chuyển nhanh Thành viên Demo</span>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {state.users.map((u) => {
                    const active = u.id === currentUser.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          switchUserMutation.mutate(u.id);
                          setMenuOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-md border border-transparent px-2.5 py-1.5 text-left text-xs transition ${
                          active
                            ? 'border-avalanche-red/50 bg-avalanche-red/15 font-bold text-white'
                            : 'text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200'
                        }`}
                      >
                        <span className="truncate">
                          {u.displayName.split(' (')[0]}
                        </span>
                        <span className="font-mono text-[11px] text-emerald-400">
                          {formatUsdc(u.usdcBalance)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Account Settings, Admin Console & Logout Actions */}
            <div className="space-y-1 border-t border-zinc-800 pt-2.5">
              {(currentUser.role === UserRole.ADMIN ||
                currentUser.role === UserRole.VERIFIER) && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Bảng điều khiển Quản trị</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase">{currentUser.role}</span>
                </Link>
              )}

              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-800 hover:bg-zinc-900 hover:text-white"
              >
                <Settings className="h-3.5 w-3.5 text-zinc-400" />
                <span>Hồ sơ & Cài đặt</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setLogoutModalOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-rose-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Screen 05 – Logout Confirmation Dialog */}
      <LogoutDialog
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
      />
    </>
  );
}
