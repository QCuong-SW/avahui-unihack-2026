'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider } from '@privy-io/react-auth';
import { avalancheFuji } from 'viem/chains';
import { TxLifecycleProvider } from '@/features/transactions/hooks/useTxLifecycle';
import { AppShell } from '@/components/layout/AppShell';
import { frontendEnv } from '@/config/env';
import { PrivyRuntimeSync } from '@/lib/privy/privyBridge';
import { wakeUpBackendServer } from '@/lib/api/client';

/**
 * Continuous Backend Keep-Alive & Cold-Start Wakeup Engine:
 * - Immediately pings backend on mount, tab focus, visibilitychange, and network reconnect
 * - If backend is sleeping (cold start), polls aggressively every 3s until awake and then
 *   invalidates React Query caches so UI data populates automatically
 * - Maintains a continuous 45s heartbeat so Render & Neon Postgres never spin down
 */
function BackendKeepAliveWarmup({ queryClient }: { queryClient: QueryClient }) {
  React.useEffect(() => {
    let isMounted = true;
    let wakeupBurstTimer: ReturnType<typeof setInterval> | null = null;

    const stopBurst = () => {
      if (wakeupBurstTimer) {
        clearInterval(wakeupBurstTimer);
        wakeupBurstTimer = null;
      }
    };

    const triggerWakeupCheck = async () => {
      const awake = await wakeUpBackendServer(10_000);
      if (!isMounted) return;

      if (awake) {
        if (wakeupBurstTimer) {
          stopBurst();
          queryClient.invalidateQueries();
        }
      } else if (!wakeupBurstTimer) {
        // Server is cold-starting: hammer every 3s until it wakes up
        wakeupBurstTimer = setInterval(async () => {
          const nowAwake = await wakeUpBackendServer(8_000);
          if (!isMounted) return;
          if (nowAwake) {
            stopBurst();
            queryClient.invalidateQueries();
          }
        }, 3_000);
      }
    };

    triggerWakeupCheck();

    // Steady 45-second keep-alive heartbeat while app is open
    const steadyInterval = setInterval(() => {
      wakeUpBackendServer(12_000).catch(() => {});
    }, 45_000);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerWakeupCheck();
      }
    };

    window.addEventListener('focus', onVisibilityOrFocus);
    window.addEventListener('online', triggerWakeupCheck);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    return () => {
      isMounted = false;
      stopBurst();
      clearInterval(steadyInterval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      window.removeEventListener('online', triggerWakeupCheck);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, [queryClient]);

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
            retry: 2,
            retryDelay: 2_000,
          },
        },
      }),
  );

  const coreTree = (
    <TxLifecycleProvider>
      <BackendKeepAliveWarmup queryClient={queryClient} />
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
