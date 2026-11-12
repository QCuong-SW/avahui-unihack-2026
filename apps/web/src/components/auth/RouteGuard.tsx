'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/useAuthSession';

const AUTH_PUBLIC_ROUTES = ['/login', '/login/verify'];
const ALWAYS_PUBLIC_ROUTES = ['/', '/guide'];

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { data: session, isLoading } = useAuthSession();

  const isAlwaysPublic = ALWAYS_PUBLIC_ROUTES.includes(pathname);
  const isAuthRoute = AUTH_PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    if (isLoading || !session || isAlwaysPublic) return;

    if (!session.isAuthenticated && !isAuthRoute) {
      router.replace('/login');
      return;
    }

    if (session.isAuthenticated && isAuthRoute) {
      const hasOnboardedWallet = session.onboardedUserIds.includes(
        session.userId
      );
      router.replace(
        hasOnboardedWallet ? '/dashboard' : '/onboarding/wallet'
      );
    }
  }, [isAlwaysPublic, isAuthRoute, isLoading, router, session]);

  if (isAlwaysPublic) {
    return <>{children}</>;
  }

  if (isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-xs text-zinc-400">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (!session.isAuthenticated && !isAuthRoute) {
    return null;
  }

  return <>{children}</>;
}
