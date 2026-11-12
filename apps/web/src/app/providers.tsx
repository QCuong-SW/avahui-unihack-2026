'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { avalancheFuji } from 'viem/chains';
import { TxLifecycleProvider } from '@/features/transactions/hooks/useTxLifecycle';
import { AppShell } from '@/components/layout/AppShell';
import { frontendEnv } from '@/config/env';
import { PrivyRuntimeSync } from '@/lib/privy/privyBridge';

function BackendKeepAliveWarmup() {
  React.useEffect(() => {
    const ping = () => {
      fetch('https://avahui-api.onrender.com/api/v1/health', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
      }).catch(() => {});
    };

    ping();
    const timer = setInterval(ping, 240_000);
    return () => clearInterval(timer);
  }, []);

  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 3_000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const coreTree = (
    <TxLifecycleProvider>
      <BackendKeepAliveWarmup />
      <AppShell>{children}</AppShell>
    </TxLifecycleProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      {frontendEnv.hasRealPrivyAppId ? (
        <PrivyProvider
          appId={frontendEnv.privyAppId}
          config={{
            appearance: {
              theme: 'dark',
              accentColor: '#E84142',
            },
            loginMethods: ['google', 'email', 'wallet'],
            defaultChain: avalancheFuji,
            supportedChains: [avalancheFuji],
            embeddedWallets: {
              ethereum: {
                createOnLogin: 'users-without-wallets',
              },
            },
          }}
        >
          <PrivyRuntimeSync />
          {coreTree}
        </PrivyProvider>
      ) : (
        coreTree
      )}
    </QueryClientProvider>
  );
}
