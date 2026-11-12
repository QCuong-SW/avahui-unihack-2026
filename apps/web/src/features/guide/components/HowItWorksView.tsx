'use client';

import React from 'react';
import Link from 'next/link';
import { ROSCA_GLOSSARY_ITEMS } from '@/lib/constants/glossary';
import { dispatchOpenBeginnerSandbox } from './BeginnerSandboxGuide';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Coins,
  Compass,
  Fuel,
  Gavel,
  KeyRound,
  Lock,
  Play,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Unlock,
} from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'Đăng nhập & Khởi tạo Ví tự động',
    icon: KeyRound,
    summary:
      'Đăng nhập bằng Google, Email OTP hoặc ví Web3 (Core / MetaMask). Hệ thống tự tạo ví nhúng an toàn trên mạng Avalanche Fuji mà bạn không cần tự nhớ chuỗi 12 từ khóa.',
    tips: [
      'Khi mới vào lần đầu, hệ thống chuyển qua bước Kiểm tra Ví để xác nhận địa chỉ 0x và mạng Avalanche Fuji (43113).',
      'Nếu muốn nhận chứng thực chống tạo nhiều ví (Team1), mở mục Hồ sơ để gửi/nhận chứng thực.',
    ],
    ctaLabel: 'Mở Hồ sơ cá nhân',
    ctaHref: '/profile',
  },
  {
    step: '02',
    title: 'Nhận vốn thử nghiệm mUSDC & Phí Gas AVAX',
    icon: Coins,
    summary:
      'Trên thanh công cụ phía trên, bạn có nút Faucet (+1,000 mUSDC) để nhận tiền giao dịch thử nghiệm và nút +GAS (+0.02 AVAX) để nhận phí xử lý giao dịch miễn phí.',
    tips: [
      'Cần có ít nhất 0.005 AVAX làm phí mạng và đủ mUSDC bằng mức Thế chấp yêu cầu của dây hụi trước khi tham gia.',
      'Trong mục Hồ sơ cũng hỗ trợ Quy đổi nhanh 0.05 AVAX sang +250 mUSDC nếu cần thêm vốn.',
    ],
    ctaLabel: 'Vào Tổng quan',
    ctaHref: '/dashboard',
  },
  {
    step: '03',
    title: 'Tham gia dây mở sẵn hoặc Mở dây hụi mới',
    icon: PlusCircle,
    summary:
      'Chọn dây hụi phù hợp ở danh sách Dây hụi hoặc tự thiết lập dây mới: Đấu giá chiết khấu (ai cần vốn đặt chiết khấu cao hơn nhận trước) hoặc Thứ tự cố định (Slot #1 -> #N).',
    tips: [
      'Mức thế chấp 2x bảo vệ nhóm rất an toàn nếu có thành viên trễ hạn nhiều kỳ; mức 1x nhẹ vốn ban đầu nhưng tiềm ẩn rủi ro thiếu hụt ở các kỳ cuối nếu thành viên vi phạm nhiều lần.',
      'Bật "Dây riêng tư" nếu bạn chỉ muốn mời bạn bè qua đường dẫn có Mã mời riêng.',
    ],
    ctaLabel: 'Khám phá Dây hụi',
    ctaHref: '/circles',
  },
  {
    step: '04',
    title: 'Đóng góp theo kỳ & Đấu giá kín 2 pha',
    icon: Gavel,
    summary:
      'Khi dây đủ thành viên và chuyển sang Đang vận hành, mỗi kỳ bạn thực hiện Đóng hụi đúng hạn. Với dây Đấu giá kín, việc bỏ giá chia làm 2 bước để không ai nhìn trộm được mức giá của bạn.',
    tips: [
      'Pha 1 — Niêm phong (2/3 thời gian đầu của kỳ): Nhập mức chiết khấu và bấm "Niêm phong". Hãy bấm "Sao lưu JSON" hoặc chép mã Salt để dự phòng.',
      'Pha 2 — Mở niêm phong (1/3 thời gian cuối của kỳ): Bấm "Mở niêm phong" để xác thực đúng mức giá đã đặt trước khi hệ thống chốt kỳ.',
      'Hệ thống Keeper tự động tất toán khi hết kỳ hoặc trích thế chấp nếu có người đóng trễ.',
    ],
    ctaLabel: 'Tạo dây thử ngay',
    ctaHref: '/circles/create',
  },
  {
    step: '05',
    title: 'Tất toán cuối chu kỳ & Tích lũy Điểm Tín Nhiệm',
    icon: Unlock,
    summary:
      'Sau khi toàn bộ các kỳ hoàn tất, hợp đồng cho phép bạn rút 100% phần thế chấp còn lại cộng thêm Thưởng chiết khấu chia đều và Lãi Yield Vault (6.5%/năm).',
    tips: [
      'Kỳ đóng đúng hạn (+10 điểm) và dây hoàn tất (+30 điểm) tự động nâng hạng Điểm Tín Nhiệm Hụi trên Hồ sơ của bạn (Thành viên mới -> Uy tín -> Lão luyện).',
      'Nếu không có người tham gia đủ dây trước thời hạn chờ, bạn có thể bấm Hủy dây quá hạn để rút hoàn cọc 100%.',
    ],
    ctaLabel: 'Xem Điểm Tín Nhiệm',
    ctaHref: '/profile',
  },
];

