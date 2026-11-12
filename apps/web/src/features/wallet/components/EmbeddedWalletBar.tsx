'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useAvaHuiState,
  useSwapAvaxToUsdcMutation,
} from '@/hooks/useAvaHuiMockQuery';
import { useAuthSession } from '@/lib/auth/useAuthSession';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import { walletApi } from '@/lib/api';
import { formatUsdc } from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import { NetworkStatus } from '@/components/wallet/NetworkStatus';
import { WalletInfo } from '@/components/wallet/WalletInfo';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { useInteractiveTour } from '@/features/guide/context/InteractiveTourContext';
import { frontendEnv } from '@/config/env';
import {
  AlertTriangle,
  ArrowLeftRight,
  Coins,
  Fuel,
  Loader2,
} from 'lucide-react';

export function EmbeddedWalletBar() {
  const queryClient = useQueryClient();
  const { data: state } = useAvaHuiState();
  const { data: session } = useAuthSession();
  const tour = useInteractiveTour();
  const { requestFaucet, isOperating } = useTokenOperations();
  const swapMutation = useSwapAvaxToUsdcMutation();
  const { runTransaction } = useTxLifecycle();
  const dripGasMutation = useMutation({
    mutationFn: () => walletApi.dripGas(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avahui'] });
    },
  });

  if (!state) return null;

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];
  const effectiveAvax = tour.isTourActive
    ? tour.sandboxAvaxBalance
    : currentUser.avaxBalance;
  const effectiveUsdc = tour.isTourActive
    ? tour.sandboxUsdcBalance
    : currentUser.usdcBalance;
  const isLowGas = parseFloat(effectiveAvax) < 0.02;
  const walletStatus = session?.walletStatus || 'WALLET_CONNECTED_READY';

  const handleFaucet = async () => {
    if (tour.isTourActive) {
      tour.performSandboxFaucet();
      return;
    }
    await requestFaucet(1000);
  };

  const handleDripGas = async () => {
    await runTransaction({
      title: 'Cấp +0.02 AVAX phí gas Fuji',
      description: 'Nhận AVAX phí gas miễn phí cho ví mới từ AvaHui Gas Dripper',
      action: async () => {
        const res = await dripGasMutation.mutateAsync();
        return { txHash: res.txHash };
      },
    });
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

      {/* 2. AVAX Gas Balance (Desktop & Tablet) + Gas Drip for New Privy Wallets */}
      <div className="hidden items-center gap-1 sm:flex">
        <HoverHint
          position="bottom"
          hint={
            isLowGas
              ? 'Cảnh báo: Số dư AVAX làm phí gas thấp (< 0.02 AVAX)'
              : 'Số dư AVAX dùng làm phí gas giao dịch'
          }
        >
          <div
            className={`flex items-center gap-1.5 rounded-none border px-2.5 py-1.5 font-mono text-xs font-semibold transition-colors ${
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
            <span>{effectiveAvax} AVAX</span>
          </div>
        </HoverHint>

        {!frontendEnv.useMock &&
          !tour.isTourActive &&
          Boolean(currentUser.walletAddress) &&
          parseFloat(currentUser.avaxBalance) < 0.015 && (
            <HoverHint
              position="bottom"
              hint="Nhận miễn phí +0.02 AVAX làm phí gas giao dịch cho ví mới (1 lần / 24h)"
            >
              <button
                type="button"
                disabled={dripGasMutation.isPending}
                onClick={handleDripGas}
                className="inline-flex items-center gap-1 rounded-none border border-amber-500/50 bg-amber-500/15 px-2 py-1.5 font-mono text-[11px] font-bold uppercase text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950 disabled:opacity-50"
              >
                {dripGasMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Fuel className="h-3 w-3" />
                )}
                <span>+Gas</span>
              </button>
            </HoverHint>
          )}
      </div>

      {/* 3. mUSDC Balance + Faucet Button (Responsive) */}
      <div
        data-tour="wallet-faucet-bar"
        className="flex items-center rounded-none border border-zinc-800 bg-zinc-900/90 p-0.5"
      >
        <HoverHint position="bottom" hint="Số dư token đóng hụi hiện khả dụng">
          <div className="px-2 sm:px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
            <span>{formatUsdc(effectiveUsdc)}</span>
            <span className="hidden sm:inline"> mUSDC</span>
          </div>
        </HoverHint>

        {(frontendEnv.useMock || frontendEnv.enableDevDemoTools) && (
          <HoverHint
            position="bottom"
            hint="[Demo] Mô phỏng Swap 0.05 AVAX → +250 mUSDC"
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
        )}

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
