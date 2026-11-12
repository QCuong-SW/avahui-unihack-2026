'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useAuthSession,
  useRequestEmailOtpMutation,
  useVerifyEmailOtpMutation,
} from '@/lib/auth/useAuthSession';
import { frontendEnv } from '@/config/env';
import { HoverHint } from '@/components/ui/HoverHint';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const OTP_LENGTH = 6;

export function OTPVerification() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useAuthSession();
  const verifyOtpMutation = useVerifyEmailOtpMutation();
  const resendOtpMutation = useRequestEmailOtpMutation();

  const emailFromQuery = searchParams?.get('email') || '';
  const forceOnboarding = searchParams?.get('onboarding') === '1';
  const targetEmail =
    session?.pendingOtp?.email ||
    emailFromQuery ||
    (frontendEnv.enableDevDemoTools ? 'minh.nguyen@avahui.io' : '');
  const targetUserId = session?.pendingOtp?.targetUserId || 'usr_01';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState<number>(60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const otpCode = digits.join('');
  const isComplete = otpCode.length === OTP_LENGTH && /^\d{6}$/.test(otpCode);
  const isSubmitting = verifyOtpMutation.isPending || isSuccess;

  const handleDigitChange = (index: number, rawValue: string) => {
    const numeric = rawValue.replace(/\D/g, '');
    setErrorMessage(null);

    if (!numeric) {
      const updated = [...digits];
      updated[index] = '';
      setDigits(updated);
      return;
    }

    const char = numeric[numeric.length - 1];
    const updated = [...digits];
    updated[index] = char;
    setDigits(updated);

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, OTP_LENGTH);
    if (!pasted) return;

    setErrorMessage(null);
    const nextDigits = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      nextDigits[i] = pasted[i];
    }
    setDigits(nextDigits);

    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete || isSubmitting) return;
    setErrorMessage(null);

    try {
      const result = await verifyOtpMutation.mutateAsync(otpCode);
      setIsSuccess(true);
      const shouldGoToOnboarding =
        forceOnboarding || result.requiresWalletOnboarding;
      router.push(shouldGoToOnboarding ? '/onboarding/wallet' : '/dashboard');
    } catch (err) {
      const code = err instanceof Error ? err.message : 'INVALID_OTP';
      if (code === 'OTP_EXPIRED') {
        setErrorMessage('Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.');
      } else {
        setErrorMessage('Mã OTP không hợp lệ. Vui lòng kiểm tra và thử lại.');
      }
    }
  };

  const handleResend = async () => {
    if (!targetEmail || countdown > 0 || resendOtpMutation.isPending) return;
    setErrorMessage(null);
    try {
      await resendOtpMutation.mutateAsync({
        email: targetEmail,
        targetUserId,
      });
      setDigits(Array(OTP_LENGTH).fill(''));
      setCountdown(60);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Không thể gửi lại mã OTP lúc này. Vui lòng thử lại.',
      );
    }
  };

  if (!targetEmail) {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-md items-center justify-center py-4 sm:py-6 animate-fade-in">
        <div className="w-full rounded-none border border-zinc-800 bg-surface-card p-6 sm:p-8 text-center font-mono space-y-4 shadow-xl">
          <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
          <h1 className="text-lg font-extrabold uppercase text-white">
            Chưa có phiên xác thực OTP
          </h1>
          <p className="text-xs text-zinc-400">
            Vui lòng nhập email ở trang đăng nhập để nhận mã xác thực 6 chữ số.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-none bg-avalanche-red px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại đăng nhập</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md items-center justify-center py-4 sm:py-6 animate-fade-in">
      <div className="w-full rounded-none border border-zinc-800 bg-surface-card p-5 sm:p-9 shadow-xl animate-scale-in">
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Quay lại đăng nhập</span>
          </Link>

          {!session?.pendingOtp?.isRealPrivy && frontendEnv.enableDevDemoTools && (
            <HoverHint
              hint="Mã OTP thử nghiệm: 123456 (Nhập 000000 để kiểm thử lỗi OTP không hợp lệ)"
              side="left"
            >
              <span className="cursor-help rounded-none border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                Demo OTP: 123456
              </span>
            </HoverHint>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <AvahuiLogo size={42} roundedClass="rounded-none" />
          <div>
            <h1 className="font-mono text-xl font-extrabold uppercase tracking-wider text-white">
              Xác thực mã OTP
            </h1>
            <p className="font-mono text-xs leading-relaxed text-zinc-400">
              Mã 6 chữ số đã gửi tới{' '}
              <strong className="text-zinc-200">{targetEmail}</strong>
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-none border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 font-mono text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 font-mono text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Xác thực thành công! Đang chuyển tiếp...</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="mt-6 space-y-5">
          {/* 6-Digit OTP Boxes */}
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={isSubmitting}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                aria-label={`OTP digit ${idx + 1}`}
                className={`h-12 w-full rounded-none border bg-zinc-900 text-center font-mono text-lg font-extrabold text-white focus:outline-none disabled:opacity-60 ${
                  errorMessage
                    ? 'border-rose-500 focus:border-rose-500'
                    : digit
                    ? 'border-avalanche-red'
                    : 'border-zinc-700 focus:border-avalanche-red'
                }`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={!isComplete || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-none bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang xác thực...</span>
              </>
            ) : (
              <span>Xác nhận OTP</span>
            )}
          </button>
        </form>

        {/* Resend OTP + Countdown Timer */}
        <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4 font-mono text-xs">
          <span className="text-zinc-400">Chưa nhận được mã?</span>
          {countdown > 0 ? (
            <span className="font-mono text-zinc-500">
              Gửi lại sau {countdown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendOtpMutation.isPending}
              className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-avalanche-red hover:underline"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Gửi lại mã OTP</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
