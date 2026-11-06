// ============================================================================
// @avahui/shared — Shared TypeScript Interfaces & DTO Contracts
// ============================================================================

import {
  AllocationMode,
  CircleStatus,
  MemberStatus,
  RoundStatus,
  TransactionStatus,
  TransactionType,
} from '../enums';

export interface UserStats {
  activeCirclesCount: number;
  totalContributed: string;
  totalCollateralLocked: string;
  totalPayoutReceived: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress: string;
  avaxBalance: string;
  usdcBalance: string;
  usdcAllowance: string;
  stats: UserStats;
}

export interface CircleMemberItem {
  slotIndex: number;
  userId: string;
  displayName: string;
  walletAddress: string;
  initialCollateralFormatted: string;
  lockedCollateralFormatted: string;
  slashedCollateralFormatted: string;
  hasReceivedPayout: boolean;
  wonRoundNumber: number | null;
  defaultCount: number;
  status: MemberStatus;
  joinedAt: string;
  joinTxHash: string;
}

export interface RoundContributionItem {
  memberAddress: string;
  memberName: string;
  amountFormatted: string;
  isFromCollateralSlash: boolean;
  paidAt: string;
  txHash: string;
}

export interface RoundBidItem {
  bidderAddress: string;
  bidderName: string;
  bidAmountFormatted: string;
  isWinningBid?: boolean;
  createdAt: string;
  txHash: string;
}

export interface CircleRoundItem {
  roundNumber: number;
  status: RoundStatus;
  startTime: string;
  contributionDeadline: string;
  biddingDeadline: string;
  graceDeadline: string;
  winnerAddress: string | null;
  winnerName: string | null;
  grossPotFormatted: string;
  winningBidFormatted: string;
  netPayoutFormatted: string;
  settlementTxHash: string | null;
  settledAt?: string | null;
  contributionsCount: number;
  contributions: RoundContributionItem[];
  bids: RoundBidItem[];
}

export interface CircleItem {
  id: string;
  metadataId: string;
  contractAddress: string;
  name: string;
  description: string;
  creatorAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  allocationMode: AllocationMode;
  status: CircleStatus;
  maxMembers: number;
  currentMemberCount: number;
  currentRound: number;
  totalRounds: number;
  contributionAmount: string;
  contributionAmountFormatted: string;
  collateralAmount: string;
  collateralAmountFormatted: string;
  roundDurationSeconds: number;
  biddingDurationSeconds: number;
  gracePeriodSeconds: number;
  startDeadline: string;
  minBid: string;
  minBidFormatted: string;
  maxBid: string;
  maxBidFormatted: string;
  totalDiscountPool: string;
  totalDiscountPoolFormatted: string;
  createdAt: string;
  members: CircleMemberItem[];
  rounds: CircleRoundItem[];
}

export interface CreateCircleFormInput {
  name: string;
  description: string;
  allocationMode: AllocationMode;
  maxMembers: number;
  contributionAmountUsdc: number;
  collateralMultiplier: number; // 1x, 2x, 3x
  isDemoFastMode: boolean;
  roundDurationSeconds: number;
  biddingDurationSeconds: number;
  gracePeriodSeconds: number;
  minBidUsdc: number;
  maxBidUsdc: number;
}

export interface BlockchainTransactionItem {
  id: string;
  chainId: number;
  txHash: string;
  senderAddress: string;
  senderName: string;
  contractAddress: string;
  circleId?: string;
  circleName?: string;
  txType: TransactionType;
  status: TransactionStatus;
  blockNumber: number;
  amountFormatted?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  circleId?: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}
