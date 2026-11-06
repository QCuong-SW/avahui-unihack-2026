'use client';

import React from 'react';
import { HoverHint } from '@/components/ui/HoverHint';

interface NetworkStatusProps {
  chainId?: number;
  compact?: boolean;
}

export function NetworkStatus({
  chainId = 43113,
  compact = false,
}: NetworkStatusProps) {
  const isValidChain = chainId === 43113;

  return (
    <HoverHint
      side="bottom"
      hint={
        isValidChain
          ? 'Mạng lưới: Avalanche Fuji Testnet (Chain ID: 43113)'
          : 'Sai mạng lưới! Vui lòng chuyển sang Avalanche Fuji (43113)'
      }
    >
      <div
        className={`inline-flex items-center gap-1.5 rounded-none border px-2.5 py-1.5 font-mono text-xs font-semibold ${
          isValidChain
            ? 'border-zinc-800 bg-zinc-900/90 text-zinc-200'
            : 'border-rose-500/50 bg-rose-500/10 text-rose-300'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 ${
            isValidChain ? 'bg-emerald-400' : 'bg-rose-400'
          }`}
        />
        <span>{compact ? 'Fuji' : 'Avalanche Fuji'}</span>
      </div>
    </HoverHint>
  );
}
