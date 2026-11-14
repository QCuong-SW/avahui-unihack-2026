'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/useAuthSession';
import { CyberLoading } from '@/components/ui/CyberLoading';

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
      <CyberLoading
        title="Đang xác thực phiên đăng nhập..."
        subtitle="Kiểm tra chữ ký số bảo mật & trạng thái kết nối máy chủ"
        minHeight="min-h-[60vh]"
      />
    );
  }

  if (!session.isAuthenticated && !isAuthRoute) {
    return null;
  }

  return <>{children}</>;
}
