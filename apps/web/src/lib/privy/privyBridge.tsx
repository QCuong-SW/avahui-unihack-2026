'use client';

import { useEffect, useRef } from 'react';
import {
  useLoginWithEmail,
  useLoginWithOAuth,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth';
import { useQueryClient } from '@tanstack/react-query';
import {
  ACTIVE_WALLET_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  authApi,
} from '@/lib/api';
import { authenticateWithRealToken } from '@/lib/auth/authSession';
import { frontendEnv } from '@/config/env';

interface EmbeddedWalletEntry {
  address: string;
  provider: any;
}

interface PrivyBridgeActions {
  initGoogleOAuth: () => Promise<void>;
  sendEmailCode: (email: string) => Promise<void>;
  loginWithEmailCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

let activeEmbeddedWallet: EmbeddedWalletEntry | null = null;
let bridgeActions: PrivyBridgeActions | null = null;

export function getActiveEmbeddedProvider(
  preferredAddress?: string,
): EmbeddedWalletEntry | null {
  if (!activeEmbeddedWallet) return null;
  if (
    preferredAddress &&
    activeEmbeddedWallet.address.toLowerCase() !== preferredAddress.toLowerCase()
  ) {
    return null;
  }
  return activeEmbeddedWallet;
}

export function clearActiveEmbeddedProvider() {
  activeEmbeddedWallet = null;
}

export function getPrivyBridgeActions(): PrivyBridgeActions | null {
  return bridgeActions;
}

export function PrivyRuntimeSync() {
  const queryClient = useQueryClient();
  const { ready, authenticated, user, getAccessToken, logout } = usePrivy();
  const { wallets } = useWallets();
  const { initOAuth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const syncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    bridgeActions = {
      initGoogleOAuth: async () => {
        await initOAuth({ provider: 'google' });
      },
      sendEmailCode: async (email: string) => {
        await sendCode({ email });
      },
      loginWithEmailCode: async (code: string) => {
        await loginWithCode({ code });
      },
      logout: async () => {
        clearActiveEmbeddedProvider();
        syncedKeyRef.current = null;
        await logout();
      },
      getAccessToken,
    };
    return () => {
      bridgeActions = null;
    };
  }, [getAccessToken, initOAuth, loginWithCode, logout, sendCode]);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || !user) {
      clearActiveEmbeddedProvider();
      syncedKeyRef.current = null;
      return;
    }

    let cancelled = false;

    const syncPrivySession = async () => {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken || cancelled) return;

        const preferredWallet =
          wallets.find((w) => w.walletClientType === 'privy') || wallets[0];

        let walletAddress =
          preferredWallet?.address || user.wallet?.address || '';

        if (preferredWallet) {
          try {
            if (preferredWallet.chainId !== `eip155:${frontendEnv.chainId}`) {
              await preferredWallet.switchChain(frontendEnv.chainId).catch(() => {});
            }
            const provider = await preferredWallet.getEthereumProvider();
            if (!cancelled && provider) {
              activeEmbeddedWallet = {
                address: preferredWallet.address,
                provider,
              };
            }
          } catch {
            // Keep existing provider fallback if switching fails
          }
        }

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, accessToken);
          if (walletAddress) {
            window.localStorage.setItem(
              ACTIVE_WALLET_STORAGE_KEY,
              walletAddress.toLowerCase(),
            );
          }
        }

        const email = user.email?.address || user.google?.email || '';
        const authMethod = user.google ? 'GOOGLE' : 'EMAIL_OTP';

        const authResult = authenticateWithRealToken({
          userId: user.id,
          email,
          walletAddress,
          accessToken,
          authMethod,
        });
        queryClient.setQueryData(['avahui', 'auth-session'], authResult.session);

        const syncKey = `${user.id}:${walletAddress.toLowerCase()}`;
        if (walletAddress && syncedKeyRef.current !== syncKey && !frontendEnv.useMock) {
          syncedKeyRef.current = syncKey;
          await authApi
            .syncUser(
              {
                walletAddress,
                email: email || undefined,
                displayName: user.google?.name || undefined,
              },
              walletAddress,
              accessToken,
            )
            .catch(() => {});
          queryClient.invalidateQueries({ queryKey: ['avahui'] });
        }
      } catch {
        // Ignore transient Privy token refresh failures
      }
    };

    syncPrivySession();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken, queryClient, ready, user, wallets]);

  return null;
}

