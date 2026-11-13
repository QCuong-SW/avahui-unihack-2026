'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import {
  CircleStatus,
  MemberStatus,
  RoundStatus,
} from '@avahui/shared';
import { computeWithdrawBreakdown, formatUsdc } from '@/lib/utils';
import { CircleCard } from './CircleCard';
import { HoverHint } from '@/components/ui/HoverHint';
import { useInteractiveTour } from '@/features/guide/context/InteractiveTourContext';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Compass,
  Layers,
  Lock,
  Play,
  PlusCircle,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';

type MyCircleTab = 'ALL' | 'ACTIVE' | 'RECRUITING' | 'COMPLETED';
const QUICKSTART_STORAGE_KEY = 'avahui_hide_quickstart_v1';

export function DashboardView() {
  const { data: state, isLoading } = useAvaHuiState();
  const tour = useInteractiveTour();
  const [activeTab, setActiveTab] = useState<MyCircleTab>('ALL');
  const [quickstartDismissed, setQuickstartDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(QUICKSTART_STORAGE_KEY) === '1') {
        setQuickstartDismissed(true);
      }
    } catch {
      // ignore storage errors in restricted environments
    }
  }, []);

  if (isLoading || !state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-mono text-xs text-zinc-400">
        Đang tải tổng quan tài chính...
      </div>
    );
  }

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const myCircles = state.circles.filter((c) =>
    c.members.some(
      (m) =>
        m.walletAddress.toLowerCase() ===
        currentUser.walletAddress.toLowerCase()
    )
  );

  const openRecruitingCircles = state.circles.filter(
    (c) =>
      c.status === CircleStatus.Recruiting &&
      !c.members.some(
        (m) =>
          m.walletAddress.toLowerCase() ===
          currentUser.walletAddress.toLowerCase()
      )
  );

  const actionItems = (() => {
    const items: Array<{
      id: string;
      circleId: string;
      type: 'UNPAID_ROUND' | 'WITHDRAW_READY';
      title: string;
      hint: string;
      amountLabel: string;
    }> = [];

    for (const circle of myCircles) {
      const me = circle.members.find(
        (m) =>
          m.walletAddress.toLowerCase() ===
          currentUser.walletAddress.toLowerCase()
      );
      if (!me) continue;

      if (circle.status === CircleStatus.Active) {
        const currentR = circle.rounds.find(
          (r) =>
            r.roundNumber === circle.currentRound &&
            r.status === RoundStatus.Open
        );
        if (currentR) {
          const paid = currentR.contributions.some(
            (c) =>
              c.memberAddress.toLowerCase() ===
              currentUser.walletAddress.toLowerCase()
          );
          if (!paid) {
            items.push({
              id: `${circle.id}_r${currentR.roundNumber}`,
              circleId: circle.id,
              type: 'UNPAID_ROUND',
              title: `${circle.name} • Vòng #${currentR.roundNumber}`,
              hint: 'Đóng tiền kỳ hiện tại để tránh bị trích tài sản thế chấp',
              amountLabel: `${formatUsdc(circle.contributionAmountFormatted)} mUSDC`,
            });
          }
        }
      }

      if (
        circle.status === CircleStatus.Completed &&
        me.status !== MemberStatus.Withdrawn
      ) {
        const { collateralUsdc, discountBonusUsdc, yieldBonusUsdc, totalClaimableUsdc } =
          computeWithdrawBreakdown(circle, me);
        const totalBonus = discountBonusUsdc + yieldBonusUsdc;
        items.push({
          id: `${circle.id}_withdraw`,
          circleId: circle.id,
          type: 'WITHDRAW_READY',
          title: `${circle.name} • Rút Thế chấp`,
          hint: `Gốc ${formatUsdc(collateralUsdc)} + Lời & Yield ${formatUsdc(totalBonus)} mUSDC`,
          amountLabel: `+${formatUsdc(totalClaimableUsdc)} mUSDC`,
        });
      }
    }

    return items;
  })();

  const filteredMyCircles = myCircles.filter((c) => {
    if (activeTab === 'ACTIVE') return c.status === CircleStatus.Active;
    if (activeTab === 'RECRUITING') return c.status === CircleStatus.Recruiting;
    if (activeTab === 'COMPLETED') return c.status === CircleStatus.Completed;
    return true;
  });

  return (
    <div className="space-y-6 sm:space-y-7 animate-fade-in">
      {/* 1. Header + Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 animate-fade-down">
        <div>
          <h1 className="font-mono text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            Tổng quan tài chính
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Theo dõi dòng tiền, tài sản thế chấp và kỳ góp hụi của bạn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={() => tour.startTour()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-amber-200 shadow-sm transition hover:bg-amber-500 hover:text-zinc-950 active:scale-95"
          >
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Hướng dẫn trực tiếp</span>
          </button>

          <Link
            href="/guide"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 shadow-sm transition hover:border-zinc-500 hover:text-white active:scale-95"
          >
            <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-400" />
            <span>Hướng dẫn</span>
          </Link>

          <Link
            href="/circles"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200 shadow-sm transition hover:border-zinc-500 active:scale-95"
          >
            <Compass className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
            <span>Khám phá</span>
          </Link>

          <Link
            href="/circles/create"
            className="inline-flex items-center gap-1.5 rounded-lg border border-avalanche-red bg-gradient-to-r from-avalanche-red to-red-600 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-avalanche-red/25 transition hover:brightness-110 active:scale-95"
          >
            <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Mở dây mới</span>
          </Link>
        </div>
      </div>

      {/* Onboarding Quickstart Checklist for new users */}
      {!quickstartDismissed &&
        (parseFloat(currentUser.usdcBalance || '0') < 10 || myCircles.length === 0) && (
          <section className="relative rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-5 space-y-3 backdrop-blur-xl shadow-lg overflow-hidden animate-fade-in">
            {/* Top Sky Accent Beam */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80" />

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 font-mono text-xs font-extrabold uppercase tracking-wider text-sky-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Bắt đầu nhanh với AvaHui (3 bước)</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Hoàn tất 3 bước sau để tham gia dây hụi đầu tiên hoặc xem{' '}
                  <Link href="/guide" className="font-bold text-sky-300 underline hover:text-white">
                    Hướng dẫn chi tiết A–Z
                  </Link>
                  .
                </p>
              </div>
              <button
                type="button"
                aria-label="Ẩn hướng dẫn nhanh"
                onClick={() => {
                  setQuickstartDismissed(true);
                  try {
                    localStorage.setItem(QUICKSTART_STORAGE_KEY, '1');
                  } catch {
                    // ignore
                  }
                }}
                className="rounded-md border border-zinc-800 p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid gap-2.5 md:grid-cols-3 font-mono text-xs">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/70 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      parseFloat(currentUser.avaxBalance || '0') >= 0.005
                        ? 'text-emerald-400'
                        : 'text-zinc-500'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-white">1. Có ví &amp; Gas AVAX</div>
                    <div className="text-[11px] text-zinc-400">
                      Hiện có: {parseFloat(currentUser.avaxBalance || '0').toFixed(4)} AVAX
                    </div>
                  </div>
                </div>
                <Link href="/profile" className="text-[11px] font-bold text-sky-300 hover:underline">
                  Kiểm tra →
                </Link>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/70 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      parseFloat(currentUser.usdcBalance || '0') >= 10
                        ? 'text-emerald-400'
                        : 'text-zinc-500'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-white">2. Nhận vốn mUSDC</div>
                    <div className="text-[11px] text-zinc-400">
                      Bấm nút Faucet trên thanh ví
                    </div>
                  </div>
                </div>
                <Link href="/profile" className="text-[11px] font-bold text-sky-300 hover:underline">
                  Ví của tôi →
                </Link>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/70 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${
                      myCircles.length > 0 ? 'text-emerald-400' : 'text-zinc-500'
                    }`}
                  />
                  <div>
                    <div className="font-bold text-white">3. Tham gia / Mở dây</div>
                    <div className="text-[11px] text-zinc-400">
                      Đang giữ {myCircles.length} dây hụi
                    </div>
                  </div>
                </div>
                <Link href="/circles" className="text-[11px] font-bold text-avalanche-red hover:underline">
                  Khám phá →
                </Link>
              </div>
            </div>
          </section>
        )}

      {/* 2. Four Financial Stat Cards */}
      <section
        data-tour="dashboard-stats"
        className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4"
      >
        <HoverHint
          hint="Tổng số dây hụi bạn đang tham gia"
          className="w-full animate-fade-up"
        >
          <div className="group relative w-full rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5 backdrop-blur-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-xl overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-avalanche-red/70 to-transparent" />
            <div className="flex items-center justify-between font-mono text-[11px] sm:text-xs text-zinc-400 uppercase tracking-wider">
              <span className="truncate">Dây hụi tham gia</span>
              <Layers className="h-4 w-4 shrink-0 text-avalanche-red" />
            </div>
            <div className="mt-2 font-mono text-xl sm:text-3xl font-black text-white">
              {myCircles.length}
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint="Tổng số mUSDC bạn đã đóng góp qua các kỳ"
          className="w-full animate-fade-up animation-delay-100"
        >
          <div className="group relative w-full rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5 backdrop-blur-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-xl overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
            <div className="flex items-center justify-between font-mono text-[11px] sm:text-xs text-zinc-400 uppercase tracking-wider">
              <span className="truncate">Đã đóng góp</span>
              <Coins className="h-4 w-4 shrink-0 text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-xl sm:text-3xl font-black text-white">
              {formatUsdc(currentUser.stats.totalContributed)}{' '}
              <span className="text-xs font-normal text-zinc-400">mUSDC</span>
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint="Tài sản thế chấp đang khóa trong các Smart Contract"
          className="w-full animate-fade-up animation-delay-150"
        >
          <div className="group relative w-full rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5 backdrop-blur-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-xl overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
            <div className="flex items-center justify-between font-mono text-[11px] sm:text-xs text-zinc-400 uppercase tracking-wider">
              <span className="truncate">Thế chấp khóa</span>
              <Lock className="h-4 w-4 shrink-0 text-amber-400" />
            </div>
            <div className="mt-2 font-mono text-xl sm:text-3xl font-black text-amber-300">
              {formatUsdc(currentUser.stats.totalCollateralLocked)}{' '}
              <span className="text-xs font-normal text-zinc-400">mUSDC</span>
            </div>
          </div>
        </HoverHint>

        <HoverHint
          hint="Tổng số tiền quỹ (Payout) bạn đã nhận về ví qua các kỳ thắng hụi"
          className="w-full animate-fade-up animation-delay-200"
        >
          <div className="group relative w-full rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 sm:p-5 backdrop-blur-xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:border-zinc-700 hover:shadow-xl overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
            <div className="flex items-center justify-between font-mono text-[11px] sm:text-xs text-zinc-400 uppercase tracking-wider">
              <span className="truncate">Tiền quỹ đã nhận</span>
              <TrendingUp className="h-4 w-4 shrink-0 text-sky-400" />
            </div>
            <div className="mt-2 font-mono text-xl sm:text-3xl font-black text-emerald-400">
              {formatUsdc(currentUser.stats.totalPayoutReceived)}{' '}
              <span className="text-xs font-normal text-zinc-400">mUSDC</span>
            </div>
          </div>
        </HoverHint>
      </section>

      {/* 3. Action Required Strip */}
      {actionItems.length > 0 && (
        <section className="grid gap-3 sm:gap-3.5 md:grid-cols-2 animate-fade-in">
          {actionItems.map((item) => (
            <HoverHint key={item.id} hint={item.hint} className="w-full">
              <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-avalanche-red/60 bg-avalanche-red/10 p-3.5 sm:px-4 sm:py-3.5 shadow-lg shadow-avalanche-red/10 backdrop-blur-md">
                <div className="flex items-center gap-2.5 truncate">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-avalanche-red/20 text-avalanche-red">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <span className="truncate text-xs sm:text-sm font-bold text-white">
                    {item.title}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                    {item.amountLabel}
                  </span>
                  <Link
                    href={`/circles/${item.circleId}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-avalanche-red bg-avalanche-red px-3 py-1.5 font-mono text-xs font-bold uppercase text-white shadow-sm transition hover:bg-avalanche-darkRed active:scale-95"
                  >
                    <span>Xử lý</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </HoverHint>
          ))}
        </section>
      )}

      {/* 4. My Circles Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">
            Dây hụi của tôi ({myCircles.length})
          </h2>

          <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1">
            {(
              [
                { key: 'ALL', label: 'Tất cả' },
                { key: 'ACTIVE', label: 'Đang chạy' },
                { key: 'RECRUITING', label: 'Đang gom' },
                { key: 'COMPLETED', label: 'Đã tất toán' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider transition ${
                  activeTab === tab.key
                    ? 'border border-avalanche-red bg-avalanche-red text-white shadow-sm'
                    : 'border border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredMyCircles.map((circle) => (
            <CircleCard
              key={circle.id}
              circle={circle}
              currentUserAddress={currentUser.walletAddress}
            />
          ))}
        </div>
      </section>

      {/* 5. Open Recruiting Circles */}
      {openRecruitingCircles.length > 0 && (
        <section className="space-y-4 border-t border-zinc-800/80 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">
              Đang tuyển thành viên ({openRecruitingCircles.length})
            </h2>
            <Link
              href="/circles"
              className="font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red hover:underline"
            >
              Tất cả →
            </Link>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {openRecruitingCircles.map((circle) => (
              <CircleCard
                key={circle.id}
                circle={circle}
                currentUserAddress={currentUser.walletAddress}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
