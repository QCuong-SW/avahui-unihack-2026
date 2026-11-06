'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import { CircleHeader } from './CircleHeader';
import { SmartActionBox } from './SmartActionBox';
import { CurrentRoundTab } from '@/features/contributions/components/CurrentRoundTab';
import { MembersCollateralTab } from '@/features/members/components/MembersCollateralTab';
import { RoundsHistoryTab } from '@/features/payouts/components/RoundsHistoryTab';
import { CircleTransactionsTab } from '@/features/transactions/components/CircleTransactionsTab';
import { HoverHint } from '@/components/ui/HoverHint';
import { Activity, History, Layers, Users } from 'lucide-react';

interface CircleDetailViewProps {
  circleId: string;
}

type DetailTabKey = 'CURRENT_ROUND' | 'MEMBERS' | 'ROUNDS_HISTORY' | 'TX_LOGS';

export function CircleDetailView({ circleId }: CircleDetailViewProps) {
  const { data: state, isLoading } = useAvaHuiState();
  const [activeTab, setActiveTab] = useState<DetailTabKey>('CURRENT_ROUND');

  if (isLoading || !state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-400">
        Đang tải...
      </div>
    );
  }

  const circle = state.circles.find((c) => c.id === circleId);
  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  if (!circle) {
    return (
      <div className="rounded-none border border-zinc-800 bg-surface-card p-10 text-center space-y-4">
        <h2 className="font-mono text-lg font-bold uppercase text-white">Không tìm thấy Dây hụi</h2>
        <Link
          href="/circles"
          className="inline-block rounded-none border border-avalanche-red bg-avalanche-red px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white"
        >
          Quay lại
        </Link>
      </div>
    );
  }

  const circleTxs = state.transactions.filter(
    (t) =>
      t.circleId === circle.id ||
      t.contractAddress.toLowerCase() === circle.contractAddress.toLowerCase()
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="animate-fade-down">
        <CircleHeader circle={circle} />
      </div>

      <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {/* Responsive Scrollable Tab Switcher with Hover Hints */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto rounded-none border border-zinc-800 bg-surface-card p-1.5 scrollbar-none font-mono">
            {(
              [
                {
                  key: 'CURRENT_ROUND',
                  label: `Vòng #${circle.currentRound}`,
                  hint: 'Xem tiến độ đóng tiền và lịch sử đấu giá của vòng hiện tại',
                  icon: Layers,
                },
                {
                  key: 'MEMBERS',
                  label: `Thành viên (${circle.currentMemberCount}/${circle.maxMembers})`,
                  hint: 'Danh sách các vị trí (Slots) và số dư thế chấp đang khóa',
                  icon: Users,
                },
                {
                  key: 'ROUNDS_HISTORY',
                  label: `Lịch sử (${circle.rounds.length}/${circle.totalRounds})`,
                  hint: 'Timeline kết toán và người nhận tiền qua từng vòng hụi',
                  icon: History,
                },
                {
                  key: 'TX_LOGS',
                  label: `On-Chain (${circleTxs.length})`,
                  hint: 'Nhật ký sự kiện Smart Contract trên Avalanche Fuji',
                  icon: Activity,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <HoverHint key={tab.key} hint={tab.hint} side="bottom">
                  <button
                    onClick={() => setActiveTab(tab.key)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-none border px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150 active:scale-95 whitespace-nowrap ${
                      isActive
                        ? 'border-avalanche-red bg-avalanche-red text-white shadow-sm'
                        : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                </HoverHint>
              );
            })}
          </div>

          <div className="rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-5 animate-fade-up">
            {activeTab === 'CURRENT_ROUND' && (
              <CurrentRoundTab
                circle={circle}
                currentUserAddress={currentUser.walletAddress}
              />
            )}

            {activeTab === 'MEMBERS' && (
              <MembersCollateralTab
                circle={circle}
                currentUserAddress={currentUser.walletAddress}
              />
            )}

            {activeTab === 'ROUNDS_HISTORY' && (
              <RoundsHistoryTab circle={circle} />
            )}

            {activeTab === 'TX_LOGS' && (
              <CircleTransactionsTab transactions={circleTxs} />
            )}
          </div>
        </div>

        <div className="lg:col-span-5 animate-fade-up animation-delay-100">
          <SmartActionBox circle={circle} currentUser={currentUser} />
        </div>
      </div>
    </div>
  );
}
