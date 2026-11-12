'use client';

import { WalletConnectionState } from '@/lib/auth/authSession';

export interface WalletStatusMeta {
  state: WalletConnectionState;
  label: string;
  shortLabel: string;
  dotColorClass: string;
  badgeClass: string;
  hint: string;
  canSignTransactions: boolean;
}

export const WALLET_STATUS_META: Record<
  WalletConnectionState,
  WalletStatusMeta
> = {
  WALLET_CREATED: {
    state: 'WALLET_CREATED',
    label: 'Đã khởi tạo ví',
    shortLabel: 'Mới tạo',
    dotColorClass: 'bg-amber-400',
    badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    hint: 'Ví nhúng đã được khởi tạo trên Avalanche Fuji, hãy kích hoạt kết nối để ký giao dịch',
    canSignTransactions: false,
  },
  WALLET_CONNECTED_READY: {
    state: 'WALLET_CONNECTED_READY',
    label: 'Ví đã kết nối / Sẵn sàng',
    shortLabel: 'Sẵn sàng',
    dotColorClass: 'bg-emerald-400',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    hint: 'Ví nhúng Privy đang kết nối trên Avalanche Fuji (Chain ID: 43113) và sẵn sàng ký giao dịch',
    canSignTransactions: true,
  },
  WALLET_DISCONNECTED: {
    state: 'WALLET_DISCONNECTED',
    label: 'Ví tạm ngắt kết nối',
    shortLabel: 'Tạm ngắt',
    dotColorClass: 'bg-rose-400',
    badgeClass: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    hint: 'Ví đang tạm ngắt kết nối phiên ký. Bấm để kết nối lại mà không cần đăng nhập lại',
    canSignTransactions: false,
  },
};
