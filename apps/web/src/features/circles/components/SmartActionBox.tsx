'use client';

import React, { useState } from 'react';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
  MemberStatus,
  RoundStatus,
  UserProfile,
} from '@avahui/shared';
import { useCircleActions } from '@/hooks/useCircleActions';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import {
  useAuthSession,
  useWalletStatusMutation,
} from '@/lib/auth/useAuthSession';
import { WALLET_STATUS_META } from '@/lib/wallet/walletStatus';
import { formatUsdc } from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  CheckCircle2,
  Coins,
  Gavel,
  Lock,
  ShieldAlert,
  Sparkles,
  Trophy,
  Unlock,
  UserPlus,
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
    getSavedBidCommitment,
    executeSettleRound,
    executeWithdrawCollateral,
    isJoining,
    isContributing,
    isBidding,
    isCommitting,
    isRevealing,
    isSettling,
    isWithdrawing,
  } = useCircleActions();
  const { runTransaction } = useTxLifecycle();
  const { data: session } = useAuthSession();
  const walletStatusMutation = useWalletStatusMutation();

  const walletStatus = session?.walletStatus || 'WALLET_CONNECTED_READY';
  const walletMeta = WALLET_STATUS_META[walletStatus];

  const myMember = circle.members.find(
    (m) =>
      m.walletAddress.toLowerCase() === currentUser.walletAddress.toLowerCase()
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
  const [, setCommitTick] = useState<number>(0);

  const savedCommitment = currentRoundObj
    ? getSavedBidCommitment(circle.id, currentRoundObj.roundNumber)
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

  const handleJoinCircle = async () => {
    await runTransaction({
      title: `Join Circle & Lock Collateral`,
      description: `Slot #${circle.currentMemberCount + 1} • ${formatUsdc(circle.collateralAmountFormatted)} mUSDC`,
      action: async () => {
        return await executeJoinCircle(circle);
      },
    });
  };

  const handleContribute = async () => {
    if (!currentRoundObj) return;
    await runTransaction({
      title: `Contribute Round #${currentRoundObj.roundNumber}`,
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
      title: `Submit Bid • Round #${currentRoundObj.roundNumber}`,
      description: `Discount Bid: ${formatUsdc(numericBid)} mUSDC`,
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

  const handleCommitSealedBid = async () => {
    if (!currentRoundObj) return;
    const numericBid = parseFloat(bidInput);
    await runTransaction({
      title: `Sealed-Bid Commit • Round #${currentRoundObj.roundNumber}`,
      description: `Keccak256 Hash Lock (${formatUsdc(numericBid)} mUSDC + 32-byte Salt)`,
      action: async () => {
        const res = await executeCommitBid(
          circle,
          currentRoundObj.roundNumber,
          numericBid
        );
        setCommitTick((t) => t + 1);
        return { txHash: res.txHash };
      },
    });
  };

  const handleRevealSealedBid = async () => {
    if (!currentRoundObj) return;
    await runTransaction({
      title: `Sealed-Bid Reveal • Round #${currentRoundObj.roundNumber}`,
      description: `Verify Salt & Reveal Bid on AvaHuiCircle`,
      action: async () => {
        const res = await executeRevealBid(circle, currentRoundObj.roundNumber);
        setCommitTick((t) => t + 1);
        return { txHash: res.txHash };
      },
    });
  };

  const handleSettleRound = async () => {
    if (!currentRoundObj) return;
    const willSlash = unpaidMembersCount > 0;
    await runTransaction({
      title: willSlash
        ? `Settle Round #${currentRoundObj.roundNumber} & Auto-Slash`
        : `Settle Round #${currentRoundObj.roundNumber} & Payout`,
      description: willSlash
        ? `Slashing ${unpaidMembersCount} unpaid member(s)`
        : `Distributing ${formatUsdc(currentRoundObj.netPayoutFormatted)} mUSDC`,
      action: async () => {
        return await executeSettleRound(circle, currentRoundObj.roundNumber);
      },
    });
  };

  const handleWithdrawCollateral = async () => {
    if (!myMember) return;
    const bonusPerMember =
      parseFloat(circle.totalDiscountPoolFormatted) / circle.maxMembers;
    const yieldPerMember =
      (parseFloat(circle.totalYieldEarnedFormatted || '4.25') || 0) /
      circle.maxMembers;
    const totalClaim =
      parseFloat(myMember.lockedCollateralFormatted) +
      bonusPerMember +
      yieldPerMember;

    await runTransaction({
      title: `Withdraw Collateral, Bonus & DeFi Yield`,
      description: `+${formatUsdc(totalClaim)} mUSDC`,
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
    <aside className="sticky top-24 space-y-4 rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-white">Action Console</h2>
        <span
          className={`rounded-none border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${walletMeta.badgeClass}`}
        >
          {walletMeta.shortLabel}
        </span>
      </div>

      {!walletMeta.canSignTransactions && (
        <div className="space-y-2.5 rounded-none border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs">
          <div className="font-mono font-bold text-amber-200 uppercase">{walletMeta.label}</div>
          <p className="text-[11px] text-zinc-300">{walletMeta.hint}</p>
          <button
            type="button"
            onClick={() =>
              walletStatusMutation.mutate('WALLET_CONNECTED_READY')
            }
            className="w-full rounded-none border border-avalanche-red bg-avalanche-red px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed"
          >
            Connect Wallet to Transact
          </button>
        </div>
      )}

      {/* CASE 1: RECRUITING */}
      {circle.status === CircleStatus.Recruiting && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-none border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-mono text-xs">
            <span className="font-bold text-amber-300 uppercase tracking-wider">Recruiting</span>
            <span className="font-bold text-white">
              {circle.currentMemberCount} / {circle.maxMembers} Slots
            </span>
          </div>

          {!myMember ? (
            <HoverHint
              hint={`Khóa ${formatUsdc(circle.collateralAmountFormatted)} mUSDC thế chấp và nhận vị trí Slot #${circle.currentMemberCount + 1}. Đủ ${circle.maxMembers} người sẽ tự động mở Vòng #1.`}
              className="w-full"
            >
              <button
                onClick={handleJoinCircle}
                disabled={isJoining}
                className="flex w-full items-center justify-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/25 transition hover:bg-avalanche-darkRed disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                <span>
                  Tham gia • Khóa {formatUsdc(circle.collateralAmountFormatted)}{' '}
                  mUSDC
                </span>
              </button>
            </HoverHint>
          ) : (
            <HoverHint
              hint="Đổi sang tài khoản thành viên khác ở góc phải Navbar để thêm cho đủ số lượng kích hoạt vòng hụi"
              className="w-full"
            >
              <div className="flex w-full items-center justify-between rounded-none border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 font-mono text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Đã tham gia</span>
                </span>
                <span>Slot #{myMember.slotIndex}</span>
              </div>
            </HoverHint>
          )}
        </div>
      )}

      {/* CASE 2: ACTIVE */}
      {circle.status === CircleStatus.Active && currentRoundObj && (
        <div className="space-y-3.5">
          {/* 1. CONTRIBUTION */}
          {myMember && (
            <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="font-bold uppercase tracking-wider text-zinc-300">
                  1. Đóng tiền Vòng #{currentRoundObj.roundNumber}
                </span>
                <span className="rounded-none border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-white">
                  Slot #{myMember.slotIndex}
                </span>
              </div>

              {hasPaidCurrentRound ? (
                <div className="flex items-center gap-2 rounded-none border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 font-mono text-xs font-semibold text-emerald-300">
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
                    disabled={isContributing}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/20 transition hover:bg-avalanche-darkRed disabled:opacity-50"
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

          {/* 2. BIDDING */}
          {circle.allocationMode === AllocationMode.BIDDING && myMember && (
            <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-300">
                  <Gavel className="h-3.5 w-3.5 text-avalanche-red" />
                  <span>2. Đấu giá Chiết khấu</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-400">
                  Max: {formatUsdc(currentHighestBid)} mUSDC
                </span>
              </div>

              {myMember.hasReceivedPayout ? (
                <HoverHint
                  hint="Mỗi thành viên chỉ được nhận Payout 1 lần duy nhất trong dây hụi"
                  className="w-full"
                >
                  <div className="flex w-full items-center justify-between rounded-none border border-zinc-800 bg-zinc-950/60 px-3 py-2.5 font-mono text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Trophy className="h-4 w-4 text-amber-400" />
                      <span>Đã nhận Payout</span>
                    </span>
                    <span className="font-bold text-white">
                      Vòng #{myMember.wonRoundNumber}
                    </span>
                  </div>
                </HoverHint>
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
                        className="w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm font-bold text-white focus:border-avalanche-red focus:outline-none"
                      />
                    </HoverHint>

                    <HoverHint hint="Gửi mức chiết khấu để dẫn đầu vòng đấu giá">
                      <button
                        type="submit"
                        disabled={isBidding}
                        className="shrink-0 rounded-none border border-avalanche-red bg-avalanche-red/15 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red transition hover:bg-avalanche-red hover:text-white"
                      >
                        Bid
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
                          className="flex-1 rounded-none border border-zinc-800 bg-zinc-950 py-1 text-[11px] font-semibold text-zinc-300 hover:border-zinc-600 hover:text-white"
                        >
                          +{inc}
                        </button>
                      );
                    })}
                  </div>

                  {/* V2 Sealed-Bid 2-Phase Commit-Reveal Controls */}
                  <div className="mt-2.5 space-y-2 border-t border-zinc-800 pt-2.5 font-mono">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1 font-bold uppercase text-amber-300">
                        <Lock className="h-3 w-3" />
                        <span>V2 Sealed-Bid (Commit-Reveal)</span>
                      </span>
                      <span className="text-zinc-400">
                        {savedCommitment
                          ? savedCommitment.revealed
                            ? 'Revealed'
                            : 'Committed'
                          : 'Phase 1'}
                      </span>
                    </div>

                    {!savedCommitment ? (
                      <HoverHint
                        hint="Pha 1 (Commit): Băm mức giá cùng mã Salt 32-byte bằng Keccak256 và gửi lên chuỗi mà không tiết lộ số tiền thật"
                        className="w-full"
                      >
                        <button
                          type="button"
                          disabled={isCommitting}
                          onClick={handleCommitSealedBid}
                          className="flex w-full items-center justify-center gap-1.5 rounded-none border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-500 hover:text-zinc-950 disabled:opacity-50"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>1. Commit Sealed Bid (Ẩn giá)</span>
                        </button>
                      </HoverHint>
                    ) : !savedCommitment.revealed ? (
                      <div className="space-y-1.5">
                        <div className="rounded-none border border-amber-500/30 bg-zinc-950 px-2.5 py-1.5 text-[10px] text-zinc-300">
                          <div>
                            Hash:{' '}
                            <span className="text-amber-300">
                              {savedCommitment.commitment.slice(0, 14)}...
                            </span>
                          </div>
                          <div>
                            Saved Salt &amp; Bid:{' '}
                            <span className="font-bold text-white">
                              {formatUsdc(savedCommitment.bidAmountUsdc)} mUSDC
                            </span>
                          </div>
                        </div>
                        <HoverHint
                          hint="Pha 2 (Reveal): Gửi giá trị thực và Salt để Smart Contract đối chiếu mã băm Keccak256 và cập nhật người dẫn đầu"
                          className="w-full"
                        >
                          <button
                            type="button"
                            disabled={isRevealing}
                            onClick={handleRevealSealedBid}
                            className="flex w-full items-center justify-center gap-1.5 rounded-none border border-emerald-500 bg-emerald-500 px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span>
                              2. Reveal Sealed Bid (
                              {formatUsdc(savedCommitment.bidAmountUsdc)} mUSDC)
                            </span>
                          </button>
                        </HoverHint>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-none border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300">
                        <span>Đã mở thăm hợp lệ</span>
                        <span>{formatUsdc(savedCommitment.bidAmountUsdc)} mUSDC</span>
                      </div>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 3. SETTLEMENT & AUTO-SLASH */}
          <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between font-mono text-xs">
              <span className="font-bold uppercase tracking-wider text-zinc-300">
                3. Kết toán Vòng #{currentRoundObj.roundNumber}
              </span>
              <span className="font-semibold text-emerald-400">
                {currentRoundObj.contributionsCount}/{circle.maxMembers} Paid
              </span>
            </div>

            {unpaidMembersCount === 0 ? (
              <HoverHint
                hint={`Giải ngân ${formatUsdc(currentRoundObj.netPayoutFormatted)} mUSDC cho người thắng và chuyển sang vòng tiếp theo`}
                className="w-full"
              >
                <button
                  onClick={handleSettleRound}
                  disabled={isSettling}
                  className="flex w-full items-center justify-center gap-2 rounded-none border border-emerald-500 bg-emerald-500 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    Settle &amp; Payout{' '}
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
                  disabled={isSettling}
                  className="flex w-full items-center justify-center gap-2 rounded-none border border-amber-500/60 bg-amber-500/15 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500 hover:text-zinc-950"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    Settle &amp; Slash ({unpaidMembersCount} trễ hạn)
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
              <div className="flex items-center justify-between rounded-none border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-300">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Đã rút Thế chấp &amp; Lời</span>
                </span>
                <span>0.00 mUSDC</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="rounded-none border border-zinc-800 bg-zinc-900/80 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thế chấp gốc:</span>
                    <span className="font-bold text-white">
                      {formatUsdc(myMember.lockedCollateralFormatted)} mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thưởng chiết khấu:</span>
                    <span className="font-bold text-emerald-400">
                      +
                      {formatUsdc(
                        parseFloat(circle.totalDiscountPoolFormatted) /
                          circle.maxMembers
                      )}{' '}
                      mUSDC
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Lãi DeFi Vault (8% APY):</span>
                    <span className="font-bold text-sky-400">
                      +
                      {formatUsdc(
                        (parseFloat(circle.totalYieldEarnedFormatted || '4.25') ||
                          0) / circle.maxMembers
                      )}{' '}
                      mUSDC
                    </span>
                  </div>
                </div>

                <HoverHint
                  hint="Rút lại toàn bộ thế chấp còn dư và phần tiền thưởng chiết khấu được chia đều"
                  className="w-full"
                >
                  <button
                    onClick={handleWithdrawCollateral}
                    disabled={isWithdrawing}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-emerald-500 bg-emerald-500 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
                  >
                    <Unlock className="h-4 w-4" />
                    <span>
                      Rút +
                      {formatUsdc(
                        parseFloat(myMember.lockedCollateralFormatted) +
                          parseFloat(circle.totalDiscountPoolFormatted) /
                            circle.maxMembers
                      )}{' '}
                      mUSDC
                    </span>
                  </button>
                </HoverHint>
              </div>
            )
          ) : null}
        </div>
      )}

      {/* Compact Collateral Pool & V2 DeFi Yield Vault Footer */}
      <div className="space-y-2">
        <HoverHint
          hint="Tổng tài sản thế chấp đang được khóa bảo chứng trong Smart Contract"
          className="w-full"
        >
          <div className="flex w-full items-center justify-between rounded-none border border-zinc-800 bg-zinc-950/60 px-3.5 py-2.5 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-zinc-400 uppercase tracking-wider text-[11px]">
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>Total Locked Collateral</span>
            </span>
            <span className="font-bold text-amber-300">
              {formatUsdc(totalCollateralInContract)} mUSDC
            </span>
          </div>
        </HoverHint>

        <HoverHint
          hint="V2 ERC-4626 Yield Vault: Lãi suất tích lũy theo thời gian thực (8.0% APY) trên vốn thế chấp nhàn rỗi, tự động chia đều khi hoàn tất dây hụi"
          className="w-full"
        >
          <div className="flex w-full items-center justify-between rounded-none border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 font-mono text-xs">
            <span className="flex items-center gap-1.5 text-emerald-300 uppercase tracking-wider text-[11px]">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
              <span>ERC-4626 Yield Vault (8% APY)</span>
            </span>
            <span className="font-bold text-emerald-400">
              +{formatUsdc(circle.totalYieldEarnedFormatted || (totalCollateralInContract * 0.0085).toFixed(2))} mUSDC
            </span>
          </div>
        </HoverHint>
      </div>
    </aside>
  );
}
