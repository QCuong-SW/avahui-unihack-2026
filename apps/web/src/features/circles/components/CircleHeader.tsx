'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
} from '@avahui/shared';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import { useCircleActions } from '@/hooks/useCircleActions';
import {
  ArrowLeft,
  Check,
  Clock,
  Coins,
  ExternalLink,
  Gavel,
  Layers,
  Link2,
  Lock,
  Repeat,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

interface CircleHeaderProps {
  circle: CircleItem;
}

export function CircleHeader({ circle }: CircleHeaderProps) {
  const { generateInviteVoucherLink } = useCircleActions();
  const [copiedInvite, setCopiedInvite] = useState(false);
  const basePot =
    parseFloat(circle.contributionAmountFormatted) * circle.maxMembers;

  const handleCopyInviteVoucher = () => {
    const { inviteUrl } = generateInviteVoucherLink(circle);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl).catch(() => {});
    }
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
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
            <HoverHint hint="V2 Sealed-Bid Commit-Reveal: Mã hóa giá đấu bằng Keccak256 + Salt chống lộ giá trên Mempool">
              <span className="inline-flex items-center gap-1 rounded-none border border-avalanche-red/40 bg-avalanche-red/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-avalanche-red">
                <Lock className="h-3 w-3" />
                <span>SEALED-BID</span>
              </span>
            </HoverHint>
          )}

          {(circle.isYieldEnabled ?? true) && (
            <HoverHint hint="V2 ERC-4626 Yield Vault: Thế chấp nhàn rỗi đang tự động sinh lãi 8.0% APY và chia đều cuối kỳ">
              <span className="inline-flex items-center gap-1 rounded-none border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                <Sparkles className="h-3 w-3" />
                <span>YIELD 8% APY</span>
              </span>
            </HoverHint>
          )}

          {(circle.requiresAttestation ?? true) && (
            <HoverHint hint="V2 Team1 Attestation Verifier: Chống tấn công Sybil bằng mã băm định danh duy nhất (Identity Nullifier)">
              <span className="inline-flex items-center gap-1 rounded-none border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-sky-400">
                <ShieldCheck className="h-3 w-3" />
                <span>TEAM1 SYBIL-SAFE</span>
              </span>
            </HoverHint>
          )}

          <HoverHint hint="Tạo và sao chép đường dẫn vé mời chữ ký số EIP-712 dùng 1 lần (Stateless Off-chain Invite Voucher)">
            <button
              type="button"
              onClick={handleCopyInviteVoucher}
              className="inline-flex items-center gap-1.5 rounded-none border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-200 transition hover:border-emerald-400 hover:text-emerald-300"
            >
              {copiedInvite ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied EIP-712 Link!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 text-amber-400" />
                  <span>Invite Link</span>
                </>
              )}
            </button>
          </HoverHint>
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
