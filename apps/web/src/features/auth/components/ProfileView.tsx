'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserRole } from '@avahui/shared';
import {
  useAvaHuiState,
  useClaimTeam1VoucherMutation,
  useResetDemoData,
  useSwapAvaxToUsdcMutation,
  useUpdateProfileMutation,
  useVerifyTeam1AttestationMutation,
} from '@/hooks/useAvaHuiMockQuery';
import { SignedAttestationVoucher, verifierApi } from '@/lib/api';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  Fuel,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCircle,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';

export function ProfileView() {
  const { data: state, isLoading } = useAvaHuiState();
  const updateProfileMutation = useUpdateProfileMutation();
  const { requestFaucet, isOperating: isFaucetOperating } = useTokenOperations();
  const swapMutation = useSwapAvaxToUsdcMutation();
  const verifyTeam1Mutation = useVerifyTeam1AttestationMutation();
  const claimVoucherMutation = useClaimTeam1VoucherMutation();
  const { runTransaction } = useTxLifecycle();
  const resetMutation = useResetDemoData();

  const [displayName, setDisplayName] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showVoucherPaste, setShowVoucherPaste] = useState(false);
  const [voucherJsonInput, setVoucherJsonInput] = useState('');
  const [voucherParseError, setVoucherParseError] = useState<string | null>(null);

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];

  const attestationStatusQuery = useQuery({
    queryKey: ['avahui', 'verifier-status', currentUser?.walletAddress],
    queryFn: () => verifierApi.getMyStatus(),
    enabled: Boolean(
      !frontendEnv.useMock &&
        currentUser?.walletAddress &&
        !currentUser?.isTeam1Verified,
    ),
    retry: false,
  });

  const pendingVoucher = attestationStatusQuery.data?.pendingVoucher ?? null;

  const handleClaimVoucher = async (voucher: SignedAttestationVoucher) => {
    await runTransaction({
      title: 'Nhận chứng thực Team1 (EIP-712)',
      description: 'Gửi chữ ký EIP-712 lên hợp đồng Team1AttestationVerifier trên Fuji',
      action: () => claimVoucherMutation.mutateAsync(voucher),
      onSuccess: () => {
        setShowVoucherPaste(false);
        setVoucherJsonInput('');
        setVoucherParseError(null);
      },
    });
  };

  const handleClaimManualVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    setVoucherParseError(null);
    try {
      const parsed = JSON.parse(voucherJsonInput) as SignedAttestationVoucher;
      if (
        !parsed.account ||
        !parsed.identityNullifier ||
        !parsed.signature ||
        !parsed.deadline
      ) {
        throw new Error('Voucher JSON thiếu trường bắt buộc.');
      }
      await handleClaimVoucher(parsed);
    } catch (err: any) {
      setVoucherParseError(err?.message || 'Voucher JSON không hợp lệ.');
    }
  };

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
      (currentUser.walletAddress || '').toLowerCase()
  );
  const isTeam1Verified = Boolean(currentUser.isTeam1Verified);
  const canSelfVerifyTeam1 =
    frontendEnv.useMock ||
    currentUser.role === UserRole.ADMIN ||
    currentUser.role === UserRole.VERIFIER;
  const canShowDemoReset = frontendEnv.useMock || frontendEnv.enableDevDemoTools;
  const canShowSwap = frontendEnv.useMock || frontendEnv.isLocalEvm;

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

          {/* On-Chain ROSCA Credit Score */}
          <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-3.5 font-mono text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Điểm Tín Nhiệm Hụi
              </span>
              <span
                className={`rounded-none border px-2 py-0.5 text-[10px] font-bold uppercase ${
                  currentUser.stats?.creditTier === 'EXPERT'
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : currentUser.stats?.creditTier === 'TRUSTED'
                      ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300'
                }`}
              >
                {currentUser.stats?.creditTier === 'EXPERT'
                  ? 'UY TÍN CAO'
                  : currentUser.stats?.creditTier === 'TRUSTED'
                    ? 'TIN CẬY'
                    : 'MỚI'}{' '}
                • {currentUser.stats?.creditScore ?? (isTeam1Verified ? 600 : 500)}/1000
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-none border border-zinc-800 bg-zinc-950/70 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Đúng hạn</div>
                <div className="mt-0.5 font-bold text-emerald-400">
                  {currentUser.stats?.onTimePaymentsCount ?? 0}
                </div>
              </div>
              <div className="rounded-none border border-zinc-800 bg-zinc-950/70 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Hoàn thành</div>
                <div className="mt-0.5 font-bold text-white">
                  {currentUser.stats?.completedCirclesCount ?? 0}
                </div>
              </div>
              <div className="rounded-none border border-zinc-800 bg-zinc-950/70 p-2">
                <div className="text-[10px] text-zinc-500 uppercase">Trễ hạn</div>
                <div className="mt-0.5 font-bold text-rose-400">
                  {currentUser.stats?.defaultCount ?? 0}
                </div>
              </div>
            </div>
          </div>

          {canShowDemoReset && (
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
          )}
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

          {/* V2 Team1 Anti-Sybil Attestation & 1-Click DEX Swap (Local/Mock) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`h-4 w-4 ${isTeam1Verified ? 'text-emerald-400' : 'text-amber-400'}`}
              />
              <div>
                <div className="font-bold uppercase text-emerald-300">
                  Team1 Anti-Sybil Attestation
                </div>
                <div className="text-[11px] text-zinc-400">
                  {isTeam1Verified
                    ? currentUser.identityNullifier
                      ? `Nullifier: ${shortenAddress(currentUser.identityNullifier, 6)}`
                      : 'Đã xác minh 1-Human-1-Slot'
                    : 'Chưa xác minh Team1 (Liên hệ Verifier/Admin tại /admin)'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isTeam1Verified && !frontendEnv.useMock && pendingVoucher && (
                <button
                  type="button"
                  disabled={claimVoucherMutation.isPending}
                  onClick={() => handleClaimVoucher(pendingVoucher)}
                  className="inline-flex items-center gap-1 rounded-none border border-emerald-400 bg-emerald-500 px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Claim EIP-712 Voucher</span>
                </button>
              )}

              {!isTeam1Verified && !frontendEnv.useMock && (
                <button
                  type="button"
                  onClick={() => setShowVoucherPaste((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-300 hover:border-emerald-400 hover:text-white"
                >
                  <span>{showVoucherPaste ? 'Đóng Voucher' : 'Nhập Voucher'}</span>
                </button>
              )}

              {canSelfVerifyTeam1 && (
                <button
                  type="button"
                  onClick={() =>
                    runTransaction({
                      title: 'Xác thực chống Sybil Team1',
                      description: 'Đăng ký định danh 1 người / 1 vị trí trên Avalanche Fuji',
                      action: () => verifyTeam1Mutation.mutateAsync(),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-none border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-bold uppercase text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{isTeam1Verified ? 'Xác thực lại' : 'Xác thực Team1'}</span>
                </button>
              )}

              {canShowSwap && (
                <button
                  type="button"
                  onClick={() =>
                    runTransaction({
                      title: 'Quy đổi AVAX → mUSDC',
                      description: '0.05 AVAX → +250.00 mUSDC',
                      action: () => swapMutation.mutateAsync(0.05),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-none border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 font-mono text-xs font-bold uppercase text-sky-300 hover:bg-sky-500 hover:text-zinc-950"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>Đổi 0.05 AVAX</span>
                </button>
              )}
            </div>
          </div>

          {!isTeam1Verified && showVoucherPaste && (
            <form
              onSubmit={handleClaimManualVoucher}
              className="space-y-2 rounded-none border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs"
            >
              {voucherParseError && (
                <div className="text-rose-400">{voucherParseError}</div>
              )}
              <textarea
                rows={3}
                value={voucherJsonInput}
                onChange={(e) => setVoucherJsonInput(e.target.value)}
                placeholder='Dán JSON EIP-712 Voucher từ Verifier/Admin ({"verifierAddress":...,"signature":...})'
                className="w-full rounded-none border border-zinc-700 bg-zinc-900 p-2 text-[11px] text-white focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={claimVoucherMutation.isPending || !voucherJsonInput.trim()}
                className="rounded-none bg-emerald-500 px-3 py-1.5 font-bold uppercase text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                Gửi giao dịch Claim Team1
              </button>
            </form>
          )}
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
                        <span className="text-zinc-500">mUSDC (Token thử nghiệm)</span>
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
