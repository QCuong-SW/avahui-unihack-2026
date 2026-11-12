'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
} from '@avahui/shared';
import { formatUsdc, getSavedCreatorInviteCode, shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  ArrowLeft,
  Check,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Gavel,
  Layers,
  Lock,
  Repeat,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

interface CircleHeaderProps {
  circle: CircleItem;
}

export function CircleHeader({ circle }: CircleHeaderProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showInviteBox, setShowInviteBox] = useState(false);
  const savedInviteCode =
    circle.inviteCode ||
    getSavedCreatorInviteCode(circle.id, circle.metadataId, circle.contractAddress) ||
    '';
  const [manualInviteCode, setManualInviteCode] = useState(savedInviteCode);

  const basePot =
    parseFloat(circle.contributionAmountFormatted) * circle.maxMembers;
  const effectiveInviteCode = (manualInviteCode || savedInviteCode).trim();

  const getInviteUrl = () => {
    const base =
      typeof window === 'undefined'
        ? `http://localhost:3000/circles/${circle.id}`
        : `${window.location.origin}/circles/${circle.id}`;
    if (!circle.isPrivateInvite || !effectiveInviteCode) {
      return base;
    }
    return `${base}?invite=${encodeURIComponent(effectiveInviteCode)}`;
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  };

  return (
    <section className="rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-6 shadow-xl">
      {/* Top Row: Back & Explorer */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3.5">
        <Link
          href="/circles"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Circles</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <HoverHint hint="Mời thành viên tham gia dây hụi qua đường dẫn có mã xác thực On-Chain (Invite Code)">
            <button
              type="button"
              onClick={() => setShowInviteBox((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500 hover:text-zinc-950"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Invite Link</span>
            </button>
          </HoverHint>

          {circle.contractAddress && (
            <HoverHint hint="Mở hợp đồng thông minh trên Snowtrace Fuji Explorer">
              <a
                href={`${frontendEnv.explorerUrl}/address/${circle.contractAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-none border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-300 transition hover:border-avalanche-red hover:text-white"
              >
                <span>{shortenAddress(circle.contractAddress, 6)}</span>
                <ExternalLink className="h-3.5 w-3.5 text-avalanche-red" />
              </a>
            </HoverHint>
          )}
        </div>
      </div>

      {/* Expandable Invite Link Drawer */}
      {showInviteBox && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 font-mono text-xs animate-fade-in">
          <div className="flex flex-wrap items-center gap-2">
            {circle.isPrivateInvite && (
              <>
                <span className="font-bold uppercase text-emerald-300">
                  Invite Code:
                </span>
                <input
                  type="text"
                  value={manualInviteCode}
                  onChange={(e) => setManualInviteCode(e.target.value)}
                  placeholder="Nhập mã mời thật..."
                  className="w-40 rounded-none border border-emerald-500/40 bg-zinc-950 px-2 py-0.5 font-bold text-white focus:border-emerald-300 focus:outline-none"
                />
              </>
            )}
            <span className="text-zinc-300 break-all">{getInviteUrl()}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyInvite}
            className="inline-flex items-center gap-1.5 rounded-none border border-emerald-400 bg-emerald-500 px-3 py-1 font-mono text-xs font-bold uppercase text-zinc-950 transition hover:bg-emerald-400"
          >
            {copiedInvite ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Title & Status Badges */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <HoverHint
          hint={circle.description}
          position="bottom"
          className="max-w-full"
        >
          <h1 className="font-mono text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            {circle.name}
          </h1>
        </HoverHint>

        <div className="flex flex-wrap items-center gap-2">
          <HoverHint
            hint={
              circle.status === CircleStatus.Active
                ? 'Đang mở đóng góp và giải ngân theo kỳ'
                : circle.status === CircleStatus.Recruiting
                ? 'Đang gom đủ thành viên để tự động mở Vòng #1'
                : 'Dây hụi đã hoàn tất toàn bộ các kỳ'
            }
          >
            <span
              className={`inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                circle.status === CircleStatus.Active
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  : circle.status === CircleStatus.Recruiting
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : 'border-sky-500/40 bg-sky-500/15 text-sky-400'
              }`}
            >
              <span className="h-1.5 w-1.5 bg-current" />
              {circle.status}
            </span>
          </HoverHint>

          {circle.isPaused && (
            <HoverHint hint="Dây hụi đang tạm dừng bởi Guardian trên Smart Contract">
              <span className="inline-flex items-center gap-1.5 rounded-none border border-rose-500/50 bg-rose-500/15 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-rose-300">
                <Lock className="h-3 w-3" />
                <span>PAUSED</span>
              </span>
            </HoverHint>
          )}

          <HoverHint
            hint={
              circle.allocationMode === AllocationMode.BIDDING
                ? 'Chế độ Đấu giá chiết khấu: Ai đặt chiết khấu cao nhất nhận quỹ trước'
                : 'Chế độ Cố định: Nhận quỹ lần lượt từ Slot #1 đến Slot #N'
            }
          >
            <span className="inline-flex items-center gap-1.5 rounded-none border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200">
              {circle.allocationMode === AllocationMode.BIDDING ? (
                <>
                  <Gavel className="h-3.5 w-3.5 text-avalanche-red" />
                  <span>BIDDING</span>
                </>
              ) : (
                <>
                  <Repeat className="h-3.5 w-3.5 text-emerald-400" />
                  <span>FIXED</span>
                </>
              )}
            </span>
          </HoverHint>

          <HoverHint
            hint={`Thời lượng vòng: ${circle.roundDurationSeconds}s • Ân hạn: ${circle.gracePeriodSeconds}s`}
          >
            <span className="inline-flex items-center gap-1 rounded-none border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-zinc-500" />
              <span>{circle.roundDurationSeconds}s</span>
            </span>
          </HoverHint>

          {circle.allocationMode === AllocationMode.BIDDING && (
            <HoverHint hint="Đấu giá kín 2 pha Commit-Reveal bằng mã băm keccak256 chống nhìn trộm trên Mempool">
              <span className="inline-flex items-center gap-1 rounded-none border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-sky-300">
                <Lock className="h-3.5 w-3.5 text-sky-400" />
                <span>Sealed-Bid</span>
              </span>
            </HoverHint>
          )}

          {circle.enableYieldVault !== false && (
            <HoverHint hint="Tài sản thế chấp và quỹ chưa giải ngân tự động sinh lãi 6.50% APY trong ERC-4626 Vault">
              <span className="inline-flex items-center gap-1 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>6.5% APY Vault</span>
              </span>
            </HoverHint>
          )}

          {circle.requireTeam1Attestation !== false && (
            <HoverHint hint="Bảo vệ chống Sybil bằng chứng thực định danh Team1 (1-Human-1-Slot)">
              <span className="inline-flex items-center gap-1 rounded-none border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
                <span>Team1 Verified</span>
              </span>
            </HoverHint>
          )}
        </div>
      </div>

      {/* 4 Compact Financial Metrics */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono">
        <HoverHint
          hint={`Số tiền cố định đóng mỗi vòng xuyên suốt ${circle.totalRounds} vòng`}
          className="w-full"
        >
          <div className="w-full rounded-none border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider">
              <span>Mức đóng / Kỳ</span>
              <Coins className="h-4 w-4 text-avalanche-red" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold text-white">
              {formatUsdc(circle.contributionAmountFormatted)}{' '}
              <span className="text-xs font-normal text-zinc-400">
                {circle.tokenSymbol}
              </span>
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint={`${circle.maxMembers} thành viên × ${formatUsdc(circle.contributionAmountFormatted)} mUSDC`}
          className="w-full"
        >
          <div className="w-full rounded-none border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider">
              <span>Gross Pot / Vòng</span>
              <Layers className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold text-emerald-400">
              {formatUsdc(basePot)}{' '}
              <span className="text-xs font-normal text-zinc-400">
                {circle.tokenSymbol}
              </span>
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint="Khóa khi tham gia dây hụi • Hoàn trả khi kết thúc"
          className="w-full"
        >
          <div className="w-full rounded-none border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider">
              <span>Thế chấp khóa</span>
              <Lock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-1.5 text-xl font-extrabold text-amber-300">
              {formatUsdc(circle.collateralAmountFormatted)}{' '}
              <span className="text-xs font-normal text-zinc-400">
                {circle.tokenSymbol}
              </span>
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint={`Quỹ lời chiết khấu tích lũy: ${formatUsdc(circle.totalDiscountPoolFormatted)} mUSDC`}
          className="w-full"
        >
          <div className="w-full rounded-none border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 uppercase tracking-wider">
              <span>
                {circle.status === CircleStatus.Recruiting
                  ? 'Thành viên'
                  : 'Tiến độ Vòng'}
              </span>
              {circle.status === CircleStatus.Recruiting ? (
                <Users className="h-4 w-4 text-amber-400" />
              ) : (
                <Sparkles className="h-4 w-4 text-sky-400" />
              )}
            </div>
            <div className="mt-1.5 text-xl font-extrabold text-white">
              {circle.status === CircleStatus.Recruiting
                ? `${circle.currentMemberCount} / ${circle.maxMembers}`
                : `${circle.currentRound} / ${circle.totalRounds}`}
            </div>
          </div>
        </HoverHint>
      </div>
    </section>
  );
}
