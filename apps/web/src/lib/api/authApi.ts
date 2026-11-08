import { apiFetch } from './client';
import type { UserProfileDto } from '@avahui/shared';

export interface SyncAuthInput {
  walletAddress: string;
  email?: string;
  displayName?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  avatarUrl?: string;
}

export const authApi = {
  syncUser: async (input: SyncAuthInput, walletAddress?: string): Promise<UserProfileDto> => {
    return apiFetch<UserProfileDto>('/auth/sync', {
      method: 'POST',
      body: JSON.stringify(input),
      walletAddress: walletAddress || input.walletAddress,
    });
  },

  getMe: async (walletAddress?: string): Promise<UserProfileDto> => {
    return apiFetch<UserProfileDto>('/users/me', {
      method: 'GET',
      walletAddress,
    });
  },

  updateMe: async (input: UpdateUserInput, walletAddress?: string): Promise<UserProfileDto> => {
    return apiFetch<UserProfileDto>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
      walletAddress,
    });
  },
};
