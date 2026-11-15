'use client';

import React, { useEffect, useState } from 'react';
import { AvahuiLogo } from './AvahuiLogo';
import {
  BACKEND_AWAKE_EVENT,
  wakeUpBackendServer,
} from '@/lib/api/client';
import {
  Activity,
  CheckCircle2,
  Clock,
  CloudLightning,
  RefreshCw,
  Server,
} from 'lucide-react';

export interface CyberLoadingProps {
  title?: string;
  subtitle?: string;
  minHeight?: string;
  fullScreen?: boolean;
  onRetry?: () => void;
}

export function CyberLoading({
  title = 'Đang tải dữ liệu hệ thống...',
  subtitle = 'Khởi tạo kết nối bảo mật & đồng bộ hợp đồng thông minh',
  minHeight = 'min-h-[50vh]',
  fullScreen = false,
  onRetry,
}: CyberLoadingProps) {
  const [elapsed, setElapsed] = useState(0);
  const [pingCount, setPingCount] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Actively wake up backend every 2.5s while user is on loading screen
  useEffect(() => {
    let active = true;
    const handleAwake = () => {
      if (active && onRetry) {
        onRetry();
      }
    };

    window.addEventListener(BACKEND_AWAKE_EVENT, handleAwake);

    const wakeTimer = setInterval(async () => {
      if (!active) return;
      setPingCount((c) => c + 1);
      const isUp = await wakeUpBackendServer(6_000);
      if (active && isUp && onRetry) {
        onRetry();
      }
    }, 2_500);

    return () => {
      active = false;
      window.removeEventListener(BACKEND_AWAKE_EVENT, handleAwake);
      clearInterval(wakeTimer);
    };
  }, [onRetry]);

  const isWakingUp = elapsed >= 3;
  const isTakingLonger = elapsed >= 15;

  const content = (
    <div className="relative mx-auto flex w-full max-w-lg flex-col items-center justify-center p-6 text-center">
      {/* Outer Glow Orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 h-44 w-44 rounded-full bg-avalanche-red/15 blur-3xl animate-pulse"
      />

      {/* Cyber Radar / Logo Pulse Graphic */}
      <div className="relative mb-5 flex h-24 w-24 items-center justify-center">
        {/* Pulsing ring 1 */}
        <div className="absolute inset-0 rounded-2xl border-2 border-avalanche-red/30 animate-ping opacity-25" />
        {/* Pulsing ring 2 */}
        <div className="absolute inset-1.5 rounded-2xl border border-avalanche-red/50 animate-pulse" />
        {/* Rotating radar corner dash */}
        <div className="absolute -inset-1 rounded-3xl border border-dashed border-red-500/40 animate-[spin_10s_linear_infinite]" />

        {/* Central Logo Box */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-avalanche-red/60 bg-gradient-to-br from-zinc-900 via-zinc-950 to-red-950/40 shadow-[0_0_25px_rgba(232,65,66,0.35)]">
          <AvahuiLogo size={40} roundedClass="rounded-lg" />
        </div>
      </div>

      {/* Title & Subtitle */}
      <h3 className="font-mono text-base sm:text-lg font-black uppercase tracking-wider text-white">
        {title}
      </h3>
      <p className="mt-1 font-mono text-xs text-zinc-400 max-w-sm">
        {subtitle}
      </p>

      {/* Cybernetic Progress Scanning Bar */}
      <div className="relative mt-5 h-1.5 w-60 overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
        <div className="absolute top-0 bottom-0 left-0 w-2/5 rounded-full bg-gradient-to-r from-transparent via-avalanche-red to-red-400 animate-[pulse_1.5s_ease-in-out_infinite]" />
        <div className="absolute top-0 bottom-0 w-1/3 rounded-full bg-gradient-to-r from-red-500/60 to-emerald-400/80 animate-[slide-in-right_2s_linear_infinite]" />
      </div>

      {/* Cold Start / Cloud Server Wakeup Notice (shows smoothly when waiting >= 3s) */}
      {isWakingUp ? (
        <div className="mt-6 w-full rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-zinc-950/90 to-zinc-950/95 p-4 sm:p-5 text-left shadow-2xl backdrop-blur-xl animate-fade-in transition-all">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
              <span className="font-mono text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-300">
                Đang đánh thức máy chủ (Auto Wake-Up #{pingCount})
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-zinc-400">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>{elapsed}s</span>
            </div>
          </div>

          <p className="mt-2.5 text-xs text-zinc-300 leading-relaxed font-sans">
            Hệ thống đang tự động gửi xung đánh thức liên tục tới máy chủ đám mây (Cold Start). Vui lòng
            chờ trong giây lát (<span className="text-amber-400 font-semibold font-mono">khoảng 10-30s</span>) để nạp dữ liệu Smart Contract & Avalanche Fuji.
          </p>

          {/* Micro Telemetry Steps */}
          <div className="mt-3.5 space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3 font-mono text-[11px]">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Avalanche Fuji RPC</span>
              </span>
              <span className="text-emerald-400 font-semibold">Sẵn sàng (43113)</span>
            </div>

            <div className="flex items-center justify-between text-zinc-200">
              <span className="flex items-center gap-2">
                <CloudLightning className="h-3.5 w-3.5 text-amber-400 animate-bounce shrink-0" />
                <span>Backend Render API</span>
              </span>
              <span className="text-amber-400 font-semibold animate-pulse">
                Đang kích hoạt ({elapsed}s)...
              </span>
            </div>

            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                <span>Dữ liệu Dây hụi & Vault</span>
              </span>
              <span className="text-zinc-500">Tự động nạp ngay khi thức</span>
            </div>
          </div>

          {/* Extended wait hint & retry trigger */}
          {isTakingLonger && (
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/60">
              <span className="text-[11px] text-zinc-400 font-mono">
                Đang kết nối lại lần #{pingCount}...
              </span>
              <button
                type="button"
                onClick={() => {
                  wakeUpBackendServer(10_000).then(() => {
                    if (onRetry) {
                      onRetry();
                    } else if (typeof window !== 'undefined') {
                      window.location.reload();
                    }
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-amber-500/20 active:scale-95 transition-all"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Kích hoạt ngay</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Subtle first 3 seconds state hint */
        <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-zinc-500">
          <Server className="h-3.5 w-3.5 text-zinc-400 animate-pulse" />
          <span>Đang kiểm tra tín hiệu máy chủ ({elapsed}s)...</span>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md px-4">
        {content}
      </div>
    );
  }

  return (
    <div
      className={`flex w-full items-center justify-center ${minHeight} py-8 px-4`}
    >
      {content}
    </div>
  );
}
