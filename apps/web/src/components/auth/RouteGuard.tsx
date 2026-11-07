'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/useAuthSession';

const PUBLIC_ROUTES = ['/login', '/login/verify'];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { data: session, isLoading } = useAuthSession();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    if (isLoading || !session) return;

    if (!session.isAuthenticated && !isPublicRoute) {
      router.replace('/login');
      return;
    }

    if (session.isAuthenticated && isPublicRoute) {
      const hasOnboardedWallet = session.onboardedUserIds.includes(
        session.userId
      );
      router.replace(
        hasOnboardedWallet ? '/dashboard' : '/onboarding/wallet'
      );
    }
  }, [isLoading, isPublicRoute, router, session]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-xs text-zinc-400">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!session.isAuthenticated && !isPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
