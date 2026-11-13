'use client';

import React from 'react';
import Link from 'next/link';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
  MemberStatus,
  RoundStatus,
} from '@avahui/shared';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import {
  ALLOCATION_MODE_META,
  CIRCLE_STATUS_META,
} from '@/lib/constants/glossary';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Gavel,
  Layers,
  Lock,
  Repeat,
  Users,
} from 'lucide-react';

interface CircleCardProps {
  circle: CircleItem;
  currentUserAddress?: string;
}

export function CircleCard({ circle, currentUserAddress }: CircleCardProps) {
  const basePot =
    parseFloat(circle.contributionAmountFormatted) * circle.maxMembers;

  const myMemberRecord = currentUserAddress
    ? circle.members.find(
        (m) =>
          m.walletAddress.toLowerCase() === currentUserAddress.toLowerCase()
      )
    : undefined;

  const activeRound = circle.rounds.find(
    (r) =>
      r.roundNumber === circle.currentRound && r.status === RoundStatus.Open
  );

  const hasPaidCurrentRound =
    myMemberRecord && activeRound
      ? activeRound.contributions.some(
          (c) =>
            c.memberAddress.toLowerCase() ===
            myMemberRecord.walletAddress.toLowerCase()
        )
      : false;

  const memberProgressPercent = Math.round(
    (circle.currentMemberCount / circle.maxMembers) * 100
  );

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5 backdrop-blur-xl shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-avalanche-red/70 hover:shadow-2xl hover:shadow-avalanche-red/10 overflow-hidden">
      {/* Top subtle highlight beam */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-avalanche-red/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div>
        {/* Top Badges Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HoverHint
              hint={
                circle.status === CircleStatus.Active
                  ? 'Đang diễn ra các vòng đóng góp & giải ngân'
                  : circle.status === CircleStatus.Recruiting
                  ? 'Đang mở tuyển thành viên & khóa thế chấp'
                  : 'Đã hoàn tất toàn bộ các vòng'
              }
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  circle.status === CircleStatus.Active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : circle.status === CircleStatus.Recruiting
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                {CIRCLE_STATUS_META[circle.status]?.label || circle.status}
              </span>
            </HoverHint>

            <HoverHint
              hint={
                ALLOCATION_MODE_META[circle.allocationMode]?.description ||
                circle.allocationMode
              }
            >
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/80 bg-zinc-900 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                {circle.allocationMode === AllocationMode.BIDDING ? (
                  <>
                    <Gavel className="h-3 w-3 text-avalanche-red" />
                    <span>{ALLOCATION_MODE_META[AllocationMode.BIDDING].shortLabel}</span>
                  </>
                ) : (
                  <>
                    <Repeat className="h-3 w-3 text-emerald-400" />
                    <span>{ALLOCATION_MODE_META[AllocationMode.FIXED].shortLabel}</span>
                  </>
                )}
              </span>
            </HoverHint>
          </div>

          <HoverHint
            hint={
              circle.contractAddress
                ? `Địa chỉ hợp đồng: ${circle.contractAddress}`
                : 'Chưa triển khai hợp đồng'
            }
          >
            <span className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
              {shortenAddress(circle.contractAddress)}
            </span>
          </HoverHint>
        </div>

        {/* Title */}
        <HoverHint
          hint={circle.description}
          position="bottom"
          className="mt-3 w-full"
        >
          <Link href={`/circles/${circle.id}`} className="block w-full">
            <h3 className="truncate font-mono text-base font-bold text-white transition-colors group-hover:text-avalanche-red">
              {circle.name}
            </h3>
          </Link>
        </HoverHint>

        {/* Financial Metrics Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-3 font-mono text-xs">
          <HoverHint hint="Số tiền mỗi thành viên đóng góp trong 1 vòng">
            <div className="w-full">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Kỳ đóng</div>
              <div className="mt-0.5 font-bold text-white">
                {formatUsdc(circle.contributionAmountFormatted)}
              </div>
            </div>
          </HoverHint>

          <HoverHint hint="Tổng quỹ giải ngân mỗi kỳ trước khi trừ chiết khấu đấu giá">
            <div className="w-full">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Tổng quỹ kỳ</div>
              <div className="mt-0.5 font-bold text-emerald-400">
                {formatUsdc(basePot)}
              </div>
            </div>
          </HoverHint>

          <HoverHint hint="Tài sản thế chấp khóa khi tham gia dây hụi">
            <div className="w-full">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Thế chấp</div>
              <div className="mt-0.5 font-bold text-amber-300">
                {formatUsdc(circle.collateralAmountFormatted)}
              </div>
            </div>
          </HoverHint>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-zinc-400 uppercase tracking-wider text-[11px]">
              {circle.status === CircleStatus.Recruiting ? (
                <>
                  <Users className="h-3.5 w-3.5 text-amber-400" />
                  <span>Thành viên</span>
                </>
              ) : (
                <>
                  <Layers className="h-3.5 w-3.5 text-avalanche-red" />
                  <span>Vòng</span>
                </>
              )}
            </span>

            <span className="font-bold text-zinc-200">
              {circle.status === CircleStatus.Recruiting
                ? `${circle.currentMemberCount} / ${circle.maxMembers}`
                : `${circle.currentRound} / ${circle.totalRounds}`}
            </span>
          </div>

          <div className="h-1.5 w-full rounded-full bg-zinc-800/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                circle.status === CircleStatus.Recruiting
                  ? 'bg-amber-400'
                  : circle.status === CircleStatus.Completed
                  ? 'bg-sky-400'
                  : 'bg-gradient-to-r from-avalanche-red to-red-500'
              }`}
              style={{
                width:
                  circle.status === CircleStatus.Recruiting
                    ? `${memberProgressPercent}%`
                    : `${Math.round(
                        (circle.currentRound / circle.totalRounds) * 100
                      )}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom User Status & CTA */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-800/80 pt-3">
        <div className="font-mono text-xs">
          {myMemberRecord ? (
            <div className="flex items-center gap-1.5">
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-200">
                #{myMemberRecord.slotIndex}
              </span>
              {circle.status === CircleStatus.Active && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    hasPaidCurrentRound
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                      : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {hasPaidCurrentRound ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Đã đóng</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>Chưa đóng</span>
                    </>
                  )}
                </span>
              )}
              {circle.status === CircleStatus.Completed && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                  <Lock className="h-3 w-3" />
                  <span>
                    {myMemberRecord.status === MemberStatus.Withdrawn
                      ? 'Đã rút'
                      : 'Chờ rút'}
                  </span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500">
              {circle.status === CircleStatus.Recruiting
                ? `Trống ${
                    circle.maxMembers - circle.currentMemberCount
                  } slot`
                : 'Khách'}
            </span>
          )}
        </div>

        <Link
          href={`/circles/${circle.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:border-avalanche-red hover:bg-avalanche-red shadow-sm active:scale-95"
        >
          <span>
            {circle.status === CircleStatus.Recruiting && !myMemberRecord
              ? 'Tham gia'
              : 'Mở'}
          </span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
