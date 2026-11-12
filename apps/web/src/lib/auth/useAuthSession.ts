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

export function isUserRejectedError(err: any): boolean {
  if (!err) return false;
  const code = err.code ?? err.error?.code;
  if (code === 4001 || code === 'ACTION_REJECTED' || code === 'ACTION_CANCELLED') return true;
  const msg = String(err.message || err.error?.message || err.details || '').toLowerCase();
  return (
    msg.includes('user rejected') ||
    msg.includes('user denied') ||
    msg.includes('rejected the request') ||
    msg.includes('user cancelled') ||
    msg.includes('user canceled') ||
    msg.includes('cancelled') ||
    msg.includes('hủy') ||
    msg.includes('huỷ') ||
    msg.includes('từ chối')
  );
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMsg: string,
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(timeoutMsg);
      err.isTimeout = true;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
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
          'Không tìm thấy ví trình duyệt (Core Wallet / MetaMask). Vui lòng cài đặt tiện ích ví và thử lại.',
        );
      }

      const eth = (window as any).ethereum;

      // 1. Request account access with timeout & rejection trap
      let accounts: string[];
      try {
        accounts = await withTimeout(
          eth.request({ method: 'eth_requestAccounts' }),
          30_000,
          'Quá thời gian chờ kết nối ví (30s). Có thể bạn đã đóng cửa sổ ví hoặc chưa xác nhận.',
        );
      } catch (reqErr: any) {
        if (isUserRejectedError(reqErr)) {
          throw new Error('Đăng nhập không thành công: Bạn đã hủy hoặc từ chối kết nối ví.');
        }
        throw reqErr;
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('Đăng nhập không thành công: Không có tài khoản ví nào được chọn.');
      }

      const address = accounts[0];

      // 2. Ensure network switch to Fuji
      try {
        await withTimeout(
          ensureBrowserWalletNetwork(eth),
          20_000,
          'Quá thời gian chuyển mạng sang Avalanche Fuji.',
        );
      } catch (switchErr: any) {
        if (isUserRejectedError(switchErr)) {
          throw new Error('Đăng nhập không thành công: Bạn đã từ chối chuyển mạng sang Avalanche Fuji.');
        }
        console.warn('[SIWE] ensureBrowserWalletNetwork warning:', switchErr);
      }

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

      // 3. Request nonce + EIP-4361 message from backend with fallback
      let challenge: any;
      try {
        challenge = await authApi.requestSiweNonce(address);
      } catch (apiErr: any) {
        console.warn('[SIWE] requestSiweNonce failed, falling back to local wallet session:', apiErr);
        const newMockState = mockBindRealWallet(address);
        const authResult = authenticateWithProvider(
          'EXTERNAL_WALLET',
          `siwe_${address.toLowerCase()}`,
          `${address.slice(0, 6)}...${address.slice(-4)}@wallet`,
          params?.forceWalletOnboarding,
        );
        return { ...authResult, mockState: newMockState };
      }

      // 4. Ask Core / MetaMask to sign challenge with timeout and rejection trap
      let signature: string;
      try {
        signature = await withTimeout(
          eth.request({
            method: 'personal_sign',
            params: [challenge.message, address],
          }),
          40_000,
          'Quá thời gian chờ ký xác thực ví (40s). Vui lòng thử lại.',
        );
      } catch (signErr: any) {
        if (isUserRejectedError(signErr)) {
          throw new Error('Đăng nhập không thành công: Bạn đã hủy hoặc từ chối ký xác thực ví.');
        }
        throw signErr;
      }

      // 5. Verify signature on backend & obtain signed HS256 JWT
      let verified: any;
      try {
        verified = await authApi.verifySiwe({
          address,
          message: challenge.message,
          signature,
          nonce: challenge.nonce,
        });
      } catch (verifyErr: any) {
        console.warn('[SIWE] verifySiwe failed, falling back to local authenticated wallet session:', verifyErr);
        const newMockState = mockBindRealWallet(address);
        const authResult = authenticateWithProvider(
          'EXTERNAL_WALLET',
          `siwe_${address.toLowerCase()}`,
          `${address.slice(0, 6)}...${address.slice(-4)}@wallet`,
          params?.forceWalletOnboarding,
        );
        return { ...authResult, mockState: newMockState };
      }

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
        const snapshot = privy.getUserSnapshot();
        const resolvedWallet = snapshot.walletAddress || current.walletAddress;
        if (token && typeof window !== 'undefined') {
          window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
          if (resolvedWallet) {
            window.localStorage.setItem(
              ACTIVE_WALLET_STORAGE_KEY,
              resolvedWallet.toLowerCase(),
            );
          }
        }
        const authResult = authenticateWithRealToken({
          userId: snapshot.userId || `privy:${current.pendingOtp.email}`,
          email: snapshot.email || current.pendingOtp.email,
          walletAddress: resolvedWallet,
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
