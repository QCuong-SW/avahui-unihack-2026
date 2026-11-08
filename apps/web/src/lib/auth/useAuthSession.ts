'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AuthSessionState,
  authenticateWithProvider,
  completeWalletOnboarding,
  loadAuthSession,
  logoutAuthSession,
  requestEmailOtp,
  updateWalletConnectionState,
  verifyEmailOtpCode,
  WalletConnectionState,
} from './authSession';
import { switchMockUser } from '@/stores/avahuiMockEngine';
import { AVAHUI_QUERY_KEYS } from '@/hooks/useAvaHuiMockQuery';
import { authApi } from '@/lib/api';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const AUTH_QUERY_KEY = ['avahui', 'auth-session'] as const;

export function useAuthSession() {
  return useQuery<AuthSessionState>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => loadAuthSession(),
    staleTime: Infinity,
  });
}

export function useProviderLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      method: 'GOOGLE' | 'EXTERNAL_WALLET';
      userId: string;
      email: string;
      forceWalletOnboarding?: boolean;
    }) => {
      await new Promise((r) => setTimeout(r, 650));
      const newMockState = switchMockUser(params.userId);
      const authResult = authenticateWithProvider(
        params.method,
        params.userId,
        params.email,
        params.forceWalletOnboarding
      );

      // In live mode, sync user to PostgreSQL backend
      const targetUser = newMockState.users.find((u) => u.id === params.userId);
      if (!isMockMode && targetUser && targetUser.walletAddress) {
        try {
          await authApi.syncUser(
            {
              walletAddress: targetUser.walletAddress,
              email: params.email,
              displayName: targetUser.displayName || undefined,
            },
            targetUser.walletAddress,
          );
        } catch (err) {
          console.warn('[AvaHui] authApi.syncUser on provider login error:', err);
        }
      }

      return {
        ...authResult,
        mockState: newMockState,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useRequestEmailOtpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; targetUserId: string }) => {
      await new Promise((r) => setTimeout(r, 550));
      const session = requestEmailOtp(params.email, params.targetUserId);
      return session;
    },
    onSuccess: (session) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
    },
  });
}

export function useVerifyEmailOtpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      await new Promise((r) => setTimeout(r, 650));
      const result = verifyEmailOtpCode(code);
      const mockState = switchMockUser(result.session.userId);

      // In live mode, sync user to PostgreSQL backend
      const targetUser = mockState.users.find((u) => u.id === result.session.userId);
      if (!isMockMode && targetUser && targetUser.walletAddress) {
        try {
          await authApi.syncUser(
            {
              walletAddress: targetUser.walletAddress,
              email: targetUser.email || undefined,
              displayName: targetUser.displayName || undefined,
            },
            targetUser.walletAddress,
          );
        } catch (err) {
          console.warn('[AvaHui] authApi.syncUser on OTP verify error:', err);
        }
      }

      return {
        ...result,
        mockState,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useCompleteWalletOnboardingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 450));
      return completeWalletOnboarding();
    },
    onSuccess: (session) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
    },
  });
}

export function useWalletStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: WalletConnectionState) => {
      return updateWalletConnectionState(status);
    },
    onSuccess: (session) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 400));
      return logoutAuthSession();
    },
    onSuccess: (loggedOutSession) => {
      queryClient.removeQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
      queryClient.setQueryData(AUTH_QUERY_KEY, loggedOutSession);
    },
  });
}
