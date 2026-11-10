import {
  UserRole,
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
export type UserStats = UserStatsDto;

export interface WalletDto {
  id: string;
  address: string;
  walletClientType: string;
  isPrimary: boolean;
}

export interface UserProfileDto {
  id: string;
  privyDid?: string;
  role?: UserRole;
  isActive?: boolean;
  email: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  walletAddress: string | null;
  wallets?: WalletDto[];
  avaxBalance?: string;
  usdcBalance?: string;
  usdcAllowance?: string;
  team1Attested?: boolean;
  isTeam1Verified?: boolean;
  identityNullifier?: string;
  trustTier?: number;
  stats: UserStatsDto;
}

export interface UserProfile {
  id: string;
  role?: UserRole;
  isActive?: boolean;
  email: string;
  displayName: string;
  avatarUrl?: string;
  walletAddress: string;
  avaxBalance: string;
  usdcBalance: string;
  usdcAllowance: string;
  team1Attested?: boolean;
  isTeam1Verified?: boolean;
  identityNullifier?: string;
  trustTier?: number;
  stats: UserStats;
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
  initialCollateralFormatted?: string;
  totalSlashedAmountFormatted?: string;
  slashedCollateralFormatted?: string;
  hasReceivedPayout: boolean;
  wonRoundNumber: number | null;
  defaultCount: number;
  status: MemberStatus;
  identityNullifier?: string;
  team1Verified?: boolean;
  joinTxHash?: string;
  joinedAt?: string;
}
export type CircleMemberItem = CircleMemberDto;

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
export type RoundContributionItem = ContributionDto;

export interface BidDto {
  id?: string;
  roundNumber?: number;
  bidderAddress: string;
  bidderName: string | null;
  bidAmount?: string;
  bidAmountFormatted: string;
  isWinningBid?: boolean;
  isSealedReveal?: boolean;
  commitmentHash?: string;
  createdAt: string;
  txHash: string;
}
export type RoundBidItem = BidDto;

export interface BidCommitmentDto {
  bidderAddress: string;
  bidderName: string | null;
  commitmentHash?: string;
  commitment?: string;
  committedAt: string;
  revealed?: boolean;
  isRevealed?: boolean;
  revealedAmountFormatted?: string;
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
  contributions: ContributionDto[];
  bids: BidDto[];
  commitments?: BidCommitmentDto[];
  payout?: PayoutDto | null;
}
export type CircleRoundItem = RoundDetailDto;

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
  tokenDecimals?: number;
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
  collateralMultiplier?: number;
  roundDurationSeconds: number;
  biddingDurationSeconds: number;
  gracePeriodSeconds: number;
  startDeadline?: string;
  minBid: string;
  minBidFormatted: string;
  maxBid: string;
  maxBidFormatted: string;
  totalDiscountPool: string;
  totalDiscountPoolFormatted: string;
  // V2 Security & Yield Extensions
  isSealedBid?: boolean;
  enableYieldVault?: boolean;
  yieldApyBps?: number;
  accruedYieldFormatted?: string;
  isPrivateInvite?: boolean;
  inviteCode?: string;
  requireTeam1Attestation?: boolean;
  creationTxHash?: string | null;
  createdAt: string;
  members: CircleMemberDto[];
  rounds: RoundDetailDto[];
}
export type CircleItem = CircleDetailDto;

export interface CreateCircleFormInput {
  name: string;
  description: string;
  allocationMode: AllocationMode;
  maxMembers: number;
  contributionAmountUsdc: number;
  collateralMultiplier: number;
  isDemoFastMode: boolean;
  roundDurationSeconds: number;
  biddingDurationSeconds: number;
  gracePeriodSeconds: number;
  minBidUsdc: number;
  maxBidUsdc: number;
  isSealedBid?: boolean;
  enableYieldVault?: boolean;
  isPrivateInvite?: boolean;
  inviteCode?: string;
  requireTeam1Attestation?: boolean;
}

export interface TransactionRecordDto {
  id: string;
  chainId: number;
  txHash: string;
  senderAddress: string;
  senderName?: string;
  contractAddress?: string | null;
  circleId?: string | null;
  circleName?: string | null;
  txType: TransactionType;
  status: TransactionStatus;
  blockNumber: string | number | null;
  amountFormatted?: string;
  errorMessage?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
}
export type BlockchainTransactionItem = TransactionRecordDto;

export interface NotificationItemDto {
  id: string;
  userId: string;
  circleId: string | null;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}
export type NotificationItem = NotificationItemDto;
