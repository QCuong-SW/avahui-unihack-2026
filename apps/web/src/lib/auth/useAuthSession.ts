'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AuthSessionState,
  authenticateWithProvider,
  authenticateWithRealToken,
  completeWalletOnboarding,
  loadAuthSession,
  logoutAuthSession,
  requestEmailOtp,
  updateWalletConnectionState,
  verifyEmailOtpCode,
  WalletConnectionState,
} from './authSession';
import { mockBindRealWallet, switchMockUser } from '@/stores/avahuiMockEngine';
import { AVAHUI_QUERY_KEYS } from '@/hooks/useAvaHuiMockQuery';
import {
  ACTIVE_WALLET_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  authApi,
} from '@/lib/api';
import { frontendEnv } from '@/config/env';
import { ensureBrowserWalletNetwork } from '@/lib/wagmi/client';
import { getPrivyBridgeActions } from '@/lib/privy/privyBridge';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const AUTH_QUERY_KEY = ['avahui', 'auth-session'] as const;

export function useAuthSession() {
  return useQuery<AuthSessionState>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => loadAuthSession(),
    staleTime: Infinity,
  });
}

/**
 * Cryptographic SIWE (Sign-In With Ethereum) login for Core Wallet / MetaMask.
 */
export function useSiweLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: { forceWalletOnboarding?: boolean }) => {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error(
          'Không tìm thấy ví trình duyệt (Core Wallet / MetaMask). Vui lòng cài đặt ví hoặc bật Privy App ID thật.',
        );
      }

      const eth = (window as any).ethereum;
      const accounts: string[] = await eth.request({
        method: 'eth_requestAccounts',
      });
      if (!accounts || accounts.length === 0) {
        throw new Error('Người dùng đã từ chối kết nối ví.');
      }

      const address = accounts[0];
      await ensureBrowserWalletNetwork(eth);

      if (isMockMode) {
        const newMockState = mockBindRealWallet(address);
        const authResult = authenticateWithProvider(
          'EXTERNAL_WALLET',
          `siwe_${address.toLowerCase()}`,
          `${address.slice(0, 6)}...${address.slice(-4)}@wallet`,
          params?.forceWalletOnboarding,
        );
        return { ...authResult, mockState: newMockState };
      }

      // 1. Request nonce + EIP-4361 message from backend
      const challenge = await authApi.requestSiweNonce(address);

      // 2. Ask Core / MetaMask to sign challenge
      const signature: string = await eth.request({
        method: 'personal_sign',
        params: [challenge.message, address],
      });

      // 3. Verify signature on backend & obtain signed HS256 JWT
      const verified = await authApi.verifySiwe({
        address,
        message: challenge.message,
        signature,
        nonce: challenge.nonce,
      });

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, verified.accessToken);
        window.localStorage.setItem(
          ACTIVE_WALLET_STORAGE_KEY,
          address.toLowerCase(),
        );
      }

      const newMockState = mockBindRealWallet(address);
      const authResult = authenticateWithRealToken({
        userId: verified.user.id,
        email: verified.user.email || `${address.slice(0, 6)}@wallet`,
        walletAddress: address,
        accessToken: verified.accessToken,
        authMethod: 'EXTERNAL_WALLET',
        forceWalletOnboarding: params?.forceWalletOnboarding,
      });

      return {
        ...authResult,
        mockState: newMockState,
        user: verified.user,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
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
      const privy = getPrivyBridgeActions();
      if (params.method === 'GOOGLE' && frontendEnv.hasRealPrivyAppId && privy) {
        await privy.initGoogleOAuth();
        return {
          session: loadAuthSession(),
          requiresWalletOnboarding: false,
          mockState: undefined,
          redirectedToOAuth: true,
        };
      }

      if (!isMockMode && !frontendEnv.enableDevDemoTools) {
        throw new Error(
          'Đăng nhập Google cần cấu hình NEXT_PUBLIC_PRIVY_APP_ID thật. Bạn có thể dùng Connect External Wallet (SIWE) bằng Core Wallet / MetaMask.',
        );
      }

      await new Promise((r) => setTimeout(r, 450));
      const newMockState = switchMockUser(params.userId);
      const authResult = authenticateWithProvider(
        params.method,
        params.userId,
        params.email,
        params.forceWalletOnboarding,
      );

      return {
        ...authResult,
        mockState: newMockState,
        redirectedToOAuth: false,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      if (mockState) {
        queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
        queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
      }
    },
  });
}

export function useRequestEmailOtpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { email: string; targetUserId: string }) => {
      const privy = getPrivyBridgeActions();
      if (frontendEnv.hasRealPrivyAppId && privy) {
        await privy.sendEmailCode(params.email.trim());
        return requestEmailOtp(params.email, params.targetUserId, true);
      }

      if (!isMockMode && !frontendEnv.enableDevDemoTools) {
        throw new Error(
          'Email OTP thật cần cấu hình NEXT_PUBLIC_PRIVY_APP_ID. Vui lòng dùng Core Wallet / MetaMask (SIWE).',
        );
      }

      await new Promise((r) => setTimeout(r, 350));
      return requestEmailOtp(params.email, params.targetUserId, false);
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
      const current = loadAuthSession();
      const privy = getPrivyBridgeActions();

      if (
        frontendEnv.hasRealPrivyAppId &&
        current.pendingOtp?.isRealPrivy &&
        privy
      ) {
        await privy.loginWithEmailCode(code.trim());
        const token = await privy.getAccessToken();
        if (token && typeof window !== 'undefined') {
          window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
        }
        const authResult = authenticateWithRealToken({
          userId: current.pendingOtp.targetUserId,
          email: current.pendingOtp.email,
          accessToken: token || '',
          authMethod: 'EMAIL_OTP',
        });
        return {
          ...authResult,
          mockState: undefined,
        };
      }

      await new Promise((r) => setTimeout(r, 450));
      const result = verifyEmailOtpCode(code);
      const mockState = switchMockUser(result.session.userId);
      return {
        ...result,
        mockState,
      };
    },
    onSuccess: ({ session, mockState }) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      if (mockState) {
        queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, mockState);
        queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
      }
    },
  });
}

export function useCompleteWalletOnboardingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 350));
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
      const privy = getPrivyBridgeActions();
      if (privy) {
        await privy.logout().catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 250));
      return logoutAuthSession();
    },
    onSuccess: (loggedOutSession) => {
      queryClient.removeQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
      queryClient.setQueryData(AUTH_QUERY_KEY, loggedOutSession);
    },
  });
}
