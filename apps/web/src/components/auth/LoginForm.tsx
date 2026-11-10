'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import {
  useProviderLoginMutation,
  useRequestEmailOtpMutation,
  useSiweLoginMutation,
} from '@/lib/auth/useAuthSession';
import { frontendEnv } from '@/config/env';
import { isValidEmail } from '@/lib/auth/authSession';
import { GoogleLoginButton } from './GoogleLoginButton';
import { EmailLoginForm } from './EmailLoginForm';
import { shortenAddress } from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

type LoginUiState =
  | 'DEFAULT'
  | 'LOADING_GOOGLE'
  | 'LOADING_EMAIL'
  | 'LOADING_WALLET'
  | 'SUCCESS'
  | 'INVALID_EMAIL'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR';

export function LoginForm() {
  const router = useRouter();
  const { data: state } = useAvaHuiState();
  const providerLoginMutation = useProviderLoginMutation();
  const requestOtpMutation = useRequestEmailOtpMutation();
  const siweLoginMutation = useSiweLoginMutation();

  const [email, setEmail] = useState('minh.nguyen@avahui.io');
  const [selectedUserId, setSelectedUserId] = useState('usr_01');
  const [simulateNewWalletSetup, setSimulateNewWalletSetup] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  const [uiState, setUiState] = useState<LoginUiState>('DEFAULT');
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!state) return null;

  const isBusy =
    uiState === 'LOADING_GOOGLE' ||
    uiState === 'LOADING_EMAIL' ||
    uiState === 'LOADING_WALLET' ||
    uiState === 'SUCCESS';

  const selectedUser =
    state.users.find((u) => u.id === selectedUserId) || state.users[0];

  const handleGoogleLogin = async () => {
    if (isBusy) return;
    setErrorText(null);
    setUiState('LOADING_GOOGLE');

    try {
      const result = await providerLoginMutation.mutateAsync({
        method: 'GOOGLE',
        userId: selectedUser.id,
        email: selectedUser.email,
        forceWalletOnboarding: simulateNewWalletSetup,
      });
      if ('redirectedToOAuth' in result && result.redirectedToOAuth) {
        return;
      }
      setUiState('SUCCESS');
      router.push(
        result.requiresWalletOnboarding ? '/onboarding/wallet' : '/dashboard'
      );
    } catch (err: any) {
      setUiState('AUTH_FAILED');
      setErrorText(
        err?.message || 'Xác thực Google không thành công. Vui lòng thử lại.',
      );
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setErrorText(null);

    if (!isValidEmail(email)) {
      setUiState('INVALID_EMAIL');
      setErrorText('Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }

    setUiState('LOADING_EMAIL');
    try {
      const matchedUser =
        state.users.find(
          (u) => u.email.toLowerCase() === email.trim().toLowerCase()
        ) || selectedUser;

      await requestOtpMutation.mutateAsync({
        email: email.trim(),
        targetUserId: matchedUser.id,
      });

      setUiState('SUCCESS');
      const onboardingParam = simulateNewWalletSetup ? '&onboarding=1' : '';
      router.push(
        `/login/verify?email=${encodeURIComponent(email.trim())}${onboardingParam}`
      );
    } catch (err: any) {
      setUiState('NETWORK_ERROR');
      setErrorText(
        err?.message || 'Không thể gửi mã OTP lúc này. Vui lòng thử lại.',
      );
    }
  };

  const handleExternalWalletLogin = async () => {
    if (isBusy) return;
    setErrorText(null);
    setUiState('LOADING_WALLET');

    try {
      const result = await siweLoginMutation.mutateAsync({
        forceWalletOnboarding: simulateNewWalletSetup,
      });
      setUiState('SUCCESS');
      router.push(
        result.requiresWalletOnboarding ? '/onboarding/wallet' : '/dashboard'
      );
    } catch (err: any) {
      setUiState('AUTH_FAILED');
      setErrorText(
        err?.message || 'Xác thực chữ ký ví (SIWE) thất bại hoặc bị từ chối.',
      );
    }
  };

  return (
    <div className="mx-auto grid min-h-[78vh] max-w-5xl items-center gap-6 sm:gap-8 py-3 sm:py-4 lg:grid-cols-12 animate-fade-in">
      {/* Left Section – Brand Presentation */}
      <div className="flex flex-col justify-between space-y-6 rounded-none border border-zinc-800 bg-zinc-900/50 p-5 sm:p-10 lg:col-span-6 animate-fade-down">
        <div className="space-y-6">
          {/* Avahui Logo & Brand Title */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AvahuiLogo size={42} roundedClass="rounded-none" />
              <div>
                <span className="font-mono text-xl font-extrabold uppercase tracking-tight text-white">
                  Avahui
                </span>
                <span className="ml-2 rounded-none border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  ON-CHAIN ROSCA
                </span>
              </div>
            </div>
          </div>

          {/* Mascot Avahui Showcase */}
          <div className="flex justify-center py-1">
            <HoverHint
              hint="Mascot Avahui — Bảo chứng kỷ luật tài chính trên Avalanche"
              side="top"
            >
              <div className="overflow-hidden rounded-none border border-avalanche-red/40 bg-black p-1.5 shadow-xl shadow-avalanche-red/10">
                <img
                  src="/avahui-logo.jpg"
                  alt="Mascot Avahui"
                  className="h-36 w-36 rounded-none object-cover sm:h-40 sm:w-40"
                />
              </div>
            </HoverHint>
          </div>

          {/* Slogan & Short Intro */}
          <div className="space-y-2.5 text-center sm:text-left">
            <h1 className="text-2xl font-extrabold leading-snug tracking-tight text-white sm:text-3xl">
              Hụi minh bạch.{' '}
              <span className="text-avalanche-red">Niềm tin vững chắc.</span>
            </h1>

            <p className="text-sm leading-relaxed text-zinc-400">
              Nền tảng quản lý vòng hụi xoay vòng tự động với cơ chế khóa tài
              sản thế chấp minh bạch. Đăng nhập nhanh bằng tài khoản cá nhân mà
              không cần tự quản lý khóa bảo mật phức tạp.
            </p>
          </div>
        </div>

        {/* Avalanche Ecosystem Branding */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-5 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <AvahuiLogo size={20} roundedClass="rounded-none" />
            <span className="font-mono font-semibold uppercase tracking-wider text-zinc-200">
              Built on Avalanche
            </span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
            Fuji Testnet (43113)
          </span>
        </div>
      </div>

      {/* Right Section – Authentication Form */}
      <div className="rounded-none border border-zinc-800 bg-surface-card p-5 sm:p-10 shadow-xl lg:col-span-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <AvahuiLogo size={38} roundedClass="rounded-none" />
          <div>
            <h2 className="font-mono text-2xl font-extrabold uppercase tracking-tight text-white">
              Welcome to Avahui
            </h2>
            <p className="text-sm text-zinc-400">
              Đăng nhập để quản lý vòng hụi của bạn.
            </p>
          </div>
        </div>

        {/* Status Alert Banner (Error / Success) */}
        {errorText && (
          <div className="mt-4 flex items-center gap-2 rounded-none border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 font-mono text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorText}</span>
          </div>
        )}

        {uiState === 'SUCCESS' && (
          <div className="mt-4 flex items-center gap-2 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 font-mono text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Xác thực thành công! Đang chuyển hướng...</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* 1. Continue with Google */}
          <GoogleLoginButton
            onClick={handleGoogleLogin}
            isLoading={uiState === 'LOADING_GOOGLE'}
            disabled={isBusy}
          />

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-zinc-800" />
            <span className="mx-3 shrink-0 font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              hoặc
            </span>
            <div className="flex-grow border-t border-zinc-800" />
          </div>

          {/* 2. Continue with Email (OTP) */}
          <EmailLoginForm
            email={email}
            onEmailChange={(val) => {
              setEmail(val);
              if (uiState === 'INVALID_EMAIL') {
                setUiState('DEFAULT');
                setErrorText(null);
              }
            }}
            onSubmit={handleEmailSubmit}
            isLoading={uiState === 'LOADING_EMAIL'}
            disabled={isBusy}
            errorMessage={uiState === 'INVALID_EMAIL' ? errorText : null}
          />

          {/* 3. Connect External Wallet via Cryptographic SIWE Signature */}
          <button
            type="button"
            onClick={handleExternalWalletLogin}
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uiState === 'LOADING_WALLET' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-avalanche-red" />
            ) : (
              <Wallet className="h-3.5 w-3.5 text-zinc-400" />
            )}
            <span>Connect Wallet (Core / MetaMask SIWE)</span>
          </button>
        </div>

        {/* Collapsible Demo Profile Switcher — ONLY visible in explicit local Dev mode */}
        {frontendEnv.enableDevDemoTools && (
          <div className="mt-5 border-t border-zinc-800/80 pt-4">
            <button
              type="button"
              onClick={() => setShowDemoOptions((v) => !v)}
              className="flex w-full items-center justify-between text-left font-mono text-xs text-zinc-400 hover:text-zinc-200"
            >
              <span className="inline-flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5 text-avalanche-red" />
                <span>
                  [DEV] Tài khoản thử nghiệm:{' '}
                  <strong className="text-white">{selectedUser.displayName.split(' (')[0]}</strong>
                </span>
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition ${
                  showDemoOptions ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showDemoOptions && (
              <div className="mt-3 space-y-2 rounded-none border border-zinc-800 bg-zinc-950/60 p-3">
                <div className="grid gap-1.5">
                  {state.users.map((u) => {
                    const active = u.id === selectedUserId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setEmail(u.email);
                        }}
                        className={`flex items-center justify-between rounded-none px-3 py-2 text-left font-mono text-xs transition ${
                          active
                            ? 'border border-avalanche-red/50 bg-avalanche-red/10 text-white'
                            : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                        }`}
                      >
                        <span className="font-bold">
                          {u.displayName.split(' (')[0]}
                        </span>
                        <span className="font-mono text-[10px] text-zinc-500">
                          {shortenAddress(u.walletAddress)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label className="flex cursor-pointer items-center gap-2 border-t border-zinc-800 pt-2.5 font-mono text-[11px] text-zinc-400">
                  <input
                    type="checkbox"
                    checked={simulateNewWalletSetup}
                    onChange={(e) => setSimulateNewWalletSetup(e.target.checked)}
                    className="rounded-none border-zinc-700 bg-zinc-900 text-avalanche-red focus:ring-0"
                  />
                  <span>
                    Mô phỏng tài khoản mới (Chuyển qua bước{' '}
                    <code className="text-avalanche-red">/onboarding/wallet</code>)
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Terms of Service & Privacy Policy */}
        <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-zinc-500">
          Bằng việc tiếp tục, bạn đồng ý với{' '}
          <span className="underline decoration-zinc-700 hover:text-zinc-300">
            Terms of Service
          </span>{' '}
          và{' '}
          <span className="underline decoration-zinc-700 hover:text-zinc-300">
            Privacy Policy
          </span>{' '}
          của Avahui.
        </p>
      </div>
    </div>
  );
}
