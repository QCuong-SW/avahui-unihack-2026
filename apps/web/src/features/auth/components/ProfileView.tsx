'use client';

import React, { useEffect, useState } from 'react';
import {
  useAvaHuiState,
  useResetDemoData,
  useUpdateProfileMutation,
} from '@/hooks/useAvaHuiMockQuery';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  Check,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  Fuel,
  KeyRound,
  RefreshCw,
  Save,
  UserCircle,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

export function ProfileView() {
  const { data: state, isLoading } = useAvaHuiState();
  const updateProfileMutation = useUpdateProfileMutation();
  const { requestFaucet, isOperating: isFaucetOperating } = useTokenOperations();
  const resetMutation = useResetDemoData();

  const [displayName, setDisplayName] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
    }
  }, [currentUser]);

  if (isLoading || !state || !currentUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Đang tải...
      </div>
    );
  }

  const myTxs = state.transactions.filter(
    (tx) =>
      tx.senderAddress.toLowerCase() ===
      currentUser.walletAddress.toLowerCase()
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(displayName);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(currentUser.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFaucet = async () => {
    await requestFaucet(1000);
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in">
      <div className="grid gap-5 sm:gap-6 lg:grid-cols-12">
        {/* Left: User Profile Settings (5 Cols) */}
        <section className="rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-6 lg:col-span-5 space-y-4 sm:space-y-5 animate-fade-up">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3.5 sm:pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-none border border-avalanche-red/30 bg-avalanche-red/15 text-avalanche-red">
              <UserCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-extrabold uppercase tracking-wider text-white">Hồ sơ</h1>
              <p className="font-mono text-xs text-zinc-400">{currentUser.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
                Tên hiển thị
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-sm font-semibold text-white focus:border-avalanche-red focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-none bg-avalanche-red px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed active:scale-95 shadow-sm shadow-avalanche-red/20"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Lưu</span>
              </button>

              {savedNotice && (
                <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400 animate-fade-in">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Đã lưu</span>
                </span>
              )}
            </div>
          </form>

          <div className="border-t border-zinc-800 pt-4">
            <HoverHint
              hint="Khôi phục toàn bộ dây hụi, số dư và lịch sử giao dịch về trạng thái mặc định ban đầu"
              side="bottom"
            >
              <button
                onClick={() => resetMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-none border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-95"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reset Demo</span>
              </button>
            </HoverHint>
          </div>
        </section>

        {/* Right: Privy Embedded Wallet Details (7 Cols) */}
        <section className="rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-6 lg:col-span-7 space-y-4 sm:space-y-5 animate-fade-up animation-delay-100">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3.5 sm:pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-none border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-mono text-lg font-extrabold uppercase tracking-wider text-white">
                    Privy Wallet
                  </h2>
                  <HoverHint
                    hint="Ví không lưu ký: khóa cá nhân được phân tách bảo mật qua MPC"
                    side="top"
                  >
                    <span className="cursor-help rounded-none border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                      MPC
                    </span>
                  </HoverHint>
                </div>
                <p className="font-mono text-xs text-zinc-400">Avalanche Fuji (43113)</p>
              </div>
            </div>

            <HoverHint
              hint="Nhận ngay 1,000 mUSDC thử nghiệm vào ví hiện tại"
              side="left"
            >
              <button
                onClick={handleFaucet}
                disabled={isFaucetOperating}
                className="inline-flex items-center gap-1.5 rounded-none bg-avalanche-red px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:opacity-60"
              >
                <Coins className="h-3.5 w-3.5" />
                <span>+1,000 mUSDC</span>
              </button>
            </HoverHint>
          </div>

          {/* Wallet Address Box */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-zinc-800 bg-zinc-900/70 px-4 py-3">
            <code className="break-all font-mono text-xs font-bold text-white">
              {currentUser.walletAddress}
            </code>
            <div className="flex items-center gap-2">
              <HoverHint hint="Sao chép địa chỉ ví" side="top">
                <button
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-xs font-semibold text-zinc-200 hover:text-white"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </HoverHint>

              <HoverHint hint="Xem địa chỉ trên Snowtrace" side="top">
                <a
                  href={`${frontendEnv.explorerUrl}/address/${currentUser.walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-xs font-semibold text-avalanche-red hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </HoverHint>
            </div>
          </div>

          {/* Balances Row */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-none border border-zinc-800 bg-zinc-900/50 p-3.5">
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-zinc-400">
                <span>mUSDC</span>
                <Coins className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400">
                {formatUsdc(currentUser.usdcBalance)}
              </div>
            </div>

            <div className="rounded-none border border-zinc-800 bg-zinc-900/50 p-3.5">
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-zinc-400">
                <span>Fuji AVAX</span>
                <Fuel className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <div className="mt-1 font-mono text-lg font-extrabold text-white">
                {currentUser.avaxBalance}
              </div>
            </div>

            <HoverHint
              hint="Backend không lưu trữ Private Key của người dùng"
              side="top"
              className="flex"
            >
              <div className="w-full rounded-none border border-zinc-800 bg-zinc-900/50 p-3.5">
                <div className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-zinc-400">
                  <span>Cơ chế Khóa</span>
                  <KeyRound className="h-3.5 w-3.5 text-avalanche-red" />
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-zinc-200">
                  Shamir MPC
                </div>
              </div>
            </HoverHint>
          </div>
        </section>
      </div>

      {/* Personal On-Chain Transaction History */}
      <section className="rounded-none border border-zinc-800 bg-surface-card p-6 space-y-4">
        <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">
          Giao dịch của {currentUser.displayName} ({myTxs.length})
        </h2>

        {myTxs.length === 0 ? (
          <div className="rounded-none border border-zinc-800 bg-zinc-900/40 p-6 text-center font-mono text-xs uppercase tracking-wider text-zinc-500">
            Chưa có giao dịch.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-none border border-zinc-800 bg-zinc-900/50">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-zinc-800 bg-zinc-900/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="px-3.5 py-3">Sự kiện</th>
                  <th className="px-3.5 py-3">Dây hụi</th>
                  <th className="px-3.5 py-3">Số tiền</th>
                  <th className="px-3.5 py-3">Block</th>
                  <th className="px-3.5 py-3">Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {myTxs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-zinc-900/40">
                    <td className="px-3.5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        {tx.txType}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      {tx.circleId ? (
                        <Link
                          href={`/circles/${tx.circleId}`}
                          className="font-semibold text-white hover:text-avalanche-red hover:underline"
                        >
                          {tx.circleName || tx.circleId}
                        </Link>
                      ) : (
                        <span className="text-zinc-500">MockUSDC</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 font-semibold text-emerald-400">
                      {tx.amountFormatted || '—'}
                    </td>
                    <td className="px-3.5 py-3 font-mono text-zinc-400">
                      #{tx.blockNumber}
                    </td>
                    <td className="px-3.5 py-3">
                      <a
                        href={`${frontendEnv.explorerUrl}/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-avalanche-red hover:underline"
                      >
                        <span>{shortenAddress(tx.txHash, 4)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
