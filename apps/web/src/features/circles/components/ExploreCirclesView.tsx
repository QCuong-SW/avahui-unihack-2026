'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import { AllocationMode, CircleStatus } from '@avahui/shared';
import { CircleCard } from './CircleCard';
import { Filter, PlusCircle, Search } from 'lucide-react';

export function ExploreCirclesView() {
  const { data: state, isLoading } = useAvaHuiState();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [modeFilter, setModeFilter] = useState<string>('ALL');

  if (isLoading || !state) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-mono text-xs text-zinc-400">
        Loading...
      </div>
    );
  }

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const filteredCircles = state.circles.filter((circle) => {
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
          Circles ({filteredCircles.length})
        </h1>

        <Link
          href="/circles/create"
          className="inline-flex items-center gap-1.5 rounded-none border border-avalanche-red bg-avalanche-red px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed active:scale-95 shadow-md shadow-avalanche-red/20"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create Circle</span>
        </Link>
      </div>

      {/* Compact Responsive Filter Bar */}
      <div className="grid gap-3 rounded-none border border-zinc-800 bg-surface-card p-3 sm:p-3.5 md:grid-cols-12 animate-fade-in">
        <div className="relative md:col-span-5">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circle name or contract (0x...)"
            className="w-full rounded-none border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 font-mono text-xs text-white focus:border-avalanche-red focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 md:col-span-4">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: CircleStatus.Recruiting, label: 'Recruiting' },
              { key: CircleStatus.Active, label: 'Active' },
              { key: CircleStatus.Completed, label: 'Completed' },
            ] as const
          ).map((st) => (
            <button
              key={st.key}
              onClick={() => setStatusFilter(st.key)}
              className={`rounded-none border px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider transition active:scale-95 ${
                statusFilter === st.key
                  ? 'border-avalanche-red bg-avalanche-red text-white shadow-sm'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-start md:justify-end gap-1.5 md:col-span-3">
          {(
            [
              { key: 'ALL', label: 'All Modes' },
              { key: AllocationMode.FIXED, label: 'FIXED' },
              { key: AllocationMode.BIDDING, label: 'BIDDING' },
            ] as const
          ).map((md) => (
            <button
              key={md.key}
              onClick={() => setModeFilter(md.key)}
              className={`rounded-none border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition active:scale-95 ${
                modeFilter === md.key
                  ? 'border-avalanche-red bg-avalanche-red/15 text-white'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
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
