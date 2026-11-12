'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AllocationMode,
  CIRCLE_CONSTRAINTS,
} from '@avahui/shared';
import {
  createCircleSchema,
  CreateCircleFormValues,
} from '../types/createCircleSchema';
import {
  useAvaHuiState,
} from '@/hooks/useAvaHuiMockQuery';
import { useCircleActions } from '@/hooks/useCircleActions';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import { formatUsdc } from '@/lib/utils';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Coins,
  Gavel,
  Layers,
  Lock,
  Repeat,
  Rocket,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export function CreateCircleView() {
  const router = useRouter();
  const { data: state } = useAvaHuiState();
  const { executeCreateCircle, isCreating } = useCircleActions();
  const { requestFaucet, isOperating: isFaucetOperating } = useTokenOperations();
  const { runTransaction } = useTxLifecycle();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateCircleFormValues>({
    resolver: zodResolver(createCircleSchema),
    defaultValues: {
      name: 'Hụi Nhóm Avahui — Kỳ 5 Người',
      description:
        'Dây hụi xoay vòng minh bạch trên Avalanche Fuji. Đóng góp đúng hạn, bảo vệ 100% bằng tài sản thế chấp mUSDC.',
      allocationMode: AllocationMode.BIDDING,
      maxMembers: 5,
      contributionAmountUsdc: 100,
      collateralMultiplier: 1,
      isDemoFastMode: true,
      roundDurationSeconds: CIRCLE_CONSTRAINTS.DEFAULT_ROUND_DURATION_SECONDS,
      biddingDurationSeconds:
        CIRCLE_CONSTRAINTS.DEFAULT_BIDDING_DURATION_SECONDS,
      gracePeriodSeconds: CIRCLE_CONSTRAINTS.DEFAULT_GRACE_PERIOD_SECONDS,
      minBidUsdc: 2,
      maxBidUsdc: 35,
      isSealedBid: true,
      enableYieldVault: true,
      isPrivateInvite: false,
      inviteCode: 'AVAHUI-VIP-2026',
      requireTeam1Attestation: false,
    },
  });

  const watchedValues = watch();

  if (!state) return null;

  const currentUser =
    state.users.find((u) => u.id === state.currentUserId) || state.users[0];

  const basePotUsdc =
    (watchedValues.maxMembers || 5) *
    (watchedValues.contributionAmountUsdc || 0);
  const requiredCollateralUsdc =
    (watchedValues.contributionAmountUsdc || 0) *
    (watchedValues.collateralMultiplier || 1);
  const userUsdcBal = parseFloat(currentUser.usdcBalance);
  const hasEnoughCollateral = userUsdcBal >= requiredCollateralUsdc;
  const team1Blocked =
    Boolean(watchedValues.requireTeam1Attestation) &&
    !Boolean(currentUser.isTeam1Verified);

  const applyPreset = (preset: 'BIDDING_DEMO' | 'FIXED_DEMO') => {
    if (preset === 'BIDDING_DEMO') {
      setValue('name', 'Hụi Đầu Tư Nhóm — Đấu Giá Nhanh');
      setValue(
        'description',
        'Dây hụi 5 người chế độ Đấu giá chiết khấu (Discount Bidding). Mỗi vòng 3 phút.'
      );
      setValue('allocationMode', AllocationMode.BIDDING);
      setValue('maxMembers', 5);
      setValue('contributionAmountUsdc', 100);
      setValue('collateralMultiplier', 1);
      setValue('roundDurationSeconds', 180);
      setValue('biddingDurationSeconds', 120);
      setValue('gracePeriodSeconds', 60);
      setValue('minBidUsdc', 2);
      setValue('maxBidUsdc', 40);
    } else {
      setValue('name', 'Hụi Tiết Kiệm Xoay Vòng Cố Định — Nhóm 5 Người');
      setValue(
        'description',
        'Dây hụi nhận tiền lần lượt theo thứ tự tham gia Slot #1 -> Slot #5.'
      );
      setValue('allocationMode', AllocationMode.FIXED);
      setValue('maxMembers', 5);
      setValue('contributionAmountUsdc', 50);
      setValue('collateralMultiplier', 1);
      setValue('roundDurationSeconds', 180);
      setValue('biddingDurationSeconds', 0);
      setValue('gracePeriodSeconds', 60);
      setValue('minBidUsdc', 0);
      setValue('maxBidUsdc', 0);
    }
  };

  const onSubmit = async (values: CreateCircleFormValues) => {
    await runTransaction({
      title: `Khởi tạo dây hụi "${values.name}"`,
      description: `Thế chấp vị trí #1: ${formatUsdc(requiredCollateralUsdc)} mUSDC`,
      action: async () => {
        return await executeCreateCircle({
          ...values,
          minBidUsdc:
            values.allocationMode === AllocationMode.BIDDING
              ? values.minBidUsdc
              : 0,
          maxBidUsdc:
            values.allocationMode === AllocationMode.BIDDING
              ? values.maxBidUsdc
              : 0,
        });
      },
      onSuccess: (res: any) => {
        if (res && 'newCircle' in res && res.newCircle?.id) {
          router.push(`/circles/${res.newCircle.id}`);
        } else {
          router.push('/circles');
        }
      },
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 animate-fade-down">
        <Link
          href="/circles"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 transition hover:text-white active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Danh sách dây hụi</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <HoverHint
            position="bottom"
            hint="Điền nhanh cấu hình dây hụi Đấu giá chiết khấu 5 người"
          >
            <button
              type="button"
              onClick={() => applyPreset('BIDDING_DEMO')}
              className="inline-flex items-center gap-1.5 rounded-none border border-avalanche-red/50 bg-avalanche-red/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-avalanche-red transition hover:bg-avalanche-red hover:text-white active:scale-95"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Mẫu: Đấu giá</span>
            </button>
          </HoverHint>

          <HoverHint
            position="bottom"
            hint="Điền nhanh cấu hình dây hụi Xoay vòng cố định 5 người"
          >
            <button
              type="button"
              onClick={() => applyPreset('FIXED_DEMO')}
              className="inline-flex items-center gap-1.5 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 hover:text-white active:scale-95"
            >
              <Repeat className="h-3.5 w-3.5 text-emerald-400" />
              <span>Mẫu: Cố định</span>
            </button>
          </HoverHint>
        </div>
      </div>

      {/* Form Grid */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid items-start gap-5 sm:gap-6 lg:grid-cols-12 animate-fade-up"
      >
        <div className="space-y-5 rounded-none border border-zinc-800 bg-surface-card p-4 sm:p-6 lg:col-span-7">
          <h1 className="border-b border-zinc-800 pb-3.5 font-mono text-xl font-extrabold uppercase tracking-wider text-white">
            Mở Dây Hụi Mới
          </h1>

          {/* Name & Description */}
          <div className="space-y-3.5">
            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                Tên Dây Hụi
              </label>
              <input
                type="text"
                {...register('name')}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3.5 py-2 font-mono text-sm text-white focus:border-avalanche-red focus:outline-none"
              />
              {errors.name && (
                <p className="mt-1 font-mono text-xs text-rose-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                Mô tả
              </label>
              <textarea
                rows={2}
                {...register('description')}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-avalanche-red focus:outline-none"
              />
              {errors.description && (
                <p className="mt-1 font-mono text-xs text-rose-400">
                  {errors.description.message}
                </p>
              )}
            </div>
          </div>

          {/* Allocation Mode */}
          <div className="space-y-1.5">
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
              Chế độ Phân phối
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <HoverHint
                hint="Thành viên chưa nhận hụi đấu giá mức chiết khấu cao nhất để nhận quỹ trước. Tiền chiết khấu chia đều cuối kỳ."
                className="w-full"
              >
                <div
                  onClick={() =>
                    setValue('allocationMode', AllocationMode.BIDDING, {
                      shouldValidate: true,
                    })
                  }
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-none border p-3.5 font-mono text-sm font-bold uppercase tracking-wider transition ${
                    watchedValues.allocationMode === AllocationMode.BIDDING
                      ? 'border-avalanche-red bg-avalanche-red/10 text-white'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Gavel className="h-4 w-4 text-avalanche-red" />
                  <span>Đấu giá chiết khấu</span>
                </div>
              </HoverHint>

              <HoverHint
                hint="Nhận 100% quỹ lần lượt theo thứ tự vị trí tham gia từ Slot #1 đến Slot #N."
                className="w-full"
              >
                <div
                  onClick={() =>
                    setValue('allocationMode', AllocationMode.FIXED, {
                      shouldValidate: true,
                    })
                  }
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-none border p-3.5 font-mono text-sm font-bold uppercase tracking-wider transition ${
                    watchedValues.allocationMode === AllocationMode.FIXED
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <Repeat className="h-4 w-4 text-emerald-400" />
                  <span>Thứ tự cố định</span>
                </div>
              </HoverHint>
            </div>
          </div>

          {/* Members, Contribution, Collateral */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                Thành viên (5–10)
              </label>
              <select
                {...register('maxMembers', { valueAsNumber: true })}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm font-semibold text-white focus:border-avalanche-red focus:outline-none"
              >
                {[5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} Người ({num} Vòng)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                Mức đóng / Kỳ (mUSDC)
              </label>
              <input
                type="number"
                step="10"
                {...register('contributionAmountUsdc', { valueAsNumber: true })}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm font-semibold text-white focus:border-avalanche-red focus:outline-none"
              />
              {errors.contributionAmountUsdc && (
                <p className="mt-1 font-mono text-xs text-rose-400">
                  {errors.contributionAmountUsdc.message}
                </p>
              )}
            </div>

            <div>
              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                Thế chấp
              </label>
              <select
                {...register('collateralMultiplier', { valueAsNumber: true })}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm font-semibold text-amber-300 focus:border-avalanche-red focus:outline-none"
              >
                <option value={1}>1x (100%)</option>
                <option value={2}>2x (200%)</option>
                <option value={3}>3x (300%)</option>
              </select>
              {watchedValues.collateralMultiplier === 1 && (
                <p className="mt-1 text-[10px] text-amber-400/90 leading-snug">
                  1x chỉ bù tối đa 1 kỳ trễ hạn; khuyến nghị 2x–3x cho nhóm công khai.
                </p>
              )}
            </div>
          </div>

          {/* Bid Bounds */}
          {watchedValues.allocationMode === AllocationMode.BIDDING && (
            <div className="grid gap-4 rounded-none border border-avalanche-red/30 bg-avalanche-red/5 p-3.5 sm:grid-cols-2">
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Min Bid (mUSDC)
                </label>
                <input
                  type="number"
                  {...register('minBidUsdc', { valueAsNumber: true })}
                  className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-white"
                />
                {errors.minBidUsdc && (
                  <p className="mt-1 font-mono text-xs text-rose-400">
                    {errors.minBidUsdc.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Max Bid (&le; {formatUsdc(basePotUsdc * 0.5)} mUSDC)
                </label>
                <input
                  type="number"
                  {...register('maxBidUsdc', { valueAsNumber: true })}
                  className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-sm text-white"
                />
                {errors.maxBidUsdc && (
                  <p className="mt-1 font-mono text-xs text-rose-400">
                    {errors.maxBidUsdc.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timing */}
          <div className="grid gap-3 rounded-none border border-zinc-800 bg-zinc-900/50 p-3.5 sm:grid-cols-3">
            <div>
              <label className="flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Clock className="h-3 w-3 text-emerald-400" />
                <span>Round (giây)</span>
              </label>
              <input
                type="number"
                {...register('roundDurationSeconds', { valueAsNumber: true })}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-white"
              />
            </div>

            {watchedValues.allocationMode === AllocationMode.BIDDING && (
              <div>
                <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Bidding (giây)
                </label>
                <input
                  type="number"
                  {...register('biddingDurationSeconds', {
                    valueAsNumber: true,
                  })}
                  className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-white"
                />
                {errors.biddingDurationSeconds && (
                  <p className="mt-1 font-mono text-[11px] text-rose-400">
                    {errors.biddingDurationSeconds.message}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Grace Period (giây)
              </label>
              <input
                type="number"
                {...register('gracePeriodSeconds', { valueAsNumber: true })}
                className="mt-1 w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-white"
              />
            </div>
          </div>

          {/* V2 Protocol Security & DeFi Yield Options */}
          <div className="space-y-2.5 rounded-none border border-emerald-500/30 bg-emerald-500/5 p-3.5 font-mono">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Cơ chế Bảo mật &amp; Kho Sinh Lời V2
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 text-xs">
              <label className="flex cursor-pointer items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-zinc-200 hover:border-zinc-700">
                <input
                  type="checkbox"
                  {...register('isSealedBid')}
                  className="h-3.5 w-3.5 accent-avalanche-red"
                />
                <span>Đấu giá kín 2 pha (Chống lộ giá)</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-zinc-200 hover:border-zinc-700">
                <input
                  type="checkbox"
                  {...register('enableYieldVault')}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span>Kho sinh lời ERC-4626 (6.5% APY)</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-zinc-200 hover:border-zinc-700">
                <input
                  type="checkbox"
                  {...register('requireTeam1Attestation')}
                  className="h-3.5 w-3.5 accent-amber-500"
                />
                <span>Xác thực Team1 (1 người / 1 suất)</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-zinc-200 hover:border-zinc-700">
                <input
                  type="checkbox"
                  {...register('isPrivateInvite')}
                  className="h-3.5 w-3.5 accent-sky-500"
                />
                <span>Dây riêng tư (Khóa bằng mã mời)</span>
              </label>
            </div>

            {team1Blocked && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-none border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                <span>
                  Tài khoản của bạn chưa xác thực Team1 nên không thể tự join Slot #1 khi bật tùy chọn này.
                </span>
                <Link
                  href="/profile"
                  className="font-bold text-amber-300 underline hover:text-white"
                >
                  Xác thực Team1 tại /profile →
                </Link>
              </div>
            )}

            {watchedValues.isPrivateInvite && (
              <div className="mt-2 space-y-1 rounded-none border border-sky-500/30 bg-sky-500/5 p-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-sky-300">
                  Mã mời riêng tư (Invite Code)
                </label>
                <input
                  type="text"
                  {...register('inviteCode')}
                  placeholder="Ví dụ: AVAHUI-VIP-2026"
                  className="w-full rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs font-bold text-white focus:border-sky-400 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-400">
                  Mã này được băm <code className="text-sky-300">keccak256</code> lên Smart Contract &amp; Backend để ẩn dây khỏi danh sách công khai.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Live Summary Box */}
        <div className="sticky top-24 space-y-4 rounded-none border border-zinc-800 bg-surface-card p-6 shadow-2xl lg:col-span-5">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
            <h2 className="font-mono text-base font-bold uppercase tracking-wider text-white">Tóm tắt Hợp đồng</h2>
            <Layers className="h-4 w-4 text-avalanche-red" />
          </div>

          <HoverHint
            hint={`${watchedValues.maxMembers || 5} thành viên × ${formatUsdc(watchedValues.contributionAmountUsdc || 0)} mUSDC / kỳ`}
            className="w-full"
          >
            <div className="w-full rounded-none border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <div className="font-mono text-xs uppercase tracking-wider text-emerald-300">Tổng quỹ / Kỳ</div>
              <div className="mt-1 font-mono text-3xl font-extrabold text-white">
                {formatUsdc(basePotUsdc)}{' '}
                <span className="text-base font-semibold text-emerald-400">
                  mUSDC
                </span>
              </div>
            </div>
          </HoverHint>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-none border border-zinc-800/80 bg-zinc-900/80 px-3.5 py-2.5">
              <span className="flex items-center gap-1.5 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                <Users className="h-3.5 w-3.5 text-avalanche-red" />
                <span>Tổng số kỳ</span>
              </span>
              <span className="font-mono font-bold text-white">
                {watchedValues.maxMembers || 5} kỳ
              </span>
            </div>

            <div className="flex items-center justify-between rounded-none border border-zinc-800/80 bg-zinc-900/80 px-3.5 py-2.5">
              <span className="flex items-center gap-1.5 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                <Lock className="h-3.5 w-3.5 text-amber-400" />
                <span>Thế chấp yêu cầu</span>
              </span>
              <span className="font-mono font-bold text-amber-300">
                {formatUsdc(requiredCollateralUsdc)} mUSDC
              </span>
            </div>

            <div className="flex items-center justify-between rounded-none border border-zinc-800/80 bg-zinc-900/80 px-3.5 py-2.5">
              <span className="flex items-center gap-1.5 font-mono text-zinc-400 uppercase tracking-wider text-[11px]">
                <Coins className="h-3.5 w-3.5 text-emerald-400" />
                <span>Số dư ví hiện tại</span>
              </span>
              <span
                className={`font-mono font-bold ${
                  hasEnoughCollateral ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatUsdc(currentUser.usdcBalance)} mUSDC
              </span>
            </div>
          </div>

          {!hasEnoughCollateral && (
            <div className="flex items-center justify-between rounded-none border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              <span className="flex items-center gap-1.5 font-mono font-semibold text-[11px] uppercase tracking-wider">
                <AlertTriangle className="h-4 w-4 text-rose-400" />
                <span>Thiếu mUSDC thế chấp</span>
              </span>
              <button
                type="button"
                disabled={isFaucetOperating}
                onClick={() => requestFaucet(1000)}
                className="rounded-none bg-avalanche-red px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:opacity-60"
              >
                Nhận +1,000 mUSDC
              </button>
            </div>
          )}

          <HoverHint
            hint={`Triển khai hợp đồng AvaHuiCircle mới và tự động khóa ${formatUsdc(requiredCollateralUsdc)} mUSDC cho vị trí Slot #1 của bạn`}
            className="w-full"
          >
            <button
              type="submit"
              disabled={isSubmitting || isCreating || !hasEnoughCollateral || team1Blocked}
              className="flex w-full items-center justify-center gap-2 rounded-none bg-avalanche-red px-5 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xl shadow-avalanche-red/25 transition hover:bg-avalanche-darkRed disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Rocket className="h-4 w-4" />
              <span>
                Mở dây hụi • Khóa {formatUsdc(requiredCollateralUsdc)} mUSDC
              </span>
            </button>
          </HoverHint>
        </div>
      </form>
    </div>
  );
}
