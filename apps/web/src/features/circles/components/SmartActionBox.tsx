'use client';

import React, { useState } from 'react';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
  MemberStatus,
  RoundStatus,
  UserProfile,
  UserRole,
} from '@avahui/shared';
import { frontendEnv } from '@/config/env';
import { useCircleActions } from '@/hooks/useCircleActions';
import { useVerifyTeam1AttestationMutation } from '@/hooks/useAvaHuiMockQuery';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import {
  useAuthSession,
  useWalletStatusMutation,
} from '@/lib/auth/useAuthSession';
import { WALLET_STATUS_META } from '@/lib/wallet/walletStatus';
import {
  computeWithdrawBreakdown,
  formatUsdc,
  shortenAddress,
} from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  TOUR_SANDBOX_CIRCLE_ID,
  useInteractiveTour,
} from '@/features/guide/context/InteractiveTourContext';
import {
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  Eye,
  Gavel,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Unlock,
  UserPlus,
  XCircle,
  Zap,
} from 'lucide-react';

interface SmartActionBoxProps {
  circle: CircleItem;
  currentUser: UserProfile;
}

export function SmartActionBox({ circle, currentUser }: SmartActionBoxProps) {
  const {
    executeJoinCircle,
    executeContribute,
    executeSubmitBid,
    executeCommitBid,
    executeRevealBid,
    getSavedSealedBid,
    importSealedBidBackup,
    executeSettleRound,
    executeWithdrawCollateral,
    executeCancelExpiredCircle,
    isJoining,
    isContributing,
    isBidding,
    isCommittingBid,
    isRevealingBid,
    isSettling,
    isWithdrawing,
    isCancelling,
  } = useCircleActions();
  const verifyTeam1Mutation = useVerifyTeam1AttestationMutation();
  const { runTransaction } = useTxLifecycle();
  const { data: session } = useAuthSession();
  const walletStatusMutation = useWalletStatusMutation();
  const tour = useInteractiveTour();
  const isTourSandbox = circle.id === TOUR_SANDBOX_CIRCLE_ID;

  const walletStatus = session?.walletStatus || 'WALLET_CONNECTED_READY';
  const walletMeta = WALLET_STATUS_META[walletStatus];

  const myMember = circle.members.find(
    (m) =>
      m.walletAddress.toLowerCase() ===
      (currentUser.walletAddress || '').toLowerCase()
  );

  const currentRoundObj = circle.rounds.find(
    (r) =>
      r.roundNumber === circle.currentRound && r.status === RoundStatus.Open
  );

  const currentHighestBid = currentRoundObj
    ? currentRoundObj.bids.reduce(
        (max, b) => Math.max(max, parseFloat(b.bidAmountFormatted)),
        0
      )
    : 0;

  const suggestedBid = Math.min(
    parseFloat(circle.maxBidFormatted) || 40,
    Math.max(parseFloat(circle.minBidFormatted) || 2, currentHighestBid + 2)
  );

  const [bidInput, setBidInput] = useState<string>(String(suggestedBid));
  const useSealedMode = circle.isSealedBid !== false;
  const grossPotUsdc =
    (parseFloat(circle.contributionAmountFormatted || '0') || 0) *
    (circle.maxMembers || 1);
  const parsedBidNumeric = parseFloat(bidInput);
  const estimatedBidPayout = Number.isFinite(parsedBidNumeric)
    ? Math.max(0, grossPotUsdc - Math.max(0, parsedBidNumeric))
    : grossPotUsdc;
  const [saltCopied, setSaltCopied] = useState(false);
  const [showSaltRecovery, setShowSaltRecovery] = useState(false);
  const [recoveryBidInput, setRecoveryBidInput] = useState(String(suggestedBid));
  const [recoverySaltInput, setRecoverySaltInput] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('invite');
      if (fromUrl) return fromUrl;
    }
    return circle.inviteCode || '';
  });

  const savedSealedBid = isTourSandbox
    ? tour.sandboxSavedSealedBid
    : currentRoundObj
    ? getSavedSealedBid(circle.id, currentRoundObj.roundNumber)
    : null;

  const hasPaidCurrentRound =
    myMember && currentRoundObj
      ? currentRoundObj.contributions.some(
          (c) =>
            c.memberAddress.toLowerCase() ===
            myMember.walletAddress.toLowerCase()
        )
      : false;

  const unpaidMembersCount = currentRoundObj
    ? circle.maxMembers - currentRoundObj.contributionsCount
    : 0;
  const isPaused = Boolean(circle.isPaused);

  const handleJoinCircle = async () => {
    if (isTourSandbox) {
      tour.performSandboxJoin(
        currentUser.walletAddress,
        currentUser.displayName || 'Bạn (Tài khoản tập)',
      );
      return;
    }
    await runTransaction({
      title: `Tham gia dây & Khóa thế chấp`,
      description: `Vị trí #${circle.currentMemberCount + 1} • ${formatUsdc(circle.collateralAmountFormatted)} mUSDC${
        inviteCodeInput ? ` • Mã mời: ${inviteCodeInput}` : ''
      }`,
      action: async () => {
        return await executeJoinCircle(circle, inviteCodeInput || undefined);
      },
    });
  };

  const handleContribute = async () => {
    if (!currentRoundObj) return;
    if (isTourSandbox) {
      tour.performSandboxContribute(
        currentUser.walletAddress,
        currentUser.displayName || 'Bạn (Tài khoản tập)',
      );
      return;
    }
    await runTransaction({
      title: `Đóng hụi Kỳ #${currentRoundObj.roundNumber}`,
      description: `${formatUsdc(circle.contributionAmountFormatted)} mUSDC • ${circle.name}`,
      action: async () => {
        return await executeContribute(circle, currentRoundObj.roundNumber);
      },
    });
  };

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoundObj) return;
    const numericBid = parseFloat(bidInput);
    await runTransaction({
      title: `Đặt giá chiết khấu • Kỳ #${currentRoundObj.roundNumber}`,
      description: `Mức chiết khấu: ${formatUsdc(numericBid)} mUSDC`,
      action: async () => {
        return await executeSubmitBid(
          circle,
          currentRoundObj.roundNumber,
          numericBid
        );
      },
      onSuccess: () => {
        setBidInput(String(numericBid + 2));
      },
    });
  };

  const handleCommitSealedBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoundObj) return;
    const numericBid = parseFloat(bidInput);
    if (isTourSandbox) {
      tour.performSandboxCommitBid(numericBid);
      return;
    }
    await runTransaction({
      title: `Niêm phong giá đấu kín • Kỳ #${currentRoundObj.roundNumber}`,
      description: `Mã băm bảo mật keccak256 cho mức giá ${formatUsdc(numericBid)} mUSDC`,
      action: async () => {
        return await executeCommitBid(
          circle,
          currentRoundObj.roundNumber,
          numericBid
        );
      },
    });
  };

  const handleRevealSealedBid = async () => {
    if (!currentRoundObj) return;
    if (isTourSandbox) {
      tour.performSandboxRevealBid(
        currentUser.walletAddress,
        currentUser.displayName || 'Bạn (Tài khoản tập)',
      );
      return;
    }
    const revealAmount = savedSealedBid?.bidAmountUsdc || parseFloat(bidInput);
    await runTransaction({
      title: `Mở niêm phong giá đấu • Kỳ #${currentRoundObj.roundNumber}`,
      description: `Xác thực mã Salt & Công bố mức đấu giá: ${formatUsdc(revealAmount)} mUSDC`,
      action: async () => {
        return await executeRevealBid(
          circle,
          currentRoundObj.roundNumber,
          { bidAmountUsdc: revealAmount, salt: savedSealedBid?.salt }
        );
      },
    });
  };

  const handleRevealRecoveredSalt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoundObj) return;
    setRecoveryError(null);
    const parsedBid = parseFloat(recoveryBidInput);
    if (!Number.isFinite(parsedBid) || parsedBid <= 0) {
      setRecoveryError('Số tiền đấu giá không hợp lệ.');
      return;
    }
    try {
      importSealedBidBackup(
        circle.id,
        currentRoundObj.roundNumber,
        parsedBid,
        recoverySaltInput,
      );
      await runTransaction({
        title: `Khôi phục & Mở niêm phong • Kỳ #${currentRoundObj.roundNumber}`,
        description: `Khôi phục Salt & Mở niêm phong ${formatUsdc(parsedBid)} mUSDC`,
        action: async () => {
          return await executeRevealBid(circle, currentRoundObj.roundNumber, {
            bidAmountUsdc: parsedBid,
            salt: recoverySaltInput.trim(),
          });
        },
      });
      setShowSaltRecovery(false);
    } catch (err: any) {
      setRecoveryError(err?.message || 'Salt không hợp lệ.');
    }
  };

  const handleCopySalt = () => {
    if (!savedSealedBid?.salt) return;
    navigator.clipboard.writeText(savedSealedBid.salt);
    setSaltCopied(true);
    setTimeout(() => setSaltCopied(false), 1800);
  };

  const handleDownloadSaltBackup = () => {
    if (!savedSealedBid) return;
    const payload = JSON.stringify(savedSealedBid, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avahui-salt-r${savedSealedBid.roundNumber}-${circle.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancelExpiredCircle = async () => {
    await runTransaction({
      title: 'Hủy dây hụi quá hạn & Mở hoàn cọc',
      description: `Gọi cancelExpiredCircle() cho "${circle.name}"`,
      action: async () => {
        return await executeCancelExpiredCircle(circle);
      },
    });
  };

  const handleVerifyTeam1 = async () => {
    await runTransaction({
      title: `Xác thực định danh Team1`,
      description: `Đăng ký định danh 1 người / 1 vị trí trên Avalanche Fuji`,
      action: async () => {
        return await verifyTeam1Mutation.mutateAsync();
      },
    });
  };

  const handleSettleRound = async () => {
    if (!currentRoundObj) return;
    if (isTourSandbox) {
      tour.performSandboxSettleRound(
        currentUser.walletAddress,
        currentUser.displayName || 'Bạn (Tài khoản tập)',
      );
      return;
    }
    const willSlash = unpaidMembersCount > 0;
    await runTransaction({
      title: willSlash
        ? `Tất toán Kỳ #${currentRoundObj.roundNumber} & Trích thế chấp`
        : `Tất toán Kỳ #${currentRoundObj.roundNumber} & Giải ngân`,
      description: willSlash
        ? `Trích thế chấp của ${unpaidMembersCount} thành viên chưa đóng bù quỹ`
        : `Giải ngân ${formatUsdc(currentRoundObj.netPayoutFormatted)} mUSDC`,
      action: async () => {
        return await executeSettleRound(circle, currentRoundObj.roundNumber);
      },
    });
  };

  const withdrawBreakdown = myMember
    ? computeWithdrawBreakdown(circle, myMember)
    : {
        collateralUsdc: 0,
        discountBonusUsdc: 0,
        yieldBonusUsdc: 0,
        totalClaimableUsdc: 0,
      };

  const handleWithdrawCollateral = async () => {
    if (!myMember) return;
    if (isTourSandbox) {
      tour.performSandboxWithdraw(currentUser.walletAddress);
      return;
    }

    await runTransaction({
      title: `Rút Thế chấp & Tiền thưởng`,
      description: `+${formatUsdc(withdrawBreakdown.totalClaimableUsdc)} mUSDC`,
      action: async () => {
        return await executeWithdrawCollateral(circle);
      },
    });
  };

  const totalCollateralInContract = circle.members.reduce(
    (acc, m) => acc + parseFloat(m.lockedCollateralFormatted),
    0
  );

  return (
    <aside
      data-tour="action-console"
      className="sticky top-24 space-y-4 rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-4 sm:p-5 shadow-2xl relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-avalanche-red/60 to-transparent" />

      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white">Bảng Thao Tác</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${walletMeta.badgeClass}`}
        >
          {walletMeta.shortLabel}
        </span>
      </div>

      {circle.isPaused && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 font-mono text-xs text-rose-200 space-y-1">
          <div className="font-bold uppercase text-rose-300">
            Smart Contract đang tạm dừng (Guardian Pause)
          </div>
          <p className="text-[11px] text-rose-200/80">
            Mọi thao tác tham gia, đóng tiền, đấu giá và kết toán tạm thời bị khóa cho tới khi Guardian mở lại.
          </p>
        </div>
      )}

      {!walletMeta.canSignTransactions && (
        <div className="space-y-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
          <div className="font-mono font-bold text-amber-200 uppercase">{walletMeta.label}</div>
          <p className="text-[11px] text-zinc-300">{walletMeta.hint}</p>
          <button
            type="button"
            onClick={() =>
              walletStatusMutation.mutate('WALLET_CONNECTED_READY')
            }
            className="w-full rounded-lg border border-avalanche-red/60 bg-gradient-to-r from-avalanche-red to-red-600 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-avalanche-red/25 transition hover:brightness-110 active:scale-95"
          >
            Kích hoạt ví để giao dịch
          </button>
        </div>
      )}

      {/* CASE 1: RECRUITING */}
      {circle.status === CircleStatus.Recruiting && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-xs">
            <span className="font-bold text-amber-300 uppercase tracking-wider">Đang gom thành viên</span>
            <span className="font-bold text-white">
              {circle.currentMemberCount} / {circle.maxMembers} vị trí
            </span>
          </div>

          {/* Team1 Anti-Sybil Attestation Status */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bảo vệ định danh Team1</span>
            </span>
            {currentUser.isTeam1Verified ? (
              <span className="text-emerald-400 font-bold">Đã xác thực (1 người / 1 suất)</span>
            ) : frontendEnv.useMock ||
              currentUser.role === UserRole.ADMIN ||
              currentUser.role === UserRole.VERIFIER ? (
              <button
                type="button"
                onClick={handleVerifyTeam1}
                className="underline text-amber-300 hover:text-white font-bold"
              >
                Xác thực ngay
              </button>
            ) : (
              <span
                className={
                  circle.requireTeam1Attestation
                    ? 'text-amber-300 font-bold'
                    : 'text-zinc-400 font-semibold'
                }
              >
                {circle.requireTeam1Attestation
                  ? 'Cần Quản trị duyệt'
                  : 'Không bắt buộc'}
              </span>
            )}
          </div>

          {!myMember ? (
            <div className="space-y-2.5">
              {(circle.isPrivateInvite || inviteCodeInput) && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2 font-mono text-[11px]">
                  <span className="text-sky-300 font-semibold">Mã mời:</span>
                  <input
                    type="text"
                    value={inviteCodeInput}
                    onChange={(e) => setInviteCodeInput(e.target.value)}
                    placeholder="AVAHUI-XXXX"
                    className="w-32 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs font-bold text-white focus:border-sky-400 focus:outline-none text-right"
                  />
                </div>
              )}

              <HoverHint
                hint={`Khóa ${formatUsdc(circle.collateralAmountFormatted)} mUSDC thế chấp và nhận vị trí Slot #${circle.currentMemberCount + 1}. Đủ ${circle.maxMembers} người sẽ tự động mở Vòng #1.`}
                className="w-full"
              >
                <button
                  onClick={handleJoinCircle}
                  disabled={isJoining || isPaused}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-avalanche-red/60 bg-gradient-to-r from-avalanche-red to-red-600 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>
                    Tham gia • Khóa {formatUsdc(circle.collateralAmountFormatted)}{' '}
                    mUSDC
                  </span>
                </button>
              </HoverHint>
            </div>
          ) : (
            <HoverHint
              hint="Đã giữ chỗ thành công. Chờ đủ thành viên để dây hụi tự động kích hoạt Vòng #1"
              className="w-full"
            >
              <div className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-mono text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Đã tham gia</span>
                </span>
                <span>Slot #{myMember.slotIndex}</span>
              </div>
            </HoverHint>
          )}

          {/* Cancel Expired Recruiting Circle */}
          {(() => {
            const deadlineMs = circle.startDeadline
              ? new Date(circle.startDeadline).getTime()
              : null;
            const isExpired =
              deadlineMs !== null && Number.isFinite(deadlineMs) && Date.now() > deadlineMs;
            return (
              <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3 space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Hạn tuyển thành viên:</span>
                  <span className={isExpired ? 'font-bold text-rose-400' : 'text-zinc-300'}>
                    {deadlineMs
                      ? new Date(deadlineMs).toLocaleString('vi-VN')
                      : '7 ngày'}
                  </span>
                </div>
                <HoverHint
                  hint={
                    isExpired
                      ? 'Đã quá hạn gom đủ thành viên — Bấm để hủy dây trên Smart Contract và mở rút 100% thế chấp'
                      : 'Chỉ khả dụng sau khi quá hạn tuyển thành viên (startDeadline) mà chưa đủ người'
                  }
                  className="w-full"
                >
                  <button
                    type="button"
                    onClick={handleCancelExpiredCircle}
                    disabled={isCancelling || !isExpired}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300 transition-all hover:bg-rose-500 hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>
                      {isExpired
                        ? 'Hủy dây quá hạn & Hoàn cọc'
                        : 'Chờ quá hạn mới có thể hủy'}
                    </span>
                  </button>
                </HoverHint>
              </div>
            );
          })()}
        </div>
      )}

      {/* CASE 2: ACTIVE */}
      {circle.status === CircleStatus.Active && currentRoundObj && (
        <div className="space-y-3.5">
          {/* 1. CONTRIBUTION */}
          {myMember && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold uppercase tracking-wider text-zinc-300">
                  1. Đóng tiền Vòng #{currentRoundObj.roundNumber}
                </span>
                <span className="rounded-md border border-zinc-700/80 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-bold text-white">
                  Slot #{myMember.slotIndex}
                </span>
              </div>

              {hasPaidCurrentRound ? (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 font-mono text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    Đã đóng {formatUsdc(circle.contributionAmountFormatted)}{' '}
                    mUSDC
                  </span>
                </div>
              ) : (
                <HoverHint
                  hint={`Chuyển ${formatUsdc(circle.contributionAmountFormatted)} mUSDC vào quỹ Vòng #${currentRoundObj.roundNumber}`}
                  className="w-full"
                >
                  <button
                    onClick={handleContribute}
                    disabled={isContributing || isPaused}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-avalanche-red/60 bg-gradient-to-r from-avalanche-red to-red-600 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Coins className="h-4 w-4" />
                    <span>
                      Đóng {formatUsdc(circle.contributionAmountFormatted)}{' '}
                      mUSDC
                    </span>
                  </button>
                </HoverHint>
              )}
            </div>
          )}

          {/* 2. BIDDING (Supports Sealed-Bid Commit-Reveal & Open Bid) */}
          {circle.allocationMode === AllocationMode.BIDDING && myMember && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-300">
                  <Gavel className="h-3.5 w-3.5 text-avalanche-red" />
                  <span>2. Đấu giá Chiết khấu</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-400">
                  Max: {formatUsdc(currentHighestBid)} mUSDC
                </span>
              </div>

              {/* Enforced Bidding Mode Indicator (Matches Circle Configuration) */}
              {!myMember.hasReceivedPayout && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-2.5 py-1.5 font-mono text-[10px]">
                    <span className="flex items-center gap-1 font-bold uppercase text-zinc-200">
                      {useSealedMode ? (
                        <>
                          <Lock className="h-3 w-3 text-avalanche-red" />
                          <span>Đấu giá kín (2 pha Niêm phong)</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-3 w-3 text-amber-400" />
                          <span>Đấu giá công khai</span>
                        </>
                      )}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      Thực nhận ≈ {formatUsdc(estimatedBidPayout)} mUSDC
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug">
                    Giá đấu là phần chiết khấu bạn nhường lại cho nhóm (Thực nhận = Tổng quỹ {formatUsdc(grossPotUsdc)} − Giá đấu).
                  </p>
                </div>
              )}

              {myMember.hasReceivedPayout ? (
                <HoverHint
                  hint="Mỗi thành viên chỉ được nhận quỹ 1 lần duy nhất trong suốt dây hụi"
                  className="w-full"
                >
                  <div className="flex w-full items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-3 py-2.5 font-mono text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span>Đã nhận quỹ</span>
                    </span>
                    <span className="font-bold text-white">
                      Kỳ #{myMember.wonRoundNumber}
                    </span>
                  </div>
                </HoverHint>
              ) : useSealedMode ? (
                <div className="space-y-2">
                  <form onSubmit={handleCommitSealedBid} className="space-y-2">
                    <div className="flex gap-2">
                      <HoverHint
                        hint={`Nhập giá đấu bí mật (${formatUsdc(circle.minBidFormatted)} – ${formatUsdc(circle.maxBidFormatted)} mUSDC). Hệ thống sẽ băm keccak256(bid, salt) để chống nhìn trộm trên Mempool.`}
                        className="flex-1"
                      >
                        <input
                          type="number"
                          step="1"
                          value={bidInput}
                          onChange={(e) => setBidInput(e.target.value)}
                          className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900 px-3 py-2 font-mono text-sm font-bold text-white focus:border-avalanche-red focus:outline-none"
                        />
                      </HoverHint>

                      <HoverHint hint="Bước 1: Gửi mã băm niêm phong lên chuỗi (2/3 thời gian đầu)">
                        <button
                          type="submit"
                          disabled={isCommittingBid || isBidding || isPaused}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-avalanche-red/60 bg-avalanche-red/15 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red transition hover:bg-avalanche-red hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Niêm phong</span>
                        </button>
                      </HoverHint>
                    </div>
                  </form>

                  {savedSealedBid && (
                    <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 font-mono text-[11px] space-y-2">
                      <div className="flex items-center justify-between text-sky-300">
                        <span>Mã niêm phong:</span>
                        <span className="font-bold">
                          {shortenAddress(savedSealedBid.commitment, 6)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCopySalt}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-zinc-200 hover:border-sky-400 hover:text-white transition-colors"
                        >
                          {saltCopied ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          <span>{saltCopied ? 'Đã chép Salt' : 'Sao chép Salt'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadSaltBackup}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-sky-300 hover:border-sky-400 hover:text-white transition-colors"
                        >
                          <Download className="h-3 w-3" />
                          <span>Sao lưu JSON</span>
                        </button>
                      </div>

                      {savedSealedBid.revealed ? (
                        <div className="flex items-center justify-between text-emerald-400 font-bold">
                          <span>Đã mở niêm phong:</span>
                          <span>{formatUsdc(savedSealedBid.bidAmountUsdc)} mUSDC</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRevealSealedBid}
                          disabled={isRevealingBid || isBidding || isPaused}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-400 bg-sky-500 px-3 py-1.5 font-mono text-xs font-bold uppercase text-zinc-950 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-sky-500/20"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>
                            Mở niêm phong ({formatUsdc(savedSealedBid.bidAmountUsdc)} mUSDC)
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Recovery Form if User Switched Browser / Cleared Cache */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSaltRecovery((v) => !v)}
                      className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400 underline hover:text-sky-300"
                    >
                      <KeyRound className="h-3 w-3" />
                      <span>
                        {showSaltRecovery
                          ? 'Ẩn khôi phục Salt'
                          : 'Đổi trình duyệt / Mất Salt? Nhập lại Salt để Reveal'}
                      </span>
                    </button>

                    {showSaltRecovery && (
                      <form
                        onSubmit={handleRevealRecoveredSalt}
                        className="mt-2 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-[11px]"
                      >
                        {recoveryError && (
                          <div className="text-rose-400">{recoveryError}</div>
                        )}
                        <input
                          type="number"
                          step="1"
                          value={recoveryBidInput}
                          onChange={(e) => setRecoveryBidInput(e.target.value)}
                          placeholder="Giá đã đấu (mUSDC)"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-white focus:border-sky-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          value={recoverySaltInput}
                          onChange={(e) => setRecoverySaltInput(e.target.value)}
                          placeholder="0x... (Salt 64 hex ký tự)"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-white focus:border-sky-400 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={isRevealingBid || isBidding || isPaused}
                          className="w-full rounded-lg border border-sky-400 bg-sky-500/20 px-3 py-1.5 font-bold uppercase text-sky-300 hover:bg-sky-500 hover:text-zinc-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Khôi phục &amp; Reveal Bid
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitBid} className="space-y-2">
                  <div className="flex gap-2">
                    <HoverHint
                      hint={`Biên độ hợp lệ: ${formatUsdc(circle.minBidFormatted)} – ${formatUsdc(circle.maxBidFormatted)} mUSDC (Phải > ${formatUsdc(currentHighestBid)} mUSDC)`}
                      className="flex-1"
                    >
                      <input
                        type="number"
                        step="1"
                        value={bidInput}
                        onChange={(e) => setBidInput(e.target.value)}
                        className="w-full rounded-lg border border-zinc-700/80 bg-zinc-900 px-3 py-2 font-mono text-sm font-bold text-white focus:border-avalanche-red focus:outline-none"
                      />
                    </HoverHint>

                    <HoverHint hint="Gửi mức chiết khấu để dẫn đầu vòng đấu giá">
                      <button
                        type="submit"
                        disabled={isBidding || isPaused}
                        className="shrink-0 rounded-lg border border-avalanche-red/60 bg-avalanche-red/15 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red transition hover:bg-avalanche-red hover:text-white active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Đặt giá
                      </button>
                    </HoverHint>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 font-mono">
                    {[2, 5, 10].map((inc) => {
                      const nextVal = Math.min(
                        parseFloat(circle.maxBidFormatted),
                        Math.max(
                          parseFloat(circle.minBidFormatted),
                          currentHighestBid + inc
                        )
                      );
                      return (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setBidInput(String(nextVal))}
                          className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
                        >
                          +{inc}
                        </button>
                      );
                    })}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 3. SETTLEMENT & AUTO-SLASH */}
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-4 space-y-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="font-bold uppercase tracking-wider text-zinc-300">
                3. Tất toán Kỳ #{currentRoundObj.roundNumber}
              </span>
              <span className="font-semibold text-emerald-400">
                {currentRoundObj.contributionsCount}/{circle.maxMembers} Đã đóng
              </span>
            </div>

            {unpaidMembersCount === 0 ? (
              <HoverHint
                hint={`Giải ngân ${formatUsdc(currentRoundObj.netPayoutFormatted)} mUSDC cho người thắng và chuyển sang kỳ tiếp theo`}
                className="w-full"
              >
                <button
                  onClick={handleSettleRound}
                  disabled={isSettling || isPaused}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    Tất toán &amp; Giải ngân{' '}
                    {formatUsdc(currentRoundObj.netPayoutFormatted)} mUSDC
                  </span>
                </button>
              </HoverHint>
            ) : (
              <HoverHint
                hint={`Tự động trích thế chấp của ${unpaidMembersCount} thành viên chưa đóng để đắp đủ 100% Quỹ và giải ngân ngay`}
                className="w-full"
              >
                <button
                  onClick={handleSettleRound}
                  disabled={isSettling || isPaused}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/60 bg-amber-500/15 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-200 transition-all hover:bg-amber-500 hover:text-zinc-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    Tất toán &amp; Trích thế chấp ({unpaidMembersCount} trễ hạn)
                  </span>
                </button>
              </HoverHint>
            )}
          </div>
        </div>
      )}

      {/* CASE 3: COMPLETED */}
      {circle.status === CircleStatus.Completed && (
        <div className="space-y-3 font-mono">
          {myMember ? (
            myMember.status === MemberStatus.Withdrawn ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Đã rút Thế chấp &amp; Lời</span>
                </span>
                <span>0.00 mUSDC</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thế chấp gốc:</span>
                    <span className="font-bold text-white">
                      {formatUsdc(withdrawBreakdown.collateralUsdc)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thưởng chiết khấu:</span>
                    <span className="font-bold text-emerald-400">
                      +{formatUsdc(withdrawBreakdown.discountBonusUsdc)} mUSDC
                    </span>
                  </div>
                  {(withdrawBreakdown.yieldBonusUsdc > 0 ||
                    circle.enableYieldVault !== false) && (
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Lãi Yield Vault (6.5%):</span>
                      <span className="font-bold text-emerald-400">
                        +{formatUsdc(withdrawBreakdown.yieldBonusUsdc)} mUSDC
                      </span>
                    </div>
                  )}
                </div>

                <HoverHint
                  hint="Rút lại toàn bộ thế chấp còn dư, tiền thưởng chiết khấu và lãi Yield Vault được chia đều"
                  className="w-full"
                >
                  <button
                    onClick={handleWithdrawCollateral}
                    disabled={isWithdrawing}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-xl shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-95"
                  >
                    <Unlock className="h-4 w-4" />
                    <span>
                      Rút +{formatUsdc(withdrawBreakdown.totalClaimableUsdc)} mUSDC
                    </span>
                  </button>
                </HoverHint>
              </div>
            )
          ) : null}
        </div>
      )}

      {/* CASE 4: CANCELLED — Refund Collateral */}
      {circle.status === CircleStatus.Cancelled && (
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300">
            <span>Dây hụi đã hủy (Cancelled)</span>
            <span>Hoàn 100% cọc</span>
          </div>
          {myMember &&
            (myMember.status === MemberStatus.Withdrawn ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Đã hoàn trả tiền thế chấp</span>
                </span>
                <span>0.00 mUSDC</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleWithdrawCollateral}
                disabled={isWithdrawing}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition-all hover:brightness-110 active:scale-95"
              >
                <Unlock className="h-4 w-4" />
                <span>
                  Rút hoàn cọc +{formatUsdc(myMember.lockedCollateralFormatted)} mUSDC
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Compact Collateral Pool Footer */}
      <HoverHint
        hint="Tổng tài sản thế chấp đang được khóa bảo chứng trong Smart Contract"
        className="w-full"
      >
        <div className="flex w-full items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-3.5 py-2.5 font-mono text-xs">
          <span className="flex items-center gap-1.5 text-zinc-400 uppercase tracking-wider text-[11px]">
            <Lock className="h-3.5 w-3.5 text-amber-400" />
            <span>Tổng thế chấp đang khóa</span>
          </span>
          <span className="font-bold text-amber-300">
            {formatUsdc(totalCollateralInContract)} mUSDC
          </span>
        </div>
      </HoverHint>

      {/* V2 DeFi Yield Vault (ERC-4626) Footer */}
      {circle.enableYieldVault !== false && (
        <HoverHint
          hint="Tiền thế chấp và phần quỹ chưa giải ngân được tự động gửi vào AvaHuiYieldVault (ERC-4626) sinh lãi 6.50% APY và chia đều cho thành viên cuối kỳ"
          className="w-full"
        >
          <div className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-emerald-300 uppercase tracking-wider text-[11px]">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>Kho sinh lãi (6.5% APY)</span>
            </span>
            <span className="font-bold text-emerald-400">
              +{formatUsdc(circle.accruedYieldFormatted || '0.00')} mUSDC
            </span>
          </div>
        </HoverHint>
      )}
    </aside>
  );
}
