'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import {
  isUserRejectedError,
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

  const [email, setEmail] = useState(
    frontendEnv.enableDevDemoTools ? 'minh.nguyen@avahui.io' : '',
  );
  const [selectedUserId, setSelectedUserId] = useState('usr_01');
  const [simulateNewWalletSetup, setSimulateNewWalletSetup] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  const [uiState, setUiState] = useState<LoginUiState>('DEFAULT');
  const [errorText, setErrorText] = useState<string | null>(null);

  // Pre-warm backend API health silently so cold-start sleep delay is eliminated
  useEffect(() => {
    fetch('https://avahui-api.onrender.com/api/v1/health', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    }).catch(() => {});
  }, []);

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
      setUiState('DEFAULT');
      setErrorText(
        err?.message || 'Đăng nhập không thành công: Xác thực Google thất bại. Vui lòng thử lại.',
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
      setUiState('DEFAULT');
      setErrorText(
        err?.message || 'Đăng nhập không thành công: Không thể gửi mã OTP lúc này. Vui lòng thử lại.',
      );
    }
  };

  const handleCancelWalletLogin = () => {
    setUiState('DEFAULT');
    setErrorText('Đăng nhập không thành công: Bạn đã hủy kết nối ví.');
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
      // RESET UI BACK TO DEFAULT: SPINNER STOPS IMMEDIATELY, BUTTON IS RE-ENABLED
      setUiState('DEFAULT');
      const isRejected = isUserRejectedError(err);
      setErrorText(
        isRejected
          ? 'Đăng nhập không thành công: Bạn đã hủy hoặc từ chối kết nối ví.'
          : (err?.message || 'Đăng nhập không thành công: Xác thực ví thất bại hoặc bị gián đoạn.')
      );
    }
  };

  return (
    <div className="relative mx-auto grid min-h-[80vh] max-w-5xl items-center gap-6 sm:gap-8 py-4 sm:py-6 lg:grid-cols-12 animate-fade-in">
      {/* Ambient Glow Lights Behind Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-avalanche-red/10 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-[100px]"
      />

      {/* Left Section – Brand Presentation */}
      <div className="relative flex flex-col justify-between space-y-6 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-6 sm:p-9 backdrop-blur-xl shadow-2xl overflow-hidden lg:col-span-6 animate-fade-down">
        {/* Top Crimson Accent Beam */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-avalanche-red/80 to-transparent" />

        <div className="space-y-6">
          {/* Brand Header with Live Network Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-avalanche-red/40 bg-avalanche-red/10 shadow-[0_0_15px_rgba(232,65,66,0.25)]">
                <AvahuiLogo size={32} roundedClass="rounded-md" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xl font-extrabold uppercase tracking-tight text-white">
                    Avahui
                  </span>
                  <span className="rounded-md border border-avalanche-red/40 bg-avalanche-red/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-avalanche-red">
                    ON-CHAIN ROSCA
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
                  <span>Avalanche Fuji Testnet (43113)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mascot Avahui Showcase with Holographic Floating Frame */}
          <div className="flex justify-center py-2">
            <HoverHint
              hint="Mascot Avahui — Biểu tượng kỷ luật tài chính tự động trên Avalanche"
              side="top"
            >
              <div className="group relative animate-float-slow">
                <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-avalanche-red/40 via-emerald-500/20 to-avalanche-red/40 opacity-70 blur-md transition duration-500 group-hover:opacity-100" />
                <div className="relative overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950 p-2 shadow-2xl">
                  <img
                    src="/avahui-logo.jpg"
                    alt="Mascot Avahui"
                    className="h-36 w-36 rounded-lg object-cover transition-transform duration-500 group-hover:scale-105 sm:h-40 sm:w-40"
                  />
                  <div className="absolute bottom-2 inset-x-2 rounded-md bg-black/80 backdrop-blur-md py-1 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-300 border border-white/10">
                    AVAHUI ON-CHAIN
                  </div>
                </div>
              </div>
            </HoverHint>
          </div>

          {/* Slogan & Key Security Highlights */}
          <div className="space-y-3 text-center sm:text-left">
            <h1 className="text-2xl font-black leading-snug tracking-tight text-white sm:text-3xl">
              Hụi Minh Bạch.{' '}
              <span className="bg-gradient-to-r from-avalanche-red via-rose-400 to-amber-300 bg-clip-text text-transparent">
                Không Thể Giật Hụi.
              </span>
            </h1>

            <p className="text-xs sm:text-sm leading-relaxed text-zinc-400">
              Chuyển đổi dây hụi truyền thống sang hợp đồng thông minh tự động:
              Tiền cọc tự bù khi có người trễ, bỏ thăm kín mật mã và sinh lãi
              khoản cọc nhàn rỗi.
            </p>

            {/* Micro Feature Matrix */}
            <div className="grid gap-2 pt-2 text-left font-mono text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-zinc-300">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Hợp đồng tự động giữ quỹ — không ai ôm tiền bỏ trốn</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-zinc-300">
                <span className="text-sky-400 font-bold">✓</span>
                <span>Bỏ thăm kín 2 bước — bảo mật giá thăm tuyệt đối</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-zinc-300">
                <span className="text-amber-400 font-bold">✓</span>
                <span>Tiền cọc sinh lãi ~6.5%/năm &amp; tự bù khi trễ hạn</span>
              </div>
            </div>
          </div>
        </div>

        {/* Avalanche Ecosystem Branding */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-avalanche-red" />
            <span className="font-mono font-bold uppercase tracking-wider text-zinc-200">
              Built on Avalanche
            </span>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
            Fuji C-Chain 43113
          </span>
        </div>
      </div>

      {/* Right Section – Authentication Form */}
      <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-6 sm:p-9 backdrop-blur-xl shadow-2xl shadow-black/80 lg:col-span-6 animate-fade-up">
        {/* Top Emerald Accent Beam */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900/90 text-avalanche-red">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mono text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              Đăng Nhập Avahui
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Truy cập ngay vào dây hụi minh bạch của bạn.
            </p>
          </div>
        </div>

        {/* Status Alert Banner (Error / Success) */}
        {errorText && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 font-mono text-xs text-rose-300 shadow-sm animate-fade-down">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span className="leading-snug">{errorText}</span>
          </div>
        )}

        {uiState === 'SUCCESS' && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 font-mono text-xs text-emerald-300 shadow-sm animate-fade-down">
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
              hoặc đăng nhập bằng
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
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleExternalWalletLogin}
              disabled={isBusy}
              className="group relative flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-700/80 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-900 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200 shadow-md transition-all duration-200 hover:border-avalanche-red/60 hover:text-white hover:shadow-[0_0_20px_rgba(232,65,66,0.2)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uiState === 'LOADING_WALLET' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-avalanche-red" />
                  <span>Đang kết nối ví...</span>
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-avalanche-red" />
                  <span>Kết nối Ví Web3 (Core / MetaMask — không tốn gas)</span>
                </>
              )}
            </button>

            {/* Quick Cancel button if user closes popup or wants to cancel midway */}
            {uiState === 'LOADING_WALLET' && (
              <div className="flex items-center justify-center gap-2 pt-1.5 animate-fade-in">
                <span className="font-mono text-[11px] text-zinc-400">
                  Chưa thấy popup hoặc muốn hủy?
                </span>
                <button
                  type="button"
                  onClick={handleCancelWalletLogin}
                  className="font-mono text-[11px] font-bold text-rose-400 underline hover:text-rose-300 transition"
                >
                  Hủy thao tác
                </button>
              </div>
            )}
          </div>
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
              <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
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
                        className={`flex items-center justify-between rounded-md px-3 py-2 text-left font-mono text-xs transition ${
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
                    className="rounded border-zinc-700 bg-zinc-900 text-avalanche-red focus:ring-0"
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

        {/* Terms of Service & Legal Compliance */}
        <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-zinc-500">
          Tuân thủ Nghị định 19/2019/NĐ-CP về Họ, Hụi, Biêu, Phường. Hợp đồng
          thông minh mã nguồn mở trên mạng Avalanche C-Chain.
        </p>
      </div>
    </div>
  );
}
