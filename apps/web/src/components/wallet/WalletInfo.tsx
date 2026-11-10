'use client';

import React, { useState } from 'react';
import { shortenAddress } from '@/lib/utils';
import { WALLET_STATUS_META } from '@/lib/wallet/walletStatus';
import { WalletConnectionState } from '@/lib/auth/authSession';
import { useConnectBrowserWalletMutation } from '@/hooks/useAvaHuiMockQuery';
import { useWalletStatusMutation } from '@/lib/auth/useAuthSession';
import { HoverHint } from '@/components/ui/HoverHint';
import { Check, Copy, PlugZap, Wallet } from 'lucide-react';

interface WalletInfoProps {
  walletAddress: string;
  walletStatus: WalletConnectionState;
}

export function WalletInfo({ walletAddress, walletStatus }: WalletInfoProps) {
  const [copied, setCopied] = useState(false);
  const statusMeta = WALLET_STATUS_META[walletStatus];
  const connectBrowserWallet = useConnectBrowserWalletMutation();
  const walletStatusMutation = useWalletStatusMutation();

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleConnectRealWallet = async () => {
    try {
      await connectBrowserWallet.mutateAsync();
      walletStatusMutation.mutate('WALLET_CONNECTED_READY');
    } catch (err: any) {
      alert(err?.message || 'Không thể kết nối ví trình duyệt.');
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 text-xs">
      <HoverHint side="bottom" hint={statusMeta.hint}>
        <div className="flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-avalanche-red" />
          <span className={`h-1.5 w-1.5 ${statusMeta.dotColorClass}`} />
          <span className="font-mono text-xs font-semibold text-zinc-200">
            {shortenAddress(walletAddress)}
          </span>
        </div>
      </HoverHint>

      <HoverHint side="bottom" hint="Sao chép địa chỉ ví">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-none border border-zinc-800 p-0.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </HoverHint>

      <HoverHint
        side="bottom"
        hint="Kết nối ví thật (Core Wallet / MetaMask) và tự động chuyển sang mạng Avalanche Fuji (43113)"
      >
        <button
          type="button"
          onClick={handleConnectRealWallet}
          disabled={connectBrowserWallet.isPending}
          className="inline-flex items-center gap-1 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-300 transition hover:bg-emerald-500 hover:text-zinc-950"
        >
          <PlugZap className="h-3 w-3" />
          <span>Core/MM</span>
        </button>
      </HoverHint>
    </div>
  );
}
