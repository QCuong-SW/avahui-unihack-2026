import { apiFetch } from './client';

export interface GasFaucetStatusDto {
  configured: boolean;
  walletAddress: string | null;
  currentAvaxBalance: string;
  dripAmountAvax: string;
  eligible: boolean;
  cooldownActive: boolean;
  nextEligibleAt: string | null;
}

export interface GasDripResponseDto {
  toAddress: string;
  amountAvax: string;
  txHash: string;
}

export const walletApi = {
  getGasFaucetStatus: () =>
    apiFetch<GasFaucetStatusDto>('/wallets/faucet-gas/status', { method: 'GET' }),

  dripGas: () =>
    apiFetch<GasDripResponseDto>('/wallets/faucet-gas', { method: 'POST' }),
};

