import { z } from 'zod';
import { AllocationMode, CIRCLE_CONSTRAINTS } from '@avahui/shared';

export const createCircleSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Tên dây hụi phải có ít nhất 3 ký tự')
      .max(80, 'Tên dây hụi tối đa 80 ký tự'),
    description: z
      .string()
      .min(10, 'Mô tả quy định nhóm tối thiểu 10 ký tự')
      .max(500, 'Mô tả tối đa 500 ký tự'),
    allocationMode: z.nativeEnum(AllocationMode),
    maxMembers: z
      .number()
      .int()
      .min(CIRCLE_CONSTRAINTS.MIN_MEMBERS, 'Tối thiểu 5 thành viên')
      .max(CIRCLE_CONSTRAINTS.MAX_MEMBERS, 'Tối đa 10 thành viên'),
    contributionAmountUsdc: z
      .number()
      .min(CIRCLE_CONSTRAINTS.MIN_CONTRIBUTION_USDC, 'Tối thiểu 10 mUSDC / kỳ')
      .max(
        CIRCLE_CONSTRAINTS.MAX_CONTRIBUTION_USDC,
        'Tối đa 100,000 mUSDC / kỳ'
      ),
    collateralMultiplier: z
      .number()
      .int()
      .min(1, 'Tối thiểu 1x tiền đóng 1 kỳ')
      .max(3, 'Tối đa 3x tiền đóng 1 kỳ'),
    isDemoFastMode: z.boolean(),
    roundDurationSeconds: z
      .number()
      .int()
      .min(60, 'Thời gian mỗi vòng tối thiểu 60 giây'),
    biddingDurationSeconds: z
      .number()
      .int()
      .min(0, 'Thời gian đấu giá không hợp lệ'),
    gracePeriodSeconds: z
      .number()
      .int()
      .min(30, 'Thời gian ân hạn tối thiểu 30 giây'),
    minBidUsdc: z.number().min(0),
    maxBidUsdc: z.number().min(0),
    isSealedBid: z.boolean().optional(),
    isYieldEnabled: z.boolean().optional(),
    isPrivateCircle: z.boolean().optional(),
    requiresAttestation: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const basePot = data.maxMembers * data.contributionAmountUsdc;

    if (data.allocationMode === AllocationMode.BIDDING) {
      if (data.biddingDurationSeconds < 30) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['biddingDurationSeconds'],
          message: 'Thời gian đấu giá tối thiểu 30 giây ở chế độ BIDDING',
        });
      }

      if (data.biddingDurationSeconds >= data.roundDurationSeconds) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['biddingDurationSeconds'],
          message: 'Thời gian đấu giá phải nhỏ hơn thời lượng cả vòng hụi',
        });
      }

      if (data.minBidUsdc < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minBidUsdc'],
          message: 'Giá đấu tối thiểu (minBid) phải từ 1 mUSDC trở lên',
        });
      }

      if (data.maxBidUsdc <= data.minBidUsdc) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxBidUsdc'],
          message: 'Giá đấu tối đa (maxBid) phải lớn hơn minBid',
        });
      }

      if (data.maxBidUsdc > basePot * 0.5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxBidUsdc'],
          message: `Giá đấu tối đa không được vượt quá 50% tổng quỹ (${(
            basePot * 0.5
          ).toFixed(0)} mUSDC)`,
        });
      }
    }
  });

export type CreateCircleFormValues = z.infer<typeof createCircleSchema>;
