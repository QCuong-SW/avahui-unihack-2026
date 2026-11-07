'use client';

import React from 'react';
import { TxLifecycleStep } from '@avahui/shared';
import { useTxLifecycle } from '../hooks/useTxLifecycle';
import { shortenAddress } from '@/lib/utils';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';

const LIFECYCLE_STEPS = [
  {
    key: TxLifecycleStep.SIGNING,
    title: '1. Ký xác nhận (Privy Wallet)',
    hint: 'Xác thực chữ ký số từ ví nhúng mà không lộ Private Key',
    icon: KeyRound,
  },
  {
    key: TxLifecycleStep.SUBMITTED,
    title: '2. Gửi lên Avalanche Fuji (43113)',
    hint: 'Phát tán giao dịch tới mạng lưới Avalanche C-Chain',
    icon: Send,
  },
  {
    key: TxLifecycleStep.CONFIRMED,
    title: '3. Smart Contract xác nhận',
    hint: 'Kiểm tra điều kiện tài chính và phát sự kiện bất biến trên chuỗi',
    icon: ShieldCheck,
  },
  {
    key: TxLifecycleStep.SYNCED,
    title: '4. Đồng bộ Indexer',
    hint: 'Cập nhật bản chiếu dữ liệu và làm mới giao diện người dùng',
    icon: Database,
  },
] as const;

const STEP_ORDER: Record<TxLifecycleStep, number> = {
  [TxLifecycleStep.IDLE]: 0,
  [TxLifecycleStep.SIGNING]: 1,
  [TxLifecycleStep.SUBMITTED]: 2,
  [TxLifecycleStep.CONFIRMED]: 3,
  [TxLifecycleStep.SYNCED]: 4,
  [TxLifecycleStep.ERROR]: -1,
};

export function TransactionLifecycleModal() {
  const { modalState, closeModal } = useTxLifecycle();

  if (!modalState.isOpen) return null;

  const currentOrder = STEP_ORDER[modalState.step];
  const isFinished =
    modalState.step === TxLifecycleStep.SYNCED ||
    modalState.step === TxLifecycleStep.ERROR;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-none border border-zinc-800 bg-surface-card p-5 shadow-2xl animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3.5">
          <div>
            <span className="inline-flex items-center gap-1 rounded-none bg-avalanche-red/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-avalanche-red">
              FUJI C-CHAIN TX
            </span>
            <h3 className="mt-1.5 font-mono text-base font-bold uppercase tracking-wider text-white">
              {modalState.title}
            </h3>
          </div>
          {isFinished && (
            <button
              onClick={closeModal}
              className="rounded-none p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 4 Steps Compact Progress List with Hover Hints */}
        <div className="mt-4 space-y-2">
          {LIFECYCLE_STEPS.map((item, idx) => {
            const stepNum = idx + 1;
            const isCompleted =
              currentOrder > stepNum ||
              modalState.step === TxLifecycleStep.SYNCED;
            const isActive = currentOrder === stepNum;
            const Icon = item.icon;

            return (
              <HoverHint
                key={item.key}
                hint={item.hint}
                side="top"
                className="flex w-full"
              >
                <div
                  className={`flex w-full items-center gap-3 rounded-none border px-3.5 py-2.5 font-mono transition ${
                    isCompleted
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : isActive
                      ? 'border-avalanche-red/60 bg-avalanche-red/10'
                      : 'border-zinc-800/80 bg-zinc-900/40 opacity-50'
                  }`}
                >
                  <div>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-avalanche-red" />
                    ) : (
                      <Icon className="h-4 w-4 text-zinc-500" />
                    )}
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      isCompleted
                        ? 'text-emerald-300'
                        : isActive
                        ? 'text-white'
                        : 'text-zinc-400'
                    }`}
                  >
                    {item.title}
                  </div>
                </div>
              </HoverHint>
            );
          })}
        </div>

        {/* Error Box if Failed */}
        {modalState.step === TxLifecycleStep.ERROR && (
          <div className="mt-3 flex items-start gap-2.5 rounded-none border border-rose-500/40 bg-rose-500/10 p-3 font-mono text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <div>{modalState.errorMessage}</div>
          </div>
        )}

        {/* Transaction Hash & Block Info */}
        {modalState.txHash && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-none border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs">
            <div className="flex items-center gap-2 text-zinc-400">
              <code className="font-mono text-zinc-200">
                {shortenAddress(modalState.txHash, 6)}
              </code>
              {modalState.blockNumber && (
                <span className="rounded-none bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                  #{modalState.blockNumber}
                </span>
              )}
            </div>
            <a
              href={`${frontendEnv.explorerUrl}/tx/${modalState.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red hover:underline"
            >
              <span>Snowtrace</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Footer Button */}
        <div className="mt-4">
          <button
            onClick={closeModal}
            disabled={!isFinished}
            className="w-full rounded-none bg-avalanche-red px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {modalState.step === TxLifecycleStep.SYNCED
              ? 'Đóng'
              : modalState.step === TxLifecycleStep.ERROR
              ? 'Đóng'
              : 'Đang xử lý...'}
          </button>
        </div>
      </div>
    </div>
  );
}
