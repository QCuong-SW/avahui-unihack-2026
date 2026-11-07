'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';
import { TxLifecycleStep } from '@avahui/shared';
import { generateMockTxHash } from '@/lib/utils';

export interface TxModalState {
  isOpen: boolean;
  title: string;
  description: string;
  step: TxLifecycleStep;
  txHash: string | null;
  blockNumber: number | null;
  errorMessage: string | null;
}

export interface RunTxOptions<T> {
  title: string;
  description: string;
  action: () => Promise<{ txHash?: string; result?: T } | T>;
  onSuccess?: (res: T) => void;
}

interface TxLifecycleContextValue {
  modalState: TxModalState;
  closeModal: () => void;
  runTransaction: <T>(options: RunTxOptions<T>) => Promise<T | undefined>;
}

const initialModalState: TxModalState = {
  isOpen: false,
  title: '',
  description: '',
  step: TxLifecycleStep.IDLE,
  txHash: null,
  blockNumber: null,
  errorMessage: null,
};

const TxLifecycleContext = createContext<TxLifecycleContextValue | null>(null);

export function TxLifecycleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [modalState, setModalState] = useState<TxModalState>(initialModalState);

  const closeModal = useCallback(() => {
    setModalState((prev) =>
      prev.step === TxLifecycleStep.SIGNING ||
      prev.step === TxLifecycleStep.SUBMITTED
        ? prev
        : initialModalState
    );
  }, []);

  const runTransaction = useCallback(
    async <T,>(options: RunTxOptions<T>): Promise<T | undefined> => {
      try {
        // Step 1: Wallet Signing (Privy Embedded Wallet)
        setModalState({
          isOpen: true,
          title: options.title,
          description: options.description,
          step: TxLifecycleStep.SIGNING,
          txHash: null,
          blockNumber: null,
          errorMessage: null,
        });
        await new Promise((r) => setTimeout(r, 550));

        // Step 2: Broadcast / Submitted to Avalanche Fuji C-Chain
        const provisionalHash = generateMockTxHash();
        setModalState((prev) => ({
          ...prev,
          step: TxLifecycleStep.SUBMITTED,
          txHash: provisionalHash,
        }));
        await new Promise((r) => setTimeout(r, 650));

        // Execute underlying state mutation / contract call
        const rawRes = await options.action();
        const finalTxHash =
          rawRes &&
          typeof rawRes === 'object' &&
          'txHash' in rawRes &&
          typeof (rawRes as { txHash?: string }).txHash === 'string'
            ? (rawRes as { txHash: string }).txHash
            : provisionalHash;

        // Step 3: Confirmed On-Chain (Snowman Consensus Finality)
        const simulatedBlock = 38512400 + Math.floor(Math.random() * 500);
        setModalState((prev) => ({
          ...prev,
          step: TxLifecycleStep.CONFIRMED,
          txHash: finalTxHash,
          blockNumber: simulatedBlock,
        }));
        await new Promise((r) => setTimeout(r, 500));

        // Step 4: Backend Event Indexed & Projection Synced
        setModalState((prev) => ({
          ...prev,
          step: TxLifecycleStep.SYNCED,
        }));

        if (options.onSuccess) {
          options.onSuccess(rawRes as T);
        }

        return rawRes as T;
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Giao dịch thất bại hoặc bị từ chối.';
        setModalState((prev) => ({
          ...prev,
          step: TxLifecycleStep.ERROR,
          errorMessage: message,
        }));
        return undefined;
      }
    },
    []
  );

  return (
    <TxLifecycleContext.Provider
      value={{ modalState, closeModal, runTransaction }}
    >
      {children}
    </TxLifecycleContext.Provider>
  );
}

export function useTxLifecycle() {
  const ctx = useContext(TxLifecycleContext);
  if (!ctx) {
    throw new Error('useTxLifecycle must be used within TxLifecycleProvider');
  }
  return ctx;
}
