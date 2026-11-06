import React, { Suspense } from 'react';
import { OTPVerification } from '@/components/auth/OTPVerification';

export default function LoginVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-xs text-zinc-400">
          Đang tải...
        </div>
      }
    >
      <OTPVerification />
    </Suspense>
  );
}
