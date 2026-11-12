'use client';

import React from 'react';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
} from '@avahui/shared';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Gavel,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';
import { frontendEnv } from '@/config/env';

interface CurrentRoundTabProps {
  circle: CircleItem;
  currentUserAddress: string;
}

export function CurrentRoundTab({
  circle,
  currentUserAddress,
}: CurrentRoundTabProps) {
  if (circle.status === CircleStatus.Recruiting) {
    return (
      <HoverHint
        hint={`Khi đủ ${circle.maxMembers} thành viên khóa thế chấp, hợp đồng tự động chuyển sang ACTIVE và mở Vòng #1`}
        side="top"
        className="flex w-full"
      >
        <div className="w-full rounded-none border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <Users className="mx-auto h-7 w-7 text-amber-400" />
          <h3 className="mt-2 font-mono text-sm font-bold uppercase tracking-wider text-white">
            Đang tuyển thành viên ({circle.currentMemberCount} / {circle.maxMembers})
          </h3>
        </div>
      </HoverHint>
    );
  }

  const currentRoundObj =
    circle.rounds.find((r) => r.roundNumber === circle.currentRound) ||
    circle.rounds[circle.rounds.length - 1];

  if (!currentRoundObj) {
    return (
      <div className="rounded-none border border-zinc-800 bg-zinc-900/40 p-6 text-center font-mono text-xs uppercase tracking-wider text-zinc-400">
        Đã hoàn tất toàn bộ vòng hụi.
      </div>
    );
  }

  const paidPercent = Math.round(
    (currentRoundObj.contributionsCount / circle.maxMembers) * 100
  );

  const highestBidItem =
    currentRoundObj.bids.length > 0
      ? [...currentRoundObj.bids].sort(
          (a, b) =>
            parseFloat(b.bidAmountFormatted) - parseFloat(a.bidAmountFormatted)
        )[0]
      : null;

  const fixedRecipient =
    circle.allocationMode === AllocationMode.FIXED
      ? circle.members.find((m) => m.slotIndex === currentRoundObj.roundNumber)
      : null;

  return (
    <div className="space-y-5">
      {/* Compact Round Summary Row */}
      <div className="grid gap-3 rounded-none border border-zinc-800 bg-zinc-900/60 p-4 sm:grid-cols-3">
        <HoverHint
          hint="Số lượng thành viên đã hoàn tất đóng tiền trực tiếp trong vòng này"
          side="top"
          className="flex"
        >
          <div className="w-full">
            <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Tiến độ Vòng #{currentRoundObj.roundNumber}
            </div>
            <div className="mt-1 font-mono text-lg font-extrabold text-white">
              {currentRoundObj.contributionsCount}/{circle.maxMembers}
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-none bg-zinc-800">
              <div
                className="h-full rounded-none bg-emerald-400 transition-all"
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint={
            circle.allocationMode === AllocationMode.BIDDING
              ? 'Thành viên đặt mức chiết khấu cao nhất sẽ thắng quyền nhận quỹ vòng này'
              : 'Thành viên nhận quỹ theo đúng thứ tự Slot đã đăng ký'
          }
          side="top"
          className="flex"
        >
          <div className="w-full">
            <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              {circle.allocationMode === AllocationMode.BIDDING
                ? 'Dẫn đầu đấu giá'
                : 'Người nhận theo thứ tự'}
            </div>
            <div className="mt-1 font-mono text-sm font-bold text-white">
              {circle.allocationMode === AllocationMode.BIDDING ? (
                highestBidItem ? (
                  <>
                    <div className="truncate">{highestBidItem.bidderName}</div>
                    <div className="text-xs font-semibold text-avalanche-red">
                      -{formatUsdc(highestBidItem.bidAmountFormatted)} mUSDC
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-zinc-400">Chưa có lượt đặt giá</span>
                )
              ) : (
                <>
                  <div className="truncate">
                    #{currentRoundObj.roundNumber}{' '}
                    {fixedRecipient?.displayName || 'Chưa xác định'}
                  </div>
                  <div className="text-[11px] text-emerald-400">100% Tổng quỹ</div>
                </>
              )}
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint={`Tổng Quỹ gốc: ${formatUsdc(currentRoundObj.grossPotFormatted)} mUSDC trừ đi phần chiết khấu`}
          side="top"
          className="flex"
        >
          <div className="w-full">
            <div className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">Giải ngân Dự kiến</div>
            <div className="mt-1 font-mono text-lg font-extrabold text-emerald-400">
              {formatUsdc(currentRoundObj.netPayoutFormatted)}{' '}
              <span className="text-xs font-semibold">mUSDC</span>
            </div>
          </div>
        </HoverHint>
      </div>

      {/* Member Contribution Checklist */}
      <div className="space-y-2.5">
        <div className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
          Đóng góp Vòng #{currentRoundObj.roundNumber}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {circle.members.map((member) => {
            const contrib = currentRoundObj.contributions.find(
              (c) =>
                c.memberAddress.toLowerCase() ===
                member.walletAddress.toLowerCase()
            );
            const isMe =
              member.walletAddress.toLowerCase() ===
              currentUserAddress.toLowerCase();

            return (
              <div
                key={member.slotIndex}
                className={`flex items-center justify-between rounded-none border p-3 font-mono text-xs ${
                  contrib
                    ? contrib.isFromCollateralSlash
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : 'border-emerald-500/30 bg-emerald-500/5'
                    : isMe
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-zinc-800 bg-zinc-900/50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <span className="text-zinc-400">
                      #{member.slotIndex}
                    </span>
                    <span className="font-sans font-bold">{member.displayName}</span>
                    {isMe && (
                      <span className="rounded-none bg-avalanche-red px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                        BẠN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {shortenAddress(member.walletAddress)}
                  </div>
                </div>

                <div className="text-right">
                  {contrib ? (
                    contrib.isFromCollateralSlash ? (
                      <HoverHint
                        hint="Thành viên trễ hạn: hợp đồng đã tự động trích thế chấp bù vào quỹ"
                        side="left"
                      >
                        <span className="inline-flex items-center gap-1 font-bold text-rose-400">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Đã trích thế chấp</span>
                        </span>
                      </HoverHint>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{formatUsdc(contrib.amountFormatted)}</span>
                        </span>
                        <HoverHint hint="Xem giao dịch trên Snowtrace" side="left">
                          <a
                            href={`${frontendEnv.explorerUrl}/tx/${contrib.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-zinc-400 hover:text-white"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </HoverHint>
                      </div>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-none bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                      <Clock className="h-3 w-3" />
                      <span>Chờ</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Bid Feed */}
      {circle.allocationMode === AllocationMode.BIDDING && (
        <div className="space-y-2.5 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
              <Gavel className="h-3.5 w-3.5 text-avalanche-red" />
              <span>Đấu giá Vòng #{currentRoundObj.roundNumber}</span>
            </span>
            <HoverHint
              hint="Giới hạn mức chiết khấu tối thiểu và tối đa cho phép trong mỗi kỳ"
              side="left"
            >
              <span className="cursor-help font-mono text-[11px] text-zinc-400">
                {formatUsdc(circle.minBidFormatted)} –{' '}
                {formatUsdc(circle.maxBidFormatted)} mUSDC
              </span>
            </HoverHint>
          </div>

          {currentRoundObj.bids.length === 0 ? (
            <div className="rounded-none border border-zinc-800 bg-zinc-900/40 p-3.5 text-center font-mono text-xs uppercase tracking-wider text-zinc-500">
              Chưa có lượt đặt giá.
            </div>
          ) : (
            <div className="space-y-2">
              {[...currentRoundObj.bids]
                .sort(
                  (a, b) =>
                    parseFloat(b.bidAmountFormatted) -
                    parseFloat(a.bidAmountFormatted)
                )
                .map((bid, idx) => (
                  <div
                    key={`${bid.txHash}_${idx}`}
                    className={`flex items-center justify-between rounded-none border p-2.5 text-xs ${
                      idx === 0
                        ? 'border-avalanche-red/50 bg-avalanche-red/10'
                        : 'border-zinc-800 bg-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-none bg-avalanche-red px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                          <Sparkles className="h-2.5 w-2.5" />
                          TOP
                        </span>
                      )}
                      <span className="font-bold text-white">
                        {bid.bidderName}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="font-bold text-avalanche-red">
                        -{formatUsdc(bid.bidAmountFormatted)}
                      </span>
                      <span className="text-emerald-400">
                        Nhận{' '}
                        {formatUsdc(
                          parseFloat(currentRoundObj.grossPotFormatted) -
                            parseFloat(bid.bidAmountFormatted)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
