'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import { AllocationMode, CircleStatus } from '@avahui/shared';
import { CircleCard } from './CircleCard';
import { useInteractiveTour } from '@/features/guide/context/InteractiveTourContext';
import { Filter, PlusCircle, Search } from 'lucide-react';

export function ExploreCirclesView() {
  const { data: state, isLoading } = useAvaHuiState();
  const tour = useInteractiveTour();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  if (isLoading || !state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-mono text-xs text-zinc-400">
        Đang tải danh sách dây hụi...
      </div>
    );
  }

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const allCircles = tour.isTourActive
    ? [tour.sandboxCircle, ...state.circles]
    : state.circles;

  const filteredCircles = allCircles.filter((circle) => {
    const matchesSearch =
      circle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(circle.contractAddress?.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' || circle.status === statusFilter;

    const matchesMode =
      modeFilter === 'ALL' || circle.allocationMode === modeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 animate-fade-down">
        <h1 className="font-mono text-xl sm:text-2xl font-extrabold uppercase tracking-wider text-white">
          Danh sách Dây hụi ({filteredCircles.length})
        </h1>

        <Link
          href="/circles/create"
          className="inline-flex items-center gap-2 rounded-xl border border-avalanche-red/50 bg-gradient-to-r from-avalanche-red to-red-600 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition-all hover:brightness-110 hover:shadow-lg hover:shadow-avalanche-red/25 active:scale-[0.98]"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Mở dây mới</span>
        </Link>
      </div>

      {/* Compact Responsive Filter Bar */}
      <div
        data-tour="explore-filters"
        className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-3.5 sm:p-4 shadow-xl grid gap-3.5 md:grid-cols-12 animate-fade-in"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-avalanche-red/50 to-transparent" />

        <div className="relative md:col-span-5">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên dây hụi hoặc địa chỉ hợp đồng (0x...)"
            className="w-full rounded-lg border border-zinc-800/80 bg-zinc-900/80 py-2 pl-9 pr-3 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-avalanche-red/60 focus:ring-1 focus:ring-avalanche-red/30 focus:outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 md:col-span-4">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          {(
            [
              { key: 'ALL', label: 'Tất cả' },
              { key: CircleStatus.Recruiting, label: 'Đang gom' },
              { key: CircleStatus.Active, label: 'Đang chạy' },
              { key: CircleStatus.Completed, label: 'Đã tất toán' },
            ] as const
          ).map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${
                statusFilter === st.key
                  ? 'border-avalanche-red/60 bg-avalanche-red text-white shadow-md shadow-avalanche-red/20'
                  : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 md:col-span-3">
          {(
            [
              { key: 'ALL', label: 'Mọi cơ chế' },
              { key: AllocationMode.FIXED, label: 'Cố định' },
              { key: AllocationMode.BIDDING, label: 'Đấu giá' },
            ] as const
          ).map((md) => (
            <button
              key={md.key}
              onClick={() => setModeFilter(md.key)}
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                modeFilter === md.key
                  ? 'border-avalanche-red/60 bg-avalanche-red/20 text-white shadow-sm'
                  : 'border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:text-white hover:border-zinc-700'
              }`}
            >
              {md.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid with smooth entrance animation */}
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3 animate-fade-up">
        {filteredCircles.map((circle) => (
          <CircleCard
            key={circle.id}
            circle={circle}
            currentUserAddress={currentUser.walletAddress}
          />
        ))}
      </div>
    </div>
  );
}