const FAQS = [
  {
    q: 'Lỡ xóa trình duyệt sau khi Niêm phong giá đấu thì làm sao Mở niêm phong?',
    a: 'Trong Bảng Thao Tác ở trang chi tiết dây hụi, bạn có thể mở phần khôi phục Salt, nhập lại mức giá đấu cùng file JSON / mã Salt đã sao lưu để Mở niêm phong bình thường.',
  },
  {
    q: 'Tại sao dây 1x thế chấp lại có cảnh báo rủi ro khi tạo?',
    a: 'Nếu 1 thành viên nhận quỹ sớm rồi trễ hạn ở kỳ tiếp theo, hợp đồng sẽ trích hết 1x thế chấp để bù cho kỳ đó. Nếu họ tiếp tục trễ ở kỳ sau nữa thì không còn cọc để bù tiếp, nên từ bản nâng cấp V2.1 hợp đồng cho phép chốt theo số tiền thực thu thay vì kẹt vòng. Tuy nhiên nhóm lạ vẫn nên chọn 2x.',
  },
  {
    q: 'Kho sinh lời 6.5% APY lấy lãi từ đâu?',
    a: 'Tiền thế chấp của cả nhóm trong suốt thời gian chờ được gửi vào kho chuẩn ERC-4626 (AvaHuiYieldVault), tự động tính lãi theo thời gian thực và phân bổ công bằng khi rút tất toán.',
  },
];

export function HowItWorksView() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <section className="rounded-none border border-zinc-800 bg-surface-card p-6 sm:p-8 shadow-xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-none border border-avalanche-red/40 bg-avalanche-red/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-avalanche-red">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Cẩm nang Sử dụng AvaHui</span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <h1 className="font-mono text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
              Hướng dẫn vận hành Hụi On-Chain từ A–Z
            </h1>
            <p className="text-sm leading-relaxed text-zinc-400">
              Quy trình 5 bước đơn giản giúp người mới làm quen với cơ chế đóng hụi minh bạch, đấu giá kín chống nhìn trộm giá, và bảo chứng thế chấp tự động trên Avalanche.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatchOpenBeginnerSandbox()}
              className="inline-flex items-center gap-1.5 rounded-none border border-amber-500/60 bg-amber-500/15 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500 hover:text-zinc-950"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Thực hành Mô phỏng (UI Giả lập)</span>
            </button>
            <Link
              href="/circles"
              className="inline-flex items-center gap-1.5 rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 hover:text-white"
            >
              <Compass className="h-3.5 w-3.5 text-avalanche-red" />
              <span>Xem Dây hụi</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed"
            >
              <span>Vào Tổng quan</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 5 Interactive Steps */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-wider text-white">
          <Sparkles className="h-4 w-4 text-avalanche-red" />
          <span>Lộ trình 5 bước thực hành</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="flex flex-col justify-between rounded-none border border-zinc-800 bg-surface-card p-5 space-y-4 transition hover:border-zinc-700"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-none border border-avalanche-red/40 bg-avalanche-red/15 font-mono text-xs font-extrabold text-avalanche-red">
                        {item.step}
                      </span>
                      <h2 className="font-mono text-sm sm:text-base font-extrabold text-white">
                        {item.title}
                      </h2>
                    </div>
                    <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed text-zinc-300">
                    {item.summary}
                  </p>

                  <ul className="space-y-2 text-xs text-zinc-400">
                    {item.tips.map((tip) => (
                      <li key={tip} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-zinc-800/80">
                  <Link
                    href={item.ctaHref}
                    className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red hover:underline"
                  >
                    <span>{item.ctaLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Safety Rules */}
      <section className="rounded-none border border-amber-500/30 bg-amber-500/5 p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 font-mono text-sm font-extrabold uppercase tracking-wider text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <span>3 Nguyên tắc an toàn khi dùng hệ thống</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3 text-xs text-zinc-300">
          <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 font-mono font-bold text-white">
              <Fuel className="h-3.5 w-3.5 text-amber-400" />
              <span>Luôn giữ sẵn AVAX Gas</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Mỗi thao tác on-chain tiêu tốn lượng nhỏ AVAX. Hãy kiểm tra số dư &ge; 0.005 AVAX trước khi đóng tiền hoặc đấu giá.
            </p>
          </div>
          <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 font-mono font-bold text-white">
              <Lock className="h-3.5 w-3.5 text-sky-400" />
              <span>Luôn sao lưu Salt JSON</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Sau khi Niêm phong giá đấu (2/3 thời gian đầu), hãy tải ngay file Salt dự phòng để chắc chắn Mở niêm phong đúng hạn ở 1/3 thời gian cuối.
            </p>
          </div>
          <div className="rounded-none border border-zinc-800 bg-zinc-900/70 p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 font-mono font-bold text-white">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Ưu tiên thế chấp 2x với nhóm mới</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Khi tham gia dây với người chưa quen biết, hãy chọn dây có thế chấp 2x và bật Xác thực Team1 để tối đa hóa an toàn.
            </p>
          </div>
        </div>
      </section>

      {/* Glossary */}
      <section className="space-y-4">
        <div className="font-mono text-sm font-extrabold uppercase tracking-wider text-white">
          Từ điển Thuật ngữ Fintech &amp; Blockchain trên AvaHui
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ROSCA_GLOSSARY_ITEMS.map((item) => (
            <div
              key={item.term}
              className="rounded-none border border-zinc-800 bg-surface-card p-4 space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-xs sm:text-sm font-bold text-white">
                  {item.term}
                </h3>
                <span className="rounded-none border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                  {item.englishAlias}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">
                {item.definition}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-3">
        <div className="font-mono text-sm font-extrabold uppercase tracking-wider text-white">
          Câu hỏi &amp; Xử lý sự cố thường gặp
        </div>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <div
              key={faq.q}
              className="rounded-none border border-zinc-800 bg-surface-card p-4 space-y-1.5"
            >
              <h3 className="font-mono text-xs sm:text-sm font-bold text-white">
                {faq.q}
              </h3>
              <p className="text-xs leading-relaxed text-zinc-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

