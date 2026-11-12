'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useAuthSession } from '@/lib/auth/useAuthSession';
import {
  ScrollFocusSection,
  scrollToLandingSection,
  useActiveLandingSection,
} from '@/components/ui/ScrollFocusSection';
import {
  ArrowRight,
  CheckCircle2,
  Coins,
  Compass,
  Eye,
  KeyRound,
  Layers,
  Lock,
  LogIn,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

type TerminalTab = 'ESCROW' | 'SEALED_BID' | 'YIELD_SLASH';

const TERMINAL_DEMOS: Record<
  TerminalTab,
  {
    badge: string;
    title: string;
    status: string;
    lines: Array<{ label: string; value: string; tone?: 'red' | 'emerald' | 'sky' | 'amber' }>;
    codeSnippet: string;
  }
> = {
  ESCROW: {
    badge: 'HỢP ĐỒNG GIỮ QUỸ CHUNG',
    title: 'Tiền Quỹ Do Hệ Thống Tự Động Giữ',
    status: 'ĐÃ KHÓA • CÔNG KHAI',
    lines: [
      { label: 'Quy mô nhóm', value: '5 Thành viên • 5 Kỳ đóng góp' },
      { label: 'Tiền cọc giữ chỗ', value: '100.00 mUSDC / Suất (Hoàn trả cuối dây)', tone: 'amber' },
      { label: 'Tiền hốt mỗi kỳ', value: '500.00 mUSDC chuyển thẳng người thắng', tone: 'emerald' },
      { label: 'Chủ hụi giữ tiền', value: 'KHÔNG CÓ (Hợp đồng giữ toàn bộ quỹ)', tone: 'red' },
    ],
    codeSnippet: 'AvaHuiCircle.joinCircleProtected(inviteCode, nullifier)',
  },
  SEALED_BID: {
    badge: 'BỎ THĂM KÍN 2 BƯỚC',
    title: 'Bỏ Thăm Kín, Không Lo Lộ Mức Giá',
    status: 'ĐÃ NIÊM PHONG MẬT MÃ',
    lines: [
      { label: 'Bước 1 (Gửi kín)', value: 'Khóa mức giá thành mã ẩn bằng số bí mật', tone: 'sky' },
      { label: 'Mã bảo vệ riêng', value: '0x7a9f...c41b (Chỉ riêng bạn nắm giữ)' },
      { label: 'Bước 2 (Mở thăm)', value: 'Hết giờ mới mở đối chiếu công khai', tone: 'emerald' },
      { label: 'Công bằng cho cả nhóm', value: 'Không ai nhìn trộm giá để trả nhỉnh hơn', tone: 'amber' },
    ],
    codeSnippet: 'keccak256(abi.encodePacked(circle, uint8(round), bidder, bidAmount, salt))',
  },
  YIELD_SLASH: {
    badge: 'SINH LÃI + TỰ BÙ CỌC',
    title: 'Tiền Cọc Sinh Lãi & Tự Bù Khi Đóng Trễ',
    status: '~6.5%/NĂM • ĐANG BẬT',
    lines: [
      { label: 'Kho sinh lãi tự động', value: 'Tiền cọc nằm chờ tự sinh lãi ~6.5%/năm', tone: 'emerald' },
      { label: 'Khi có người đóng trễ', value: 'Tự trích tiền cọc bù đủ cho kỳ hốt', tone: 'amber' },
      { label: 'Bảo vệ người thật', value: 'Mỗi cá nhân chỉ xác thực được 1 suất', tone: 'sky' },
      { label: 'Nhận lại cuối dây', value: '100% Tiền cọc + Chiết khấu + Tiền lãi', tone: 'emerald' },
    ],
    codeSnippet: 'AvaHuiYieldVault.harvestYield() => totalDiscountPool += accruedYield',
  },
};

const RAIL_SECTIONS = [
  { id: 'hero', code: '00', label: 'Tổng quan' },
  { id: 'metrics', code: '01', label: 'Bảo chứng' },
  { id: 'co-che', code: '02', label: 'Cơ chế' },
  { id: 'bao-mat', code: '03', label: 'Bảo mật V2' },
  { id: 'lo-trinh', code: '04', label: 'Lộ trình' },
  { id: 'bat-dau', code: '05', label: 'Khởi chạy' },
];

export function LandingView() {
  const { data: session } = useAuthSession();
  const [activeTab, setActiveTab] = useState<TerminalTab>('ESCROW');
  const activeSection = useActiveLandingSection('hero');
  const [mounted, setMounted] = useState(false);

  // Sequential 2-second spotlight cycle across 4-item grids (pauses when user hovers an item)
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [hoveredMetric, setHoveredMetric] = useState<number | null>(null);
  const [hoveredModule, setHoveredModule] = useState<number | null>(null);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const activeMetricIdx = hoveredMetric ?? spotlightIndex;
  const activeModuleIdx = hoveredModule ?? spotlightIndex;
  const activeStepIdx = hoveredStep ?? spotlightIndex;

  const isAuthenticated = Boolean(session?.isAuthenticated);
  const currentDemo = TERMINAL_DEMOS[activeTab];

  // Portaled straight to document.body so CSS transitions/transforms never trap position:fixed
  const floatingRail = (
    <aside
      aria-label="Section Progress"
      className="pointer-events-none fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-2.5 lg:flex xl:right-6"
    >
      {RAIL_SECTIONS.map((sec) => {
        const isActive = activeSection === sec.id;
        return (
          <button
            key={sec.id}
            type="button"
            onClick={() => scrollToLandingSection(sec.id)}
            aria-label={`Đi tới phần ${sec.code} ${sec.label}`}
            className="group pointer-events-none flex items-center gap-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
          >
            <span
              className={`border px-2 py-0.5 backdrop-blur-md transition-all duration-300 ${
                isActive
                  ? 'pointer-events-auto translate-x-0 border-zinc-700/80 bg-zinc-950/90 font-bold text-white opacity-100 shadow-lg shadow-black/60'
                  : 'pointer-events-none translate-x-2 border-zinc-800/70 bg-zinc-950/85 text-zinc-400 opacity-0 group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100'
              }`}
            >
              {sec.code} {'//'} {sec.label}
            </span>
            <span
              className={`pointer-events-auto block h-[3px] cursor-pointer transition-all duration-300 ${
                isActive
                  ? 'w-7 bg-avalanche-red shadow-[0_0_10px_rgba(232,65,66,0.95)]'
                  : 'w-3.5 bg-zinc-700 group-hover:w-5 group-hover:bg-zinc-400'
              }`}
            />
          </button>
        );
      })}
    </aside>
  );

  return (
    <div className="relative overflow-x-clip bg-surface-bg text-zinc-100">
      {/* Ambient Avalanche Crimson Backdrop Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 left-1/2 h-[540px] w-[960px] -translate-x-1/2 rounded-full bg-avalanche-red/12 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 -right-32 h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[120px]"
      />

      {/* Pinned Floating Right Focus Rail Portal */}
      {mounted ? createPortal(floatingRail, document.body) : null}

      {/* ================================================================= */}
      {/* SECTION 0: HERO SECTION (Above the Fold)                          */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="hero"
        initialFocused
        className="relative min-h-[82vh] flex items-center border-b border-zinc-800/80"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          {/* Left Column: High-Impact Messaging & CTAs */}
          <div className="space-y-6 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-none border border-avalanche-red/40 bg-avalanche-red/10 px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-avalanche-red">
              <span className="h-2 w-2 animate-pulse bg-emerald-400" />
              <span>Hụi Minh Bạch Trên Blockchain • Mạng Avalanche (43113)</span>
            </div>

            <h1 className="text-4xl font-black uppercase leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
              HỤI ON-CHAIN{' '}
              <span className="block text-avalanche-red">
                KHÔNG CHỦ HỤI.
              </span>
              <span className="block text-zinc-200">
                KHÔNG VỠ NỢ.
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              <strong className="text-white">Avahui</strong> đưa mô hình chơi{' '}
              <em>Hụi / Họ</em> truyền thống lên mạng lưới Blockchain minh bạch và tự động.
              An tâm góp quỹ nhờ <span className="text-amber-300 font-semibold">tiền cọc tự bù khi có người đóng trễ</span>,{' '}
              <span className="text-sky-300 font-semibold">bỏ thăm kín không lo lộ giá</span>,{' '}
              <span className="text-emerald-400 font-semibold">tiền nhàn rỗi tự sinh lãi 6.5%/năm</span> và{' '}
              <span className="text-white font-semibold">mỗi người thật chỉ giữ một suất</span>.
            </p>

            {/* Primary CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-6 py-3.5 font-mono text-xs font-extrabold uppercase tracking-wider text-white shadow-xl shadow-avalanche-red/30 transition hover:bg-avalanche-darkRed active:scale-95 sm:text-sm"
              >
                <LogIn className="h-4 w-4" />
                <span>Đăng nhập / Đăng ký</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href={isAuthenticated ? '/dashboard' : '/circles'}
                className="inline-flex items-center gap-2 rounded-none border border-zinc-700 bg-zinc-900/90 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:border-emerald-400 hover:text-emerald-300 active:scale-95 sm:text-sm"
              >
                <Compass className="h-4 w-4 text-emerald-400" />
                <span>{isAuthenticated ? 'Vào App Ngay (Dashboard)' : 'Xem Dây Hụi Live'}</span>
              </Link>
            </div>

            {/* Trust Micro-Badges */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-3 font-mono text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Tạo ví dễ dàng qua Google / Email hoặc nối Core &amp; MetaMask
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Chốt giao dịch &lt; 2 giây
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Quy tắc hợp đồng công khai, ai cũng kiểm tra được
              </span>
            </div>
          </div>

          {/* Right Column: Interactive Live Protocol Terminal */}
          <div className="lg:col-span-5">
            <div className="rounded-none border border-zinc-800 bg-surface-card shadow-2xl shadow-black/80">
              {/* Terminal Top Bar */}
              <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-[11px]">
                <div className="flex items-center gap-2 text-zinc-300">
                  <Terminal className="h-3.5 w-3.5 text-avalanche-red" />
                  <span className="font-bold uppercase tracking-wider">
                    AVAHUI_V2_ENGINE.SOL
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-none border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 bg-emerald-400" />
                  ON-CHAIN READY
                </span>
              </div>

              {/* Interactive Module Switcher Tabs */}
              <div className="grid grid-cols-3 border-b border-zinc-800 bg-zinc-900/60 font-mono text-[11px]">
                {(
                  [
                    { key: 'ESCROW', label: '01. Quỹ Cọc', icon: Lock },
                    { key: 'SEALED_BID', label: '02. Thăm Kín', icon: Eye },
                    { key: 'YIELD_SLASH', label: '03. Lãi & Bù', icon: TrendingUp },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 font-bold uppercase tracking-wider transition ${
                        active
                          ? 'border-avalanche-red bg-avalanche-red/10 text-white'
                          : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${active ? 'text-avalanche-red' : ''}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dynamic Terminal Body with Smooth Tab Exit/Enter Transition */}
              <div key={activeTab} className="space-y-4 p-5 font-mono animate-tab-enter">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-avalanche-red">
                    {currentDemo.badge}
                  </span>
                  <span className="rounded-none border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    {currentDemo.status}
                  </span>
                </div>

                <h3 className="text-base font-extrabold text-white">
                  {currentDemo.title}
                </h3>

                <div className="space-y-2">
                  {currentDemo.lines.map((line) => (
                    <div
                      key={line.label}
                      className="flex flex-col justify-between gap-1 rounded-none border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-xs sm:flex-row sm:items-center"
                    >
                      <span className="text-zinc-400">{line.label}:</span>
                      <span
                        className={`font-bold ${
                          line.tone === 'emerald'
                            ? 'text-emerald-400'
                            : line.tone === 'red'
                            ? 'text-avalanche-red'
                            : line.tone === 'sky'
                            ? 'text-sky-300'
                            : line.tone === 'amber'
                            ? 'text-amber-300'
                            : 'text-white'
                        }`}
                      >
                        {line.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-none border border-zinc-800 bg-black/70 p-3 text-[11px] text-emerald-400">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                    Solidity Call Signature
                  </div>
                  <code className="break-all">{currentDemo.codeSnippet}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollFocusSection>

      {/* ================================================================= */}
      {/* SECTION 1: 4 TRUSTED METRICS STRIP (2s Sequential Lift & Glow)    */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="metrics"
        className="border-b border-zinc-800 bg-zinc-950/70"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-6 sm:px-6 lg:grid-cols-4 font-mono">
          {[
            {
              value: '0%',
              label: 'Rủi ro chủ hụi ôm tiền',
              sub: 'Quỹ giữ hoàn toàn trong hợp đồng tự động',
              color: 'text-avalanche-red',
              activeBorder: 'border-avalanche-red bg-avalanche-red/10 shadow-[0_14px_38px_-10px_rgba(232,65,66,0.45)]',
              topBar: 'bg-avalanche-red',
            },
            {
              value: '100%–300%',
              label: 'Tiền cọc bảo đảm',
              sub: 'Tự động trích tiền cọc bù ngay khi có người trễ hạn',
              color: 'text-amber-300',
              activeBorder: 'border-amber-400 bg-amber-500/10 shadow-[0_14px_38px_-10px_rgba(251,191,36,0.35)]',
              topBar: 'bg-amber-400',
            },
            {
              value: '+6.5% / Năm',
              label: 'Tiền cọc tự sinh lãi',
              sub: 'Khoản cọc nằm chờ trong dây vẫn tự cộng lãi mỗi ngày',
              color: 'text-emerald-400',
              activeBorder: 'border-emerald-400 bg-emerald-500/10 shadow-[0_14px_38px_-10px_rgba(52,211,153,0.35)]',
              topBar: 'bg-emerald-400',
            },
            {
              value: '< 2 Giây',
              label: 'Xử lý trên Avalanche',
              sub: 'Xác nhận đóng & nhận tiền nhanh, phí rất thấp',
              color: 'text-sky-300',
              activeBorder: 'border-sky-400 bg-sky-500/10 shadow-[0_14px_38px_-10px_rgba(56,189,248,0.35)]',
              topBar: 'bg-sky-400',
            },
          ].map((stat, idx) => {
            const isHighlighted = activeMetricIdx === idx;
            return (
              <div
                key={stat.label}
                onMouseEnter={() => setHoveredMetric(idx)}
                onMouseLeave={() => setHoveredMetric(null)}
                className={`relative border p-5 sm:p-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isHighlighted
                    ? `-translate-y-2.5 scale-[1.02] opacity-100 ${stat.activeBorder}`
                    : 'translate-y-0 scale-100 border-zinc-800/80 bg-surface-card/60 opacity-75 hover:opacity-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 top-0 h-[2px] transition-all duration-500 ${
                    isHighlighted ? `${stat.topBar} opacity-100` : 'opacity-0'
                  }`}
                />
                <div
                  className={`text-2xl font-black sm:text-3xl transition-transform duration-500 ${
                    stat.color
                  } ${isHighlighted ? 'scale-[1.04] origin-left' : ''}`}
                >
                  {stat.value}
                </div>
                <div className="mt-1.5 text-xs font-bold uppercase tracking-wider text-white">
                  {stat.label}
                </div>
                <div className="mt-1 text-[11px] text-zinc-400">{stat.sub}</div>
              </div>
            );
          })}
        </div>
      </ScrollFocusSection>

      {/* ================================================================= */}
      {/* SECTION 2: TRADITIONAL VS AVAHUI COMPARISON MATRIX                */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="co-che"
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6"
      >
        <div className="mb-10 max-w-2xl space-y-2">
          <div className="font-mono text-xs font-bold uppercase tracking-widest text-avalanche-red">
            01 // Giải Quyết Rủi Ro Hụi Truyền Thống
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            Từ &ldquo;Tin Vào Lời Hứa&rdquo; Sang &ldquo;Quy Tắc Minh Bạch&rdquo;
          </h2>
          <p className="text-sm text-zinc-400">
            Những điểm yếu khiến dây hụi truyền thống dễ đổ vỡ đều được thay thế bằng quy tắc tự động và rõ ràng trên Blockchain.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Traditional Problems */}
          <div className="rounded-none border border-zinc-800 bg-surface-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                Hụi Truyền Thống
              </span>
              <span className="border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-400">
                Rủi ro cao
              </span>
            </div>
            <ul className="space-y-3 text-sm text-zinc-300">
              {[
                'Chủ hụi cầm tiền mặt toàn nhóm — dễ phát sinh rủi ro giữ tiền hoặc chiếm dụng quỹ chung.',
                'Người nhận quỹ sớm trễ hạn hoặc mất khả năng đóng các kỳ sau, khiến cả nhóm phải gánh nợ thay.',
                'Bỏ thăm kín bằng giấy dễ bị chủ hụi can thiệp, lộ mức giá cho người quen.',
                'Tiền quỹ thu góp nằm im một chỗ, không sinh thêm đồng lãi nào.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AvaHui On-Chain Solutions */}
          <div className="rounded-none border border-emerald-500/40 bg-emerald-500/5 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 font-mono">
              <span className="text-sm font-bold uppercase tracking-wider text-white">
                Avahui Trên Blockchain
              </span>
              <span className="border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                Không cần chủ hụi
              </span>
            </div>
            <ul className="space-y-3 text-sm text-zinc-200">
              {[
                'Hợp đồng tự động giữ quỹ riêng cho từng dây hụi — không cá nhân nào tự ý rút được tiền chung.',
                'Thành viên đặt cọc 100%–300% mUSDC; nếu có người đóng trễ, hệ thống tự trích cọc bù đủ kỳ góp.',
                'Bỏ thăm kín qua hai bước mã hóa — giữ bí mật mức giá của bạn cho đến khi mở hòm công khai.',
                'Tiền cọc nhàn rỗi được gửi sinh lãi tự động (~6.5%/năm) và chia đều cho cả nhóm khi kết thúc.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ScrollFocusSection>

      {/* ================================================================= */}
      {/* SECTION 3: 4 SECURITY & DEFI PILLARS (BENTO GRID)                 */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="bao-mat"
        className="border-y border-zinc-800 bg-zinc-950/60"
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="mb-10 max-w-2xl space-y-2">
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-avalanche-red">
              02 // 4 Lớp Bảo Vệ Chính
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              4 Cơ Chế Giúp Dây Hụi Vận Hành An Toàn
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {[
              {
                num: '01',
                title: 'Bỏ Thăm Kín Hai Bước',
                tag: 'Chống lộ giá bỏ thăm',
                icon: Lock,
                accent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
                glow: 'border-sky-400/70 bg-sky-500/5 shadow-[0_14px_36px_-12px_rgba(56,189,248,0.35)]',
                desc: 'Mức giá bạn đưa ra được khóa thành mã bí mật kèm số ngẫu nhiên ở bước đầu. Hết giờ mới đồng loạt mở thăm đối chiếu, ngăn việc nhìn trộm để trả cao hơn 1 đồng.',
              },
              {
                num: '02',
                title: 'Tiền Cọc Nằm Chờ Vẫn Sinh Lãi',
                tag: 'Lãi kép ~6.5% / năm',
                icon: TrendingUp,
                accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                glow: 'border-emerald-400/70 bg-emerald-500/5 shadow-[0_14px_36px_-12px_rgba(52,211,153,0.35)]',
                desc: 'Toàn bộ tiền cọc và quỹ chờ giải ngân không nằm chết một chỗ mà tự sinh lời trong kho lãi. Cuối dây, phần lãi thu được sẽ chia thêm cho các thành viên đóng đúng hạn.',
              },
              {
                num: '03',
                title: 'Xác Thực Mỗi Người Một Suất',
                tag: 'Ngăn tài khoản ảo',
                icon: ShieldCheck,
                accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                glow: 'border-amber-400/70 bg-amber-500/5 shadow-[0_14px_36px_-12px_rgba(251,191,36,0.35)]',
                desc: 'Mỗi cá nhân thật chỉ xác nhận được một suất tham gia hợp lệ bằng mã định danh riêng, ngăn kẻ xấu lập nhiều tài khoản ảo để thông đồng thâu tóm dây hụi.',
              },
              {
                num: '04',
                title: 'Lập Nhóm Riêng Bằng Link Mời',
                tag: 'Chỉ người có mã mới vào',
                icon: Share2,
                accent: 'text-avalanche-red border-avalanche-red/30 bg-avalanche-red/10',
                glow: 'border-avalanche-red/80 bg-avalanche-red/5 shadow-[0_14px_36px_-12px_rgba(232,65,66,0.4)]',
                desc: 'Tạo dây hụi kín cho bạn bè, đồng nghiệp hoặc hội nhóm với mã mời khóa chặt ngay trên hợp đồng. Chỉ cần gửi 1 đường link là người quen có thể kiểm tra và vào dây ngay.',
              },
            ].map((card, idx) => {
              const Icon = card.icon;
              const isHighlighted = activeModuleIdx === idx;
              return (
                <div
                  key={card.num}
                  onMouseEnter={() => setHoveredModule(idx)}
                  onMouseLeave={() => setHoveredModule(null)}
                  className={`group rounded-none border p-6 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isHighlighted
                      ? `-translate-y-2 scale-[1.015] opacity-100 ${card.glow}`
                      : 'translate-y-0 scale-100 border-zinc-800 bg-surface-card opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-none border transition-transform duration-500 ${card.accent} ${isHighlighted ? 'scale-110' : ''}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${isHighlighted ? 'text-white' : 'text-zinc-500'}`}>
                      CƠ CHẾ // {card.num}
                    </span>
                  </div>
                  <div className="mt-4 inline-block border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-zinc-300">
                    {card.tag}
                  </div>
                  <h3 className={`mt-2.5 font-mono text-lg font-extrabold transition-colors ${isHighlighted ? 'text-white' : 'text-zinc-200'}`}>
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {card.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollFocusSection>

      {/* ================================================================= */}
      {/* SECTION 4: 4-STEP USER JOURNEY                                    */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="lo-trinh"
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <div className="font-mono text-xs font-bold uppercase tracking-widest text-avalanche-red">
              03 // Tham Gia Nhanh Trong Vài Phút
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              4 Bước Khởi Chạy Dây Hụi Đầu Tiên
            </h2>
          </div>

          <Link
            href="/circles/create"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red hover:underline"
          >
            <span>Tạo Dây Hụi Mới</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono">
          {[
            {
              step: 'BƯỚC 01',
              title: 'Đăng Nhập & Có Ví Ngay',
              icon: KeyRound,
              desc: 'Vào bằng Google, Email hoặc nối ví Core / MetaMask — chưa rành tiền số vẫn dùng được ngay.',
            },
            {
              step: 'BƯỚC 02',
              title: 'Nhận Thử mUSDC',
              icon: Coins,
              desc: 'Nhận ngay 1,000 mUSDC thử nghiệm hoặc đổi trực tiếp từ AVAX ngay trên thanh công cụ.',
            },
            {
              step: 'BƯỚC 03',
              title: 'Chọn Dây & Đặt Cọc',
              icon: Users,
              desc: 'Chọn dây hụi đóng đều hoặc bỏ thăm hốt sớm, đặt tiền cọc bảo đảm để giữ suất chơi.',
            },
            {
              step: 'BƯỚC 04',
              title: 'Đóng Kỳ & Thu Hoạch',
              icon: Sparkles,
              desc: 'Bỏ thăm kín nhận hụi khi cần, hoặc đợi đến cuối dây rút đủ tiền cọc, chiết khấu và tiền lãi.',
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            const isHighlighted = activeStepIdx === idx;
            return (
              <div
                key={item.step}
                onMouseEnter={() => setHoveredStep(idx)}
                onMouseLeave={() => setHoveredStep(null)}
                className={`relative rounded-none border p-5 space-y-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isHighlighted
                    ? '-translate-y-2.5 scale-[1.02] border-avalanche-red bg-avalanche-red/10 shadow-[0_14px_38px_-10px_rgba(232,65,66,0.45)] opacity-100'
                    : 'translate-y-0 scale-100 border-zinc-800 bg-surface-card opacity-75 hover:opacity-100'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 top-0 h-[2px] bg-avalanche-red transition-opacity duration-500 ${
                    isHighlighted ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${isHighlighted ? 'text-white' : 'text-avalanche-red'}`}>
                    {item.step}
                  </span>
                  <Icon className={`h-4 w-4 transition-colors ${isHighlighted ? 'text-avalanche-red' : 'text-zinc-400'}`} />
                </div>
                <h3 className="text-sm font-extrabold uppercase text-white">
                  {item.title}
                </h3>
                <p className="font-sans text-xs leading-relaxed text-zinc-400">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </ScrollFocusSection>

      {/* ================================================================= */}
      {/* SECTION 5: BOTTOM FINAL CTA BANNER                                */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="bat-dau"
        className="border-t border-zinc-800 bg-gradient-to-b from-surface-card to-zinc-950"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-16 text-center sm:px-6 lg:flex-row lg:text-left">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-emerald-400">
              <Zap className="h-3.5 w-3.5" />
              <span>Sẵn sàng trải nghiệm ngay trên hệ thống</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Bắt Đầu Tham Gia Hoặc Tạo Dây Hụi Ngay Hôm Nay
            </h2>
            <p className="text-sm text-zinc-400">
              Trải nghiệm trọn vẹn từ đăng nhập, nhận tiền thử nghiệm, bỏ thăm kín cho đến nhận tiền tự động trên mạng Avalanche.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-none border border-avalanche-red bg-avalanche-red px-6 py-3.5 font-mono text-xs font-extrabold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/25 transition hover:bg-avalanche-darkRed"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập / Đăng ký</span>
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-none border border-zinc-700 bg-zinc-900 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-white hover:text-white"
            >
              <Layers className="h-4 w-4 text-avalanche-red" />
              <span>Vào Dashboard</span>
            </Link>
          </div>
        </div>
      </ScrollFocusSection>
    </div>
  );
}
