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
      return {
        ...authResult,
        mockState: newMockState,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
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
      return {
        ...result,
        mockState,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
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
      // Clear private React Query cache while preserving embedded wallet persistence
      queryClient.removeQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
      queryClient.setQueryData(AUTH_QUERY_KEY, loggedOutSession);
    },
  });
}
