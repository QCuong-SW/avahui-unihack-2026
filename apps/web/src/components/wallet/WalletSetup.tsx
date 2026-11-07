'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import {
  useAuthSession,
  useCompleteWalletOnboardingMutation,
} from '@/lib/auth/useAuthSession';
import { HoverHint } from '@/components/ui/HoverHint';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export function WalletSetup() {
  const router = useRouter();
  const { data: state } = useAvaHuiState();
  const { data: session } = useAuthSession();
  const completeOnboardingMutation = useCompleteWalletOnboardingMutation();

  const [copied, setCopied] = useState(false);

  if (!state) return null;

  const currentUser =
    state.users.find((u) => u.id === (session?.userId || state.currentUserId)) ||
    state.users[0];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUser.walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleContinue = async () => {
    await completeOnboardingMutation.mutateAsync();
    router.push('/dashboard');
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-lg items-center justify-center py-4 sm:py-6 animate-fade-in">
      <div className="w-full rounded-none border border-zinc-800 bg-surface-card p-5 sm:p-9 shadow-xl animate-scale-in">
        <div className="flex items-center justify-between">
          <AvahuiLogo size={44} roundedClass="rounded-none" />
          <span className="inline-flex items-center gap-1.5 rounded-none border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Wallet Created &amp; Verified</span>
          </span>
        </div>

        <h1 className="mt-5 font-mono text-2xl font-extrabold uppercase tracking-tight text-white">
          Your wallet is ready
        </h1>
        <p className="mt-1 font-mono text-xs text-zinc-400">
          Ví nhúng của <strong className="text-zinc-200">{currentUser.email}</strong>{' '}
          đã được liên kết an toàn mà không cần quản lý Private Key thủ công.
        </p>

        {/* Wallet Details Card */}
        <div className="mt-6 space-y-3 rounded-none border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono uppercase tracking-wider text-zinc-400">Wallet Address</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:text-white"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy address</span>
                </>
              )}
            </button>
          </div>

          <code className="block break-all rounded-none border border-zinc-800 bg-zinc-950 px-3 py-2.5 font-mono text-xs font-bold text-white">
            {currentUser.walletAddress}
          </code>

          <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3 text-xs">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Network</div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono font-semibold text-white">
                <span className="h-2 w-2 rounded-none bg-emerald-400" />
                <span>Avalanche Fuji</span>
              </div>
            </div>

            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">Chain ID Check</div>
              <div className="mt-0.5 flex items-center gap-1 font-mono font-semibold text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>43113 (Valid)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Notice with HoverHint */}
        <HoverHint
          side="top"
          hint="Bạn có thể nhận mUSDC thử nghiệm miễn phí qua nút Faucet trên thanh công cụ Dashboard"
          className="mt-4 flex w-full"
        >
          <div className="flex w-full items-center gap-2.5 rounded-none border border-zinc-800 bg-zinc-900/40 px-3.5 py-2.5 font-mono text-xs text-zinc-400">
            <Info className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Thiết lập ví hoàn tất không đồng nghĩa ví đã có sẵn AVAX hoặc
              token giao dịch.
            </span>
          </div>
        </HoverHint>

        <button
          type="button"
          onClick={handleContinue}
          disabled={completeOnboardingMutation.isPending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-none bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:opacity-60"
        >
          {completeOnboardingMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang đồng bộ...</span>
            </>
          ) : (
            <>
              <span>Continue to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
