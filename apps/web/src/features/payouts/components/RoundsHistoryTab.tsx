'use client';

import React from 'react';
import {
  AllocationMode,
  CircleItem,
  RoundStatus,
} from '@avahui/shared';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Gavel,
  ShieldAlert,
  Trophy,
} from 'lucide-react';

interface RoundsHistoryTabProps {
  circle: CircleItem;
}

export function RoundsHistoryTab({ circle }: RoundsHistoryTabProps) {
  const allRoundNumbers = Array.from(
    { length: circle.totalRounds },
    (_, i) => i + 1
  );

  const basePot =
    parseFloat(circle.contributionAmountFormatted) * circle.maxMembers;

  return (
    <div className="space-y-4">
      {circle.allocationMode === AllocationMode.BIDDING && (
        <div className="flex items-center justify-end">
          <HoverHint
            hint="Tổng tiền chiết khấu tích lũy từ các vòng đấu giá, chia đều cho mọi thành viên khi hoàn tất dây hụi"
            side="left"
          >
            <div className="cursor-help rounded-none border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
              Quỹ Lời Chiết Khấu: {formatUsdc(circle.totalDiscountPoolFormatted)}{' '}
              mUSDC
            </div>
          </HoverHint>
        </div>
      )}

      <div className="space-y-2.5">
        {allRoundNumbers.map((rNum) => {
          const round = circle.rounds.find((r) => r.roundNumber === rNum);

          if (!round) {
            return (
              <HoverHint
                key={rNum}
                hint={`Tự động mở ngay sau khi Vòng #${rNum - 1} kết toán xong`}
                side="top"
                className="flex w-full"
              >
                <div className="flex w-full items-center justify-between rounded-none border border-zinc-800/70 bg-zinc-950/40 p-3.5 font-mono text-xs text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-none bg-zinc-900 font-mono font-bold text-zinc-500">
                      #{rNum}
                    </span>
                    <span className="font-bold uppercase tracking-wider text-zinc-400">
                      Vòng #{rNum} • Chờ mở
                    </span>
                  </div>
                  <div className="font-mono">
                    {formatUsdc(basePot)} mUSDC
                  </div>
                </div>
              </HoverHint>
            );
          }

          const slashedInRound = round.contributions.filter(
            (c) => c.isFromCollateralSlash
          );

          return (
            <div
              key={rNum}
              className={`rounded-none border p-4 transition ${
                round.status === RoundStatus.Settled
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-avalanche-red/50 bg-avalanche-red/10'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-none font-mono text-xs font-extrabold ${
                      round.status === RoundStatus.Settled
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-avalanche-red text-white'
                    }`}
                  >
                    #{rNum}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-none px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                          round.status === RoundStatus.Settled
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {round.status === RoundStatus.Settled ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>SETTLED</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>OPEN</span>
                          </>
                        )}
                      </span>

                      {slashedInRound.length > 0 && (
                        <HoverHint
                          hint={`Đã trích thế chấp của ${slashedInRound.length} thành viên trễ hạn để bù đủ quỹ vòng này`}
                          side="top"
                        >
                          <span className="inline-flex items-center gap-1 rounded-none bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
                            <ShieldAlert className="h-3 w-3" />
                            <span>Slashed ({slashedInRound.length})</span>
                          </span>
                        </HoverHint>
                      )}
                    </div>

                    {round.winnerName ? (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-200">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        <strong className="text-white">
                          {round.winnerName}
                        </strong>
                        {round.settlementTxHash && (
                          <HoverHint hint="Xem giao dịch kết toán trên Snowtrace" side="top">
                            <a
                              href={`${frontendEnv.explorerUrl}/tx/${round.settlementTxHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 font-mono text-[10px] text-avalanche-red hover:underline"
                            >
                              <span>{shortenAddress(round.settlementTxHash, 4)}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </HoverHint>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 font-mono text-xs text-zinc-400 uppercase tracking-wider">
                        Đã đóng: {round.contributionsCount}/{circle.maxMembers}
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="flex items-center gap-4 text-right font-mono text-xs">
                  {circle.allocationMode === AllocationMode.BIDDING && (
                    <HoverHint hint="Mức chiết khấu thắng cuộc" side="top">
                      <div>
                        <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider text-zinc-400">
                          <Gavel className="h-2.5 w-2.5 text-avalanche-red" />
                          <span>Bid</span>
                        </div>
                        <div className="font-bold text-avalanche-red">
                          -{formatUsdc(round.winningBidFormatted)}
                        </div>
                      </div>
                    </HoverHint>
                  )}

                  <HoverHint
                    hint={`Quỹ gốc: ${formatUsdc(round.grossPotFormatted)} mUSDC`}
                    side="top"
                  >
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-400">Payout</div>
                      <div className="text-sm font-extrabold text-emerald-400">
                        {formatUsdc(round.netPayoutFormatted)} mUSDC
                      </div>
                    </div>
                  </HoverHint>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
