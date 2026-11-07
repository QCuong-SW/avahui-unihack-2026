export interface CreateCircleOnChainParams {
  metadataId: string;
  name: string;
  token: `0x${string}`;
  allocationMode: number;
  maxMembers: number;
  contributionAmount: bigint;
  collateralAmount: bigint;
  roundDuration: bigint;
  biddingDuration: bigint;
  gracePeriod: bigint;
  startDeadline: bigint;
  minBid: bigint;
  maxBid: bigint;
}

