import { apiFetch } from './client';
import type { TransactionRecordDto, TransactionType } from '@avahui/shared';

export interface TrackTransactionInput {
  txHash: string;
  txType: TransactionType;
  contractAddress: string;
  senderAddress?: string;
  circleId?: string;
}

export const transactionApi = {
  trackTransaction: async (
    input: TrackTransactionInput,
    walletAddress?: string,
  ): Promise<TransactionRecordDto> => {
    return apiFetch<TransactionRecordDto>('/transactions/track', {
      method: 'POST',
      body: JSON.stringify(input),
      walletAddress: walletAddress || input.senderAddress,
    });
  },

  getMyTransactions: async (
    circleId?: string,
    walletAddress?: string,
  ): Promise<TransactionRecordDto[]> => {
    return apiFetch<TransactionRecordDto[]>('/transactions/my', {
      method: 'GET',
      params: { circleId },
      walletAddress,
    });
  },
};
