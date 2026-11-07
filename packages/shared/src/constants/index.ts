// ============================================================================
// @avahui/shared — Shared Platform Constants
// ============================================================================

export const AVALANCHE_FUJI_CHAIN_ID = 43113;
export const AVALANCHE_FUJI_NAME = 'Avalanche Fuji Testnet';
export const AVALANCHE_FUJI_EXPLORER_URL = 'https://testnet.snowtrace.io';

export const TOKEN_SYMBOL = 'mUSDC';
export const TOKEN_NAME = 'Mock USD Coin (AvaHui Testnet)';
export const TOKEN_DECIMALS = 6;

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
