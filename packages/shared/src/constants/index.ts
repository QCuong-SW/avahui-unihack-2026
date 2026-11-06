import { AllocationMode, CircleStatus, RoundStatus } from '../enums';

export const AVALANCHE_FUJI_CHAIN_ID = 43113;
export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = 'mUSDC';

export const MIN_CIRCLE_MEMBERS = 5;
export const MAX_CIRCLE_MEMBERS = 10;

export const SC_ALLOCATION_MODE_MAP: Record<number, AllocationMode> = {
  0: AllocationMode.FIXED,
  1: AllocationMode.BIDDING,
};

export const ALLOCATION_MODE_TO_SC: Record<AllocationMode, number> = {
  [AllocationMode.FIXED]: 0,
  [AllocationMode.BIDDING]: 1,
};

export const SC_CIRCLE_STATUS_MAP: Record<number, CircleStatus> = {
  0: CircleStatus.Recruiting,
  1: CircleStatus.Active,
  2: CircleStatus.Completed,
  3: CircleStatus.Cancelled,
};

export const SC_ROUND_STATUS_MAP: Record<number, RoundStatus> = {
  0: RoundStatus.Pending,
  1: RoundStatus.Open,
  2: RoundStatus.Settled,
};

export function formatTokenUnits(rawAmount: string | bigint | number, decimals = USDC_DECIMALS): string {
  const value = BigInt(rawAmount || 0);
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 2);
  return `${whole.toString()}.${fractionStr}`;
}

