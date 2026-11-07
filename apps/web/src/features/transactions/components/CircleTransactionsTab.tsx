'use client';

import React from 'react';
import { BlockchainTransactionItem } from '@avahui/shared';
import { shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import { CheckCircle2, ExternalLink } from 'lucide-react';

interface CircleTransactionsTabProps {
  transactions: BlockchainTransactionItem[];
}

export function CircleTransactionsTab({
  transactions,
}: CircleTransactionsTabProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-none border border-zinc-800 bg-zinc-900/40 p-8 text-center font-mono text-xs uppercase tracking-wider text-zinc-500">
        Chưa có giao dịch nào.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-none border border-zinc-800 bg-zinc-900/50">
      <table className="w-full text-left font-mono text-xs">
        <thead className="border-b border-zinc-800 bg-zinc-900/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3.5 py-3">Sự kiện</th>
            <th className="px-3.5 py-3">Từ Ví</th>
            <th className="px-3.5 py-3">Chi tiết</th>
            <th className="px-3.5 py-3">Block</th>
            <th className="px-3.5 py-3">Tx</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {transactions.map((tx) => (
            <tr key={tx.id} className="hover:bg-zinc-900/40">
              <td className="px-3.5 py-3">
                <span className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  {tx.txType}
                </span>
              </td>

              <td className="px-3.5 py-3">
                <div className="font-sans font-semibold text-zinc-200">
                  {tx.senderName}
                </div>
                <div className="font-mono text-[10px] text-zinc-500">
                  {shortenAddress(tx.senderAddress, 4)}
                </div>
              </td>

              <td className="px-3.5 py-3 font-semibold text-emerald-400">
                {tx.amountFormatted || '—'}
              </td>

              <td className="px-3.5 py-3 font-mono text-zinc-400">
                #{tx.blockNumber}
              </td>

              <td className="px-3.5 py-3">
                <HoverHint hint="Mở trên Snowtrace Fuji Explorer" side="left">
                  <a
                    href={`${frontendEnv.explorerUrl}/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-avalanche-red hover:underline"
                  >
                    <span>{shortenAddress(tx.txHash, 4)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </HoverHint>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
