import {
  AllocationMode,
  CircleStatus,
  RoundStatus,
  MemberStatus,
  TransactionType,
  TransactionStatus,
} from '../enums';

export interface UserStatsDto {
  activeCirclesCount: number;
  totalContributed: string;
  totalCollateralLocked: string;
  totalPayoutReceived: string;
}

export interface WalletDto {
  id: string;
  address: string;
  walletClientType: string;
  isPrimary: boolean;
}

export interface UserProfileDto {
  id: string;
  privyDid?: string;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  walletAddress: string | null;
  wallets?: WalletDto[];
  stats: UserStatsDto;
}

export interface CircleMemberDto {
  id?: string;
  slotIndex: number;
  userId: string | null;
  displayName: string | null;
  walletAddress: string;
  lockedCollateral?: string;
  lockedCollateralFormatted: string;
  initialLockedAmountFormatted?: string;
  totalSlashedAmountFormatted?: string;
  hasReceivedPayout: boolean;
  wonRoundNumber: number | null;
  defaultCount: number;
  status: MemberStatus;
  joinTxHash?: string;
  joinedAt?: string;
}

export interface ContributionDto {
  id?: string;
  roundNumber?: number;
  memberAddress: string;
  memberName: string | null;
  amount?: string;
  amountFormatted: string;
  isFromCollateralSlash?: boolean;
  paidAt: string;
  txHash: string;
}

export interface BidDto {
  id?: string;
  roundNumber?: number;
  bidderAddress: string;
  bidderName: string | null;
  bidAmount?: string;
  bidAmountFormatted: string;
  isWinningBid?: boolean;
  createdAt: string;
  txHash: string;
}

export interface PayoutDto {
  id?: string;
  roundNumber: number;
  recipientAddress: string;
  recipientName?: string | null;
  grossAmount: string;
  grossAmountFormatted: string;
  discountAmount: string;
  discountAmountFormatted: string;
  netAmount: string;
  netAmountFormatted: string;
  txHash: string;
  paidAt: string;
}

export interface RoundDetailDto {
  id?: string;
  roundNumber: number;
  status: RoundStatus;
  startTime: string | null;
  contributionDeadline: string | null;
  biddingDeadline: string | null;
  graceDeadline: string | null;
  winnerAddress: string | null;
  winnerName: string | null;
  grossPot?: string;
  grossPotFormatted: string;
  winningBid?: string;
  winningBidFormatted: string;
  netPayout?: string;
  netPayoutFormatted: string;
  settlementTxHash: string | null;
  settledAt?: string | null;
  contributionsCount: number;
  contributions?: ContributionDto[];
  bids?: BidDto[];
  payout?: PayoutDto | null;
}

export interface CircleDetailDto {
  id: string;
  metadataId: string;
  contractAddress: string | null;
  chainId?: number;
  name: string;
  description: string | null;
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
  startDeadline?: string;
  minBid: string;
  minBidFormatted?: string;
  maxBid: string;
  maxBidFormatted?: string;
  totalDiscountPool: string;
  totalDiscountPoolFormatted?: string;
  creationTxHash?: string | null;
  createdAt: string;
  members: CircleMemberDto[];
  rounds: RoundDetailDto[];
}

export interface TransactionRecordDto {
  id: string;
  chainId: number;
  txHash: string;
  senderAddress: string;
  contractAddress: string;
  circleId: string | null;
  circleName?: string | null;
  txType: TransactionType;
  status: TransactionStatus;
  blockNumber: string | null;
  errorMessage: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface NotificationItemDto {
  id: string;
  userId: string;
  circleId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

