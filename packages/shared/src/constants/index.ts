import { AllocationMode, CircleStatus, RoundStatus } from '../enums';

export const AVALANCHE_FUJI_CHAIN_ID = 43113;
export const AVALANCHE_FUJI_NAME = 'Avalanche Fuji Testnet';
export const AVALANCHE_FUJI_EXPLORER_URL = 'https://testnet.snowtrace.io';

export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = 'mUSDC';
export const TOKEN_SYMBOL = 'mUSDC';
export const TOKEN_NAME = 'Mock USD Coin (AvaHui Testnet)';
export const TOKEN_DECIMALS = 6;

export const MIN_CIRCLE_MEMBERS = 5;
export const MAX_CIRCLE_MEMBERS = 10;

export const CIRCLE_CONSTRAINTS = {
  MIN_MEMBERS: 5,
  MAX_MEMBERS: 10,
  MIN_CONTRIBUTION_USDC: 10,
  MAX_CONTRIBUTION_USDC: 100000,
  MIN_COLLATERAL_MULTIPLIER: 1,
  MAX_COLLATERAL_MULTIPLIER: 3,
  MIN_ROUND_DURATION_SECONDS: 60,        // 1 min for live Hackathon demo
  DEFAULT_ROUND_DURATION_SECONDS: 300,   // 5 mins for live Hackathon demo
  DEFAULT_BIDDING_DURATION_SECONDS: 180, // 3 mins
  DEFAULT_GRACE_PERIOD_SECONDS: 60,      // 1 min
  FAUCET_MINT_AMOUNT_USDC: 1000,
} as const;

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
