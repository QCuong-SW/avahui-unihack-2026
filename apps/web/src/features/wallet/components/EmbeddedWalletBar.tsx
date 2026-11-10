'use client';

import React from 'react';
import {
  useAvaHuiState,
  useSwapAvaxToUsdcMutation,
} from '@/hooks/useAvaHuiMockQuery';
import { useAuthSession } from '@/lib/auth/useAuthSession';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import { formatUsdc } from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { WalletInfo } from '@/components/wallet/WalletInfo';
import { AccountMenu } from '@/components/layout/AccountMenu';
import {
  AlertTriangle,
  ArrowLeftRight,
  Coins,
  Fuel,
  Loader2,
} from 'lucide-react';

export function EmbeddedWalletBar() {
  const { data: state } = useAvaHuiState();
  const { data: session } = useAuthSession();
  const { requestFaucet, isOperating } = useTokenOperations();
  const swapMutation = useSwapAvaxToUsdcMutation();
  const { runTransaction } = useTxLifecycle();

  if (!state) return null;

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];
  const isLowGas = parseFloat(currentUser.avaxBalance) < 0.02;
  const walletStatus = session?.walletStatus || 'WALLET_CONNECTED_READY';

  const handleFaucet = async () => {
    await requestFaucet(1000);
  };

  const handleSwap = async () => {
    await runTransaction({
      title: 'Swap AVAX → mUSDC (Fuji DEX)',
      description: 'Swapping 0.05 AVAX for +250.00 mUSDC via Trader Joe Router',
      action: async () => {
        return await swapMutation.mutateAsync(0.05);
      },
    });
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* 1. Network Status (Desktop & Tablet) */}
      <div className="hidden lg:block">
        <NetworkStatus compact />
      </div>

      {/* 2. AVAX Gas Balance (Desktop & Tablet) */}
      <HoverHint
        position="bottom"
        hint={
          isLowGas
            ? 'Cảnh báo: Số dư AVAX làm phí gas thấp (< 0.02 AVAX)'
            : 'Số dư AVAX dùng làm phí gas giao dịch'
        }
      >
        <div
          className={`hidden items-center gap-1.5 rounded-none border px-2.5 py-1.5 font-mono text-xs font-semibold sm:flex transition-colors ${
            isLowGas
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
              : 'border-zinc-800 bg-zinc-900/90 text-zinc-300'
          }`}
        >
          {isLowGas ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Fuel className="h-3.5 w-3.5 text-zinc-400" />
          )}
          <span>{currentUser.avaxBalance} AVAX</span>
        </div>
      </HoverHint>

      {/* 3. mUSDC Balance + Faucet Button (Responsive) */}
      <div className="flex items-center rounded-none border border-zinc-800 bg-zinc-900/90 p-0.5">
        <HoverHint position="bottom" hint="Số dư token đóng hụi hiện khả dụng">
          <div className="px-2 sm:px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
            <span>{formatUsdc(currentUser.usdcBalance)}</span>
            <span className="hidden sm:inline"> mUSDC</span>
          </div>
        </HoverHint>

        <HoverHint
          position="bottom"
          hint="Swap nhanh 0.05 AVAX → +250 mUSDC qua Trader Joe Fuji"
        >
          <button
            type="button"
            disabled={swapMutation.isPending}
            onClick={handleSwap}
            className="hidden sm:inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-xs font-bold uppercase text-sky-300 transition hover:border-sky-400 hover:text-white active:scale-95 mr-0.5"
          >
            <ArrowLeftRight className="h-3 w-3 text-sky-400" />
            <span>Swap</span>
          </button>
        </HoverHint>

        <HoverHint
          position="bottom"
          hint="Nhận ngay 1,000 mUSDC Testnet vào ví"
        >
          <button
            type="button"
            disabled={isOperating}
            onClick={handleFaucet}
            className="inline-flex items-center gap-1 rounded-none border border-avalanche-red bg-avalanche-red px-2 sm:px-2.5 py-1 font-mono text-xs font-bold uppercase text-white transition hover:bg-avalanche-darkRed active:scale-95 disabled:opacity-60"
          >
            {isOperating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Coins className="h-3.5 w-3.5" />
            )}
            <span className="hidden xs:inline">+1,000</span>
            <span className="xs:hidden">+1k</span>
          </button>
        </HoverHint>
      </div>

      {/* 4. Wallet Address & Independent Wallet Status (Desktop) */}
      <div className="hidden md:block">
        <WalletInfo
          walletAddress={currentUser.walletAddress}
          walletStatus={walletStatus}
        />
      </div>

      {/* 5. User Profile & Account Menu */}
      <AccountMenu />
    </div>
  );
}
