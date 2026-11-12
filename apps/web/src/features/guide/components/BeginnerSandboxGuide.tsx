'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSession } from '@/lib/auth/useAuthSession';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Coins,
  Eye,
  Fuel,
  Gavel,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';

export const BEGINNER_SANDBOX_EVENT = 'avahui:open-sandbox-tutorial';

const STORAGE_PREFIX = 'avahui_beginner_tour_done_';

export function dispatchOpenBeginnerSandbox() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BEGINNER_SANDBOX_EVENT));
  }
}

type ModalMode = 'CLOSED' | 'ASK_NEW_USER' | 'SANDBOX';

export function BeginnerSandboxGuide() {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { data: session } = useAuthSession();

  const [mode, setMode] = useState<ModalMode>('CLOSED');
  const [step, setStep] = useState<number>(1);

  // Interactive fake sandbox wallet & circle state (100% client-side, zero real txs)
  const [simUsdc, setSimUsdc] = useState<number>(0);
  const [simAvax, setSimAvax] = useState<number>(0);
  const [simCollateral, setSimCollateral] = useState<number>(0);
  const [simCredit, setSimCredit] = useState<number>(500);
  const [faucetUsdcDone, setFaucetUsdcDone] = useState(false);
  const [faucetGasDone, setFaucetGasDone] = useState(false);
  const [joinedCircle, setJoinedCircle] = useState(false);
  const [contributedR1, setContributedR1] = useState(false);
  const [bidAmount, setBidAmount] = useState<number>(15);
  const [bidCommitted, setBidCommitted] = useState(false);
  const [saltBackedUp, setSaltBackedUp] = useState(false);
  const [bidRevealed, setBidRevealed] = useState(false);
  const [withdrawnFinal, setWithdrawnFinal] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${session?.userId || 'guest'}`;

  const resetSandboxState = () => {
    setStep(1);
    setSimUsdc(0);
    setSimAvax(0);
    setSimCollateral(0);
    setSimCredit(500);
    setFaucetUsdcDone(false);
    setFaucetGasDone(false);
    setJoinedCircle(false);
    setContributedR1(false);
    setBidAmount(15);
    setBidCommitted(false);
    setSaltBackedUp(false);
    setBidRevealed(false);
    setWithdrawnFinal(false);
  };

  // Show welcome prompt automatically only on first authenticated app visit
  useEffect(() => {
    if (!session?.isAuthenticated) return;
    const isHiddenRoute =
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/onboarding/wallet');
    if (isHiddenRoute) return;

    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setMode('ASK_NEW_USER');
      }
    } catch {
      // ignore storage errors
    }
  }, [pathname, session?.isAuthenticated, storageKey]);

  // Allow launching sandbox anytime via custom event from /guide or Dashboard
  useEffect(() => {
    const handler = () => {
      resetSandboxState();
      setMode('SANDBOX');
    };
    window.addEventListener(BEGINNER_SANDBOX_EVENT, handler);
    return () => window.removeEventListener(BEGINNER_SANDBOX_EVENT, handler);
  }, []);

  const markTourSeen = () => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore
    }
  };

  const handleSkip = () => {
    markTourSeen();
    setMode('CLOSED');
  };

  const handleStartTraining = () => {
    markTourSeen();
    resetSandboxState();
    setMode('SANDBOX');
  };

  if (mode === 'CLOSED') return null;

  // =========================================================================
  // MODAL 1: WELCOME PROMPT ("Bạn có phải người mới không?")
  // =========================================================================
  if (mode === 'ASK_NEW_USER') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Hướng dẫn dành cho người mới"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
      >
        <div className="w-full max-w-lg rounded-none border border-zinc-700 bg-surface-card p-6 sm:p-7 shadow-2xl space-y-5 animate-scale-in">
          <div className="flex items-start justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-none border border-avalanche-red/40 bg-avalanche-red/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-avalanche-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Chào mừng tới AvaHui</span>
            </div>
            <button
              type="button"
              onClick={handleSkip}
              aria-label="Đóng hộp thoại"
              className="rounded-none p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <h2 className="font-mono text-lg sm:text-xl font-extrabold uppercase tracking-tight text-white">
              Bạn có phải người mới sử dụng AvaHui không?
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-300">
              Nếu mới bắt đầu, bạn có thể trải nghiệm chế độ{' '}
              <strong className="text-white">Giao diện Giả lập An toàn (Sandbox)</strong>{' '}
              để tập bấm thử toàn bộ quy trình nhận vốn thử nghiệm, khóa thế chấp, đóng hụi, bỏ thăm kín và rút tất toán trong khoảng 1 phút — hoàn toàn{' '}
              <strong className="text-emerald-400">không tốn tiền thật và không phát sinh giao dịch mạng</strong>.
            </p>
          </div>

          <div className="grid gap-2 rounded-none border border-zinc-800 bg-zinc-900/70 p-3.5 font-mono text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>Bước 1–2: Nhận mUSDC + Gas AVAX giả lập &amp; Tham gia dây</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>Bước 3–4: Đóng hụi đúng hạn &amp; Đấu giá kín 2 pha</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>Bước 5: Rút Thế chấp + Thưởng chiết khấu + Lãi 6.5% APY</span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 rounded-none border border-zinc-700 bg-zinc-900 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Bỏ qua, vào App ngay
            </button>
            <button
              type="button"
              onClick={handleStartTraining}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/25 transition hover:bg-avalanche-darkRed"
            >
              <span>Bắt đầu hướng dẫn</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODAL 2: INTERACTIVE FAKE UI SANDBOX (5 STEPS)
  // =========================================================================
  const grossPot = 250; // 5 members * 50 mUSDC
  const estimatedReceive = Math.max(0, grossPot - bidAmount);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chế độ Thực hành Mô phỏng AvaHui"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-3 sm:p-5 backdrop-blur-sm animate-fade-in"
    >
      <div className="my-auto w-full max-w-3xl rounded-none border border-zinc-700 bg-surface-card shadow-2xl overflow-hidden animate-scale-in">
        {/* Top Sandbox Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-none border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
              CHẾ ĐỘ MÔ PHỎNG (UI GIẢ LẬP)
            </span>
            <span className="font-mono text-xs font-bold text-zinc-300">
              Bước {step} / 5
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetSandboxState}
              className="inline-flex items-center gap-1 rounded-none border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-zinc-600 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Làm lại</span>
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 rounded-none border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-bold text-zinc-300 hover:border-rose-500/50 hover:text-rose-300"
            >
              <X className="h-3.5 w-3.5" />
              <span>Thoát</span>
            </button>
          </div>
        </div>

        {/* Stepper Bar */}
        <div className="grid grid-cols-5 border-b border-zinc-800 bg-zinc-900/70 font-mono text-[10px] font-bold uppercase">
          {[
            '1. Ví & Gas',
            '2. Vào dây',
            '3. Đóng hụi',
            '4. Đấu giá kín',
            '5. Rút tất toán',
          ].map((label, idx) => {
            const sNum = idx + 1;
            const active = step === sNum;
            const done = step > sNum || (sNum === 5 && withdrawnFinal);
            return (
              <div
                key={label}
                className={`border-r last:border-r-0 border-zinc-800 px-2 py-2 text-center truncate ${
                  active
                    ? 'bg-avalanche-red/15 text-white border-b-2 border-b-avalanche-red'
                    : done
                    ? 'text-emerald-400 bg-emerald-500/5'
                    : 'text-zinc-500'
                }`}
              >
                {done && !active ? `✓ ${label}` : label}
              </div>
            );
          })}
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Simulated Wallet Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-none border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-xs">
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Số dư ví giả lập</div>
              <div className="mt-0.5 font-extrabold text-emerald-400">
                {simUsdc.toFixed(2)} mUSDC
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Phí Gas AVAX</div>
              <div className="mt-0.5 font-extrabold text-amber-300">
                {simAvax.toFixed(4)} AVAX
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Thế chấp khóa</div>
              <div className="mt-0.5 font-extrabold text-white">
                {simCollateral.toFixed(2)} mUSDC
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500">Điểm Tín Nhiệm</div>
              <div className="mt-0.5 font-extrabold text-sky-300">
                {simCredit} / 1000
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* STEP 1: FAUCET mUSDC & GAS AVAX                                 */}
          {/* =============================================================== */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-none border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-100 space-y-1">
                <div className="font-mono font-bold uppercase text-sky-300">
                  Mục tiêu Bước 1: Chuẩn bị tiền thử nghiệm &amp; phí Gas
                </div>
                <p className="leading-relaxed text-zinc-300">
                  Ví mới tạo có số dư <strong className="text-white">0 mUSDC</strong> và <strong className="text-white">0 AVAX</strong>. Trên thanh công cụ của app thật, bạn bấm 2 nút dưới đây để nhận vốn thử nghiệm miễn phí trước khi vào dây hụi.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 rounded-none border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="space-y-2 rounded-none border border-zinc-800 bg-zinc-950 p-3.5">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-zinc-400">1A. Tiền đóng hụi thử</span>
                    {faucetUsdcDone && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <button
                    type="button"
                    disabled={faucetUsdcDone}
                    onClick={() => {
                      setSimUsdc((v) => v + 1000);
                      setFaucetUsdcDone(true);
                    }}
                    className={`flex w-full items-center justify-center gap-2 rounded-none px-4 py-2.5 font-mono text-xs font-bold uppercase transition ${
                      faucetUsdcDone
                        ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border border-avalanche-red bg-avalanche-red text-white hover:bg-avalanche-darkRed animate-pulse'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    <span>{faucetUsdcDone ? 'Đã nhận +1,000 mUSDC' : 'Bấm thử: Faucet +1,000 mUSDC'}</span>
                  </button>
                </div>

                <div className="space-y-2 rounded-none border border-zinc-800 bg-zinc-950 p-3.5">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-zinc-400">1B. Phí mạng Avalanche</span>
                    {faucetGasDone && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <button
                    type="button"
                    disabled={faucetGasDone}
                    onClick={() => {
                      setSimAvax((v) => v + 0.02);
                      setFaucetGasDone(true);
                    }}
                    className={`flex w-full items-center justify-center gap-2 rounded-none px-4 py-2.5 font-mono text-xs font-bold uppercase transition ${
                      faucetGasDone
                        ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border border-amber-400 bg-amber-500 text-zinc-950 hover:bg-amber-400 animate-pulse'
                    }`}
                  >
                    <Fuel className="h-4 w-4" />
                    <span>{faucetGasDone ? 'Đã nhận +0.02 AVAX' : 'Bấm thử: Nhận +0.02 AVAX Gas'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!faucetUsdcDone || !faucetGasDone}
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-2 rounded-none bg-avalanche-red px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <span>Tiếp tục Bước 2</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 2: JOIN CIRCLE & LOCK COLLATERAL                           */}
          {/* =============================================================== */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-none border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-100 space-y-1">
                <div className="font-mono font-bold uppercase text-sky-300">
                  Mục tiêu Bước 2: Tham gia dây hụi &amp; Khóa thế chấp bảo chứng
                </div>
                <p className="leading-relaxed text-zinc-300">
                  Để chống rủi ro người nhận sớm trễ hạn các kỳ sau, mọi thành viên đều khóa{' '}
                  <strong className="text-amber-300">100.00 mUSDC thế chấp (2x mức đóng)</strong>{' '}
                  vào hợp đồng. Số tiền này sẽ được hoàn lại 100% (cộng thưởng và lãi) khi dây kết thúc.
                </p>
              </div>

              {/* Fake Circle Card */}
              <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-sm font-extrabold text-white">
                    Dây Hụi Tập Sự (Mô phỏng • Đấu giá kín)
                  </div>
                  <span
                    className={`rounded-none border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      joinedCircle
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {joinedCircle ? 'Đang vận hành (5/5)' : 'Đang gom thành viên (4/5)'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-none border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-zinc-500">Kỳ đóng</div>
                    <div className="font-bold text-white">50.00 mUSDC</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500">Tổng quỹ kỳ</div>
                    <div className="font-bold text-emerald-400">250.00 mUSDC</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500">Thế chấp (2x)</div>
                    <div className="font-bold text-amber-300">100.00 mUSDC</div>
                  </div>
                </div>

                {!joinedCircle ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSimUsdc((v) => v - 100);
                      setSimCollateral(100);
                      setJoinedCircle(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed animate-pulse"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Bấm thử: Tham gia Slot #5 • Khóa 100.00 mUSDC</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-none border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 font-mono text-xs font-bold text-emerald-300">
                    <span>✓ Đã khóa 100.00 mUSDC thế chấp! Dây đã đủ 5/5 người và mở Kỳ #1.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs font-bold uppercase text-zinc-300 hover:text-white"
                >
                  ← Quay lại
                </button>
                <button
                  type="button"
                  disabled={!joinedCircle}
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 rounded-none bg-avalanche-red px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <span>Tiếp tục Bước 3</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 3: CONTRIBUTE ROUND #1                                     */}
          {/* =============================================================== */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-none border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-100 space-y-1">
                <div className="font-mono font-bold uppercase text-sky-300">
                  Mục tiêu Bước 3: Đóng góp đúng hạn ở Kỳ #1
                </div>
                <p className="leading-relaxed text-zinc-300">
                  Mỗi kỳ bạn cần bấm đóng <strong className="text-white">50.00 mUSDC</strong> trước giờ chốt. Đóng đúng hạn sẽ giúp bạn được cộng <strong className="text-emerald-400">+10 Điểm Tín Nhiệm</strong> (ngược lại nếu quên đóng, hợp đồng sẽ tự trích thế chấp bù vào quỹ).
                </p>
              </div>

              <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-zinc-300">1. Đóng hụi Kỳ #1</span>
                  <span className={contributedR1 ? 'font-bold text-emerald-400' : 'text-amber-300'}>
                    {contributedR1 ? 'Đã đóng (5/5)' : 'Chờ bạn đóng (4/5)'}
                  </span>
                </div>

                {!contributedR1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSimUsdc((v) => v - 50);
                      setSimCredit((v) => v + 10);
                      setContributedR1(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed animate-pulse"
                  >
                    <Coins className="h-4 w-4" />
                    <span>Bấm thử: Đóng hụi Kỳ #1 (50.00 mUSDC)</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-none border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-300 font-bold">
                    <span>✓ Đã đóng 50.00 mUSDC đúng hạn • Điểm Tín Nhiệm +10</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs font-bold uppercase text-zinc-300 hover:text-white"
                >
                  ← Quay lại
                </button>
                <button
                  type="button"
                  disabled={!contributedR1}
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 rounded-none bg-avalanche-red px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <span>Tiếp tục Bước 4</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 4: SEALED-BID 2 PHASES (COMMIT -> BACKUP -> REVEAL)        */}
          {/* =============================================================== */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-none border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-100 space-y-1">
                <div className="font-mono font-bold uppercase text-sky-300">
                  Mục tiêu Bước 4: Tập Đấu giá kín 2 pha (nếu muốn nhận quỹ kỳ này)
                </div>
                <p className="leading-relaxed text-zinc-300">
                  Mức đấu giá là khoản <strong className="text-white">chiết khấu</strong> bạn nhường cho nhóm để được nhận quỹ sớm (<strong className="text-emerald-400">Thực nhận = Tổng quỹ − Chiết khấu</strong>). Pha 1 (2/3 đầu giờ) khóa giá bằng mã băm mật mã để không ai nhìn trộm; Pha 2 (1/3 cuối giờ) mở niêm phong để so giá.
                </p>
              </div>

              <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-3 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold uppercase text-zinc-300">2. Bỏ thăm kín Kỳ #1</span>
                  <span className="font-bold text-emerald-400">
                    Thực nhận dự kiến: {estimatedReceive.toFixed(2)} mUSDC
                  </span>
                </div>

                {/* Preset slider buttons */}
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 shrink-0">Chọn thử mức chiết khấu:</span>
                  {[10, 15, 25].map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={bidCommitted}
                      onClick={() => setBidAmount(val)}
                      className={`rounded-none border px-2.5 py-1 font-bold transition ${
                        bidAmount === val
                          ? 'border-avalanche-red bg-avalanche-red/20 text-white'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-white'
                      } disabled:opacity-50`}
                    >
                      {val} mUSDC
                    </button>
                  ))}
                </div>

                {!bidCommitted ? (
                  <button
                    type="button"
                    onClick={() => setBidCommitted(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-3 font-bold uppercase text-white transition hover:bg-avalanche-darkRed animate-pulse"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Pha 1: Niêm phong mức giá {bidAmount} mUSDC</span>
                  </button>
                ) : (
                  <div className="space-y-2.5 rounded-none border border-sky-500/30 bg-sky-500/10 p-3">
                    <div className="flex items-center justify-between text-sky-300">
                      <span>✓ Đã gửi mã niêm phong ẩn (người khác không thấy giá)</span>
                      <code className="font-bold">0x9c4e...a12f</code>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSaltBackedUp(true)}
                        className={`flex-1 rounded-none border px-3 py-1.5 font-bold uppercase transition ${
                          saltBackedUp
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-sky-400'
                        }`}
                      >
                        {saltBackedUp ? '✓ Đã sao lưu Salt dự phòng' : 'Bước phụ: Sao lưu Salt JSON'}
                      </button>

                      {!bidRevealed && (
                        <button
                          type="button"
                          onClick={() => {
                            setSimUsdc((v) => v + estimatedReceive);
                            setBidRevealed(true);
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-none border border-sky-400 bg-sky-500 px-3 py-1.5 font-bold uppercase text-zinc-950 transition hover:bg-sky-400 animate-pulse"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Pha 2: Mở niêm phong ({bidAmount} mUSDC)</span>
                        </button>
                      )}
                    </div>

                    {bidRevealed && (
                      <div className="rounded-none border border-emerald-500/40 bg-emerald-500/15 p-2.5 font-bold text-emerald-300">
                        ✓ Bạn thắng Kỳ #1! Hợp đồng tự giải ngân +{estimatedReceive.toFixed(2)} mUSDC về ví.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs font-bold uppercase text-zinc-300 hover:text-white"
                >
                  ← Quay lại
                </button>
                <button
                  type="button"
                  disabled={!bidRevealed}
                  onClick={() => setStep(5)}
                  className="inline-flex items-center gap-2 rounded-none bg-avalanche-red px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  <span>Tiếp tục Bước 5</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* STEP 5: FINAL WITHDRAW COLLATERAL + DISCOUNT + YIELD            */}
          {/* =============================================================== */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-none border border-sky-500/30 bg-sky-500/10 p-3.5 text-xs text-sky-100 space-y-1">
                <div className="font-mono font-bold uppercase text-sky-300">
                  Mục tiêu Bước 5: Rút Thế chấp + Thưởng + Lãi khi kết thúc dây hụi
                </div>
                <p className="leading-relaxed text-zinc-300">
                  Sau khi đủ 5 kỳ đóng góp, dây hụi tự động chuyển sang <strong className="text-white">Đã tất toán toàn bộ</strong>. Bạn rút lại 100% thế chấp gốc kèm phần chia đều chiết khấu và lãi sinh lời ERC-4626.
                </p>
              </div>

              <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-4 space-y-3 font-mono text-xs">
                <div className="space-y-1.5 rounded-none border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thế chấp gốc:</span>
                    <span className="font-bold text-white">100.00 mUSDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Thưởng chiết khấu chia đều:</span>
                    <span className="font-bold text-emerald-400">+12.50 mUSDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Lãi Yield Vault (6.5% APY):</span>
                    <span className="font-bold text-emerald-400">+1.35 mUSDC</span>
                  </div>
                </div>

                {!withdrawnFinal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSimUsdc((v) => v + 113.85);
                      setSimCollateral(0);
                      setSimCredit((v) => v + 30);
                      setWithdrawnFinal(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-none border border-emerald-500 bg-emerald-500 px-4 py-3 font-bold uppercase text-zinc-950 transition hover:bg-emerald-400 animate-pulse"
                  >
                    <Unlock className="h-4 w-4" />
                    <span>Bấm thử: Rút tất toán +113.85 mUSDC</span>
                  </button>
                ) : (
                  <div className="rounded-none border border-emerald-500/40 bg-emerald-500/15 p-3.5 space-y-1.5 text-emerald-200">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-300">
                      <Award className="h-4 w-4" />
                      <span>Chúc mừng! Bạn đã hoàn thành bài thực hành AvaHui.</span>
                    </div>
                    <p className="font-sans text-xs text-zinc-300">
                      Điểm Tín Nhiệm tăng lên <strong>{simCredit}/1000</strong>. Bây giờ bạn có thể thao tác tự tin trên dây hụi thật!
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2 font-mono text-xs font-bold uppercase text-zinc-300 hover:text-white"
                >
                  ← Quay lại
                </button>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleSkip();
                      router.push('/guide');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-xs font-bold uppercase text-zinc-200 hover:text-white"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Xem Cẩm nang /guide</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSkip}
                    className="inline-flex items-center gap-2 rounded-none border border-emerald-500 bg-emerald-500 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-950 transition hover:bg-emerald-400"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>{withdrawnFinal ? 'Hoàn thành & Vào App thật' : 'Đóng & Vào App'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
