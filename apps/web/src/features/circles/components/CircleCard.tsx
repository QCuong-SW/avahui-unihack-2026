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
    <div className="group flex flex-col justify-between rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-5 shadow-lg transition-all duration-200 hover:-translate-y-1 hover:border-avalanche-red/80 hover:shadow-xl hover:shadow-avalanche-red/5">
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
                className={`inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  circle.status === CircleStatus.Active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : circle.status === CircleStatus.Recruiting
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                    : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                }`}
              >
                <span className="h-1 w-1 bg-current" />
                {circle.status}
              </span>
            </HoverHint>

            <HoverHint
              hint={
                circle.allocationMode === AllocationMode.BIDDING
                  ? 'Đấu giá chiết khấu: Ai đặt chiết khấu cao nhất được nhận quỹ trước'
                  : 'Xoay vòng cố định: Nhận quỹ lần lượt theo vị trí Slot #1 -> Slot #N'
              }
            >
              <span className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                {circle.allocationMode === AllocationMode.BIDDING ? (
                  <>
                    <Gavel className="h-3 w-3 text-avalanche-red" />
                    <span>BIDDING</span>
                  </>
                ) : (
                  <>
                    <Repeat className="h-3 w-3 text-emerald-400" />
                    <span>FIXED</span>
                  </>
                )}
              </span>
            </HoverHint>
          </div>

          <HoverHint
            hint={
              circle.contractAddress
                ? `Contract: ${circle.contractAddress}`
                : 'Chưa triển khai hợp đồng'
            }
          >
            <span className="font-mono text-[11px] text-zinc-500">
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
            <h3 className="truncate font-mono text-base font-bold text-white transition group-hover:text-avalanche-red">
              {circle.name}
            </h3>
          </Link>
        </HoverHint>

        {/* Financial Metrics Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-none border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs">
          <HoverHint hint="Số tiền mỗi thành viên đóng góp trong 1 vòng">
            <div className="w-full">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Kỳ đóng</div>
              <div className="mt-0.5 font-bold text-white">
                {formatUsdc(circle.contributionAmountFormatted)}
              </div>
            </div>
          </HoverHint>

          <HoverHint hint="Tổng quỹ giải ngân mỗi vòng (Gross Pot)">
            <div className="w-full">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Tổng Quỹ</div>
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

          <div className="h-1.5 w-full rounded-none bg-zinc-800">
            <div
              className={`h-full rounded-none transition-all ${
                circle.status === CircleStatus.Recruiting
                  ? 'bg-amber-400'
                  : circle.status === CircleStatus.Completed
                  ? 'bg-sky-400'
                  : 'bg-avalanche-red'
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
              <span className="rounded-none border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-zinc-200">
                #{myMemberRecord.slotIndex}
              </span>
              {circle.status === CircleStatus.Active && (
                <span
                  className={`inline-flex items-center gap-1 rounded-none border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
                <span className="inline-flex items-center gap-1 rounded-none border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
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
          className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:border-avalanche-red hover:bg-avalanche-red"
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
