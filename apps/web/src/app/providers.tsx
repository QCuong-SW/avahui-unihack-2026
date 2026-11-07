'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TxLifecycleProvider } from '@/features/transactions/hooks/useTxLifecycle';
import { AppShell } from '@/components/layout/AppShell';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TxLifecycleProvider>
        <AppShell>{children}</AppShell>
      </TxLifecycleProvider>
    </QueryClientProvider>
  );
}
