'use client';

import React, { useState } from 'react';
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
    badge: 'SMART CONTRACT ESCROW',
    title: 'Quỹ Thế Chấp Tự Trị Trên Chuỗi',
    status: 'LOCKED • 100% VERIFIED',
    lines: [
      { label: 'Quy mô nhóm', value: '5 Thành viên • 5 Vòng xoay vòng' },
      { label: 'Thế chấp yêu cầu', value: '100.00 mUSDC / Slot (Tự hoàn trả cuối kỳ)', tone: 'amber' },
      { label: 'Gross Pot / Vòng', value: '500.00 mUSDC giải ngân tức thì', tone: 'emerald' },
      { label: 'Chủ hụi giữ tiền', value: 'KHÔNG TỒN TẠI (Smart Contract giữ 100%)', tone: 'red' },
    ],
    codeSnippet: 'AvaHuiCircle(0xDe4e...45B0).joinCircleProtected(inviteCode, nullifier)',
  },
  SEALED_BID: {
    badge: 'COMMIT-REVEAL PRIVACY',
    title: 'Đấu Giá Kín Chống Nhìn Trộm Mempool',
    status: 'CRYPTOGRAPHICALLY SEALED',
    lines: [
      { label: 'Pha 1 (Commit)', value: 'Gửi hash ẩn keccak256(bid, salt) lên chuỗi', tone: 'sky' },
      { label: 'Salt bảo mật', value: '0x7a9f...c41b (Chỉ người đấu giá nắm giữ)' },
      { label: 'Pha 2 (Reveal)', value: 'Mở niêm phong xác thực đúng hàm băm gốc', tone: 'emerald' },
      { label: 'Bảo vệ MEV', value: 'Chống hoàn toàn bot Front-run & thông đồng giá', tone: 'amber' },
    ],
    codeSnippet: 'keccak256(abi.encodePacked(circle, uint8(round), bidder, bidAmount, salt))',
  },
  YIELD_SLASH: {
    badge: 'ERC-4626 + AUTO-SLASH',
    title: 'Vốn Nhàn Rỗi Sinh Lời & Tự Động Phạt Nợ',
    status: '6.50% APY • ENGINE ARMED',
    lines: [
      { label: 'ERC-4626 Yield Vault', value: 'Sinh lãi 6.50% APY trên tiền thế chấp khóa', tone: 'emerald' },
      { label: 'Trễ hạn đóng kỳ', value: 'Tự trích thế chấp bù 100% Quỹ (Auto-Slash)', tone: 'amber' },
      { label: 'Chống Sybil Team1', value: 'Xác thực 1-Human-1-Slot qua Nullifier', tone: 'sky' },
      { label: 'Tổng thưởng cuối kỳ', value: 'Gốc thế chấp + Chiết khấu + Lãi DeFi Vault', tone: 'emerald' },
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

  const isAuthenticated = Boolean(session?.isAuthenticated);
  const currentDemo = TERMINAL_DEMOS[activeTab];

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

      {/* Floating Right Focus Rail Indicator */}
      <aside
        aria-label="Section Progress"
        className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-end gap-2.5 xl:flex"
      >
        {RAIL_SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => scrollToLandingSection(sec.id)}
              className="group flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-wider"
            >
              <span
                className={`transition-all duration-300 ${
                  isActive
                    ? 'translate-x-0 font-bold text-white opacity-100'
                    : 'translate-x-2 text-zinc-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                }`}
              >
                {sec.code} // {sec.label}
              </span>
              <span
                className={`block h-[3px] transition-all duration-300 ${
                  isActive
                    ? 'w-7 bg-avalanche-red shadow-[0_0_10px_rgba(232,65,66,0.95)]'
                    : 'w-3 bg-zinc-700 group-hover:w-5 group-hover:bg-zinc-400'
                }`}
              />
            </button>
          );
        })}
      </aside>

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
              <span>Trustless On-Chain ROSCA • Avalanche C-Chain (43113)</span>
            </div>

            <h1 className="text-4xl font-black uppercase leading-[1.06] tracking-tight text-white sm:text-5xl lg:text-6xl">
              HỤI ON-CHAIN{' '}
              <span className="block text-avalanche-red">
                KHÔNG CHỦ HỤI.
              </span>
              <span className="block text-zinc-200">
                KHÔNG BAO GIỜ VỠ NỢ.
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              <strong className="text-white">Avahui Protocol</strong> chuyển hóa mô hình{' '}
              <em>Hụi / Họ (ROSCA)</em> truyền thống lên Smart Contract bất biến.
              Bảo vệ 100% quỹ thành viên bằng <span className="text-amber-300 font-semibold">Thế chấp Auto-Slash</span>,{' '}
              <span className="text-sky-300 font-semibold">Đấu giá kín Commit-Reveal</span> chống lộ giá,{' '}
              <span className="text-emerald-400 font-semibold">Lãi kép DeFi 6.5% APY</span> và{' '}
              <span className="text-white font-semibold">Chống Sybil Team1</span>.
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
                Ví nhúng Google / Email OTP / Core &amp; MetaMask
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Chốt giao dịch &lt; 2 giây
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Mã nguồn Smart Contract minh bạch 100%
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
                    { key: 'ESCROW', label: '01. Escrow', icon: Lock },
                    { key: 'SEALED_BID', label: '02. Sealed-Bid', icon: Eye },
                    { key: 'YIELD_SLASH', label: '03. Yield/Slash', icon: TrendingUp },
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
      {/* SECTION 1: 4 TRUSTED METRICS STRIP                                */}
      {/* ================================================================= */}
      <ScrollFocusSection
        id="metrics"
        className="border-b border-zinc-800 bg-zinc-950/70"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-zinc-800 sm:divide-y-0 lg:grid-cols-4 font-mono">
          {[
            {
              value: '0%',
              label: 'Rủi ro ôm tiền bỏ trốn',
              sub: 'Quỹ giữ hoàn toàn trong Smart Contract',
              color: 'text-avalanche-red',
            },
            {
              value: '100%–300%',
              label: 'Bảo chứng thế chấp mUSDC',
              sub: 'Auto-Slash bù đắp tức thì khi có trễ hạn',
              color: 'text-amber-300',
            },
            {
              value: '+6.50% APY',
              label: 'Lãi kép ERC-4626 Yield',
              sub: 'Vốn thế chấp nhàn rỗi vẫn tự động sinh lời',
              color: 'text-emerald-400',
            },
            {
              value: '< 2 Giây',
              label: 'Avalanche Finality',
              sub: 'Chốt giao dịch siêu tốc, phí gas tối giản',
              color: 'text-sky-300',
            },
          ].map((stat) => (
            <div key={stat.label} className="p-6 transition hover:bg-zinc-900/40">
              <div className={`text-2xl font-black sm:text-3xl ${stat.color}`}>
                {stat.value}
              </div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-white">
                {stat.label}
              </div>
              <div className="mt-1 text-[11px] text-zinc-400">{stat.sub}</div>
            </div>
          ))}
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
            01 // Giải Quyết Bài Toán Ngàn Đời
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            Từ &ldquo;Tin Vào Lời Hứa&rdquo; Sang &ldquo;Tin Vào Mật Mã&rdquo;
          </h2>
          <p className="text-sm text-zinc-400">
            Mọi điểm yếu khiến hàng loạt dây hụi truyền thống đổ vỡ đều được thay thế bằng cơ chế thực thi cưỡng chế trên Blockchain.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Traditional Problems */}
          <div className="rounded-none border border-zinc-800 bg-surface-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono">
              <span className="text-sm font-bold uppercase tracking-wider text-zinc-300">
                Hụi Truyền Thống (Web0)
              </span>
              <span className="border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-400">
                Rủi ro cao
              </span>
            </div>
            <ul className="space-y-3 text-sm text-zinc-300">
              {[
                'Chủ hụi cầm tiền mặt toàn nhóm — nguy cơ vỡ hụi, ôm tiền bỏ trốn bất kỳ lúc nào.',
                'Người hốt hụi sớm rồi "bùng" các kỳ sau, cả nhóm phải gánh nợ thay.',
                'Bỏ thăm kín bằng giấy dễ bị chủ hụi thông đồng, lộ giá bỏ thăm cho người thân.',
                'Tiền quỹ thu góp nằm im trong két hoặc tài khoản cá nhân, không sinh lợi suất.',
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
                Avahui On-Chain Protocol V2
              </span>
              <span className="border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                Trustless 100%
              </span>
            </div>
            <ul className="space-y-3 text-sm text-zinc-200">
              {[
                'Smart Contract độc lập giữ quỹ (Factory Pattern) — không ai có quyền rút ngang quỹ chung.',
                'Bắt buộc khóa thế chấp 100%–300% mUSDC; trễ hạn sẽ tự động Auto-Slash đắp đủ 100% kỳ.',
                'Đấu giá kín 2 pha Commit-Reveal dùng hàm băm keccak256 — tuyệt đối chống lộ giá trên Mempool.',
                'Vốn thế chấp nhàn rỗi tự động gửi vào ERC-4626 Yield Vault (6.50% APY) chia đều cuối kỳ.',
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
              02 // Kiến Trúc Bảo Mật &amp; DeFi V2
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              4 Mô-đun Nâng Cấp Chuẩn Tài Chính Phi Tập Trung
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {[
              {
                num: '01',
                title: 'Sealed-Bid Bidding (Commit-Reveal)',
                tag: 'Chống MEV & Lộ giá',
                icon: Lock,
                accent: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
                desc: 'Ở pha Commit, thành viên chỉ gửi mã băm keccak256 của mức chiết khấu + Salt ngẫu nhiên. Đến pha Reveal mới mở khóa đối chiếu, loại bỏ hoàn toàn tình trạng nhìn trộm giá để trả cao hơn 1 đồng.',
              },
              {
                num: '02',
                title: 'ERC-4626 Yield on Undisbursed Pool',
                tag: 'Lãi Kép 6.50% APY',
                icon: TrendingUp,
                accent: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
                desc: 'Toàn bộ tài sản thế chấp và vốn chờ giải ngân tự động sinh lời trong AvaHuiYieldVault. Khi kết thúc chu kỳ, lợi nhuận được thu hoạch và chia đều cộng hưởng vào thưởng chiết khấu.',
              },
              {
                num: '03',
                title: 'Team1 Anti-Sybil Attestation',
                tag: '1-Human-1-Slot',
                icon: ShieldCheck,
                accent: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
                desc: 'Tích hợp Team1AttestationVerifier phát hành identityNullifier duy nhất cho mỗi cá nhân thật, ngăn chặn kẻ xấu tạo nhiều ví ảo thông đồng thâu tóm dây hụi.',
              },
              {
                num: '04',
                title: 'Invite Members by Link & On-Chain Gate',
                tag: 'Nhóm Riêng Tư Bảo Mật',
                icon: Share2,
                accent: 'text-avalanche-red border-avalanche-red/30 bg-avalanche-red/10',
                desc: 'Tạo dây hụi riêng tư cho bạn bè, đồng nghiệp hoặc hội nhóm Builders với mã mời băm trên Smart Contract. Gửi 1 đường dẫn ?invite= để tham gia và kiểm chứng tức thì.',
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.num}
                  className="group rounded-none border border-zinc-800 bg-surface-card p-6 transition duration-300 hover:-translate-y-1 hover:border-zinc-600"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-none border ${card.accent}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                      MODULE // {card.num}
                    </span>
                  </div>
                  <div className="mt-4 inline-block border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-zinc-300">
                    {card.tag}
                  </div>
                  <h3 className="mt-2.5 font-mono text-lg font-extrabold text-white group-hover:text-avalanche-red transition-colors">
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
              03 // Trải Nghiệm Đơn Giản Như Web2
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
              step: 'STEP 01',
              title: 'Đăng nhập & Nhận Ví',
              icon: KeyRound,
              desc: 'Vào bằng Google, Email OTP (Ví MPC tự tạo) hoặc nối trực tiếp ví Core Wallet / MetaMask.',
            },
            {
              step: 'STEP 02',
              title: 'Faucet / Swap mUSDC',
              icon: Coins,
              desc: 'Nhận ngay 1,000 mUSDC thử nghiệm hoặc Swap 1-click AVAX sang mUSDC trên Navbar.',
            },
            {
              step: 'STEP 03',
              title: 'Tham gia & Khóa Slot',
              icon: Users,
              desc: 'Chọn dây hụi FIXED hoặc BIDDING, khóa thế chấp 1x–3x để nhận vị trí Slot On-Chain.',
            },
            {
              step: 'STEP 04',
              title: 'Đóng Kỳ & Thu Hoạch',
              icon: Sparkles,
              desc: 'Đấu giá kín, nhận Payout sớm hoặc chờ cuối kỳ rút 100% Thế chấp + Chiết khấu + Lãi 6.5%.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="rounded-none border border-zinc-800 bg-surface-card p-5 space-y-3 transition duration-300 hover:-translate-y-1 hover:border-avalanche-red/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-avalanche-red">
                    {item.step}
                  </span>
                  <Icon className="h-4 w-4 text-zinc-400" />
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
              <span>Sẵn sàng trải nghiệm On-Chain Real-Time</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
              Bắt Đầu Tham Gia Hoặc Tạo Dây Hụi Ngay Hôm Nay
            </h2>
            <p className="text-sm text-zinc-400">
              Trải nghiệm đầy đủ từ Đăng nhập, Ví điện tử, Sealed-Bid Commit-Reveal đến Giải ngân Tự động trên mạng Avalanche.
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
