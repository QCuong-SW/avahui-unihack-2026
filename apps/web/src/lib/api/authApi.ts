import { apiFetch } from './client';
import type { UserProfileDto } from '@avahui/shared';

export interface SyncAuthInput {
  walletAddress?: string;
  email?: string;
  displayName?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: string;
}

export interface SiweNonceResponse {
  address: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface VerifySiweInput {
  address: string;
  message: string;
  signature: string;
  nonce?: string;
}

export interface VerifySiweResponse {
  accessToken: string;
  user: UserProfileDto;
}

export const authApi = {
  requestSiweNonce: async (address: string): Promise<SiweNonceResponse> => {
    return apiFetch<SiweNonceResponse>('/auth/siwe/nonce', {
      method: 'GET',
      params: { address },
    });
  },

  verifySiwe: async (input: VerifySiweInput): Promise<VerifySiweResponse> => {
    return apiFetch<VerifySiweResponse>('/auth/siwe/verify', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  syncUser: async (
    input: SyncAuthInput,
    walletAddress?: string,
    token?: string,
  ): Promise<UserProfileDto> => {
    return apiFetch<UserProfileDto>('/auth/sync', {
      method: 'POST',
      body: JSON.stringify(input),
      walletAddress: walletAddress || input.walletAddress,
      token,
    });
  },

  getMe: async (walletAddress?: string): Promise<UserProfileDto> => {
    return apiFetch<UserProfileDto>('/users/me', {
      method: 'GET',
      walletAddress,
    });
  },

  updateMe: async (
    input: UpdateUserInput,
    walletAddress?: string,
  ): Promise<UserProfileDto> => {
    return apiFetch<UserProfileDto>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
      walletAddress,
    });
  },
};
