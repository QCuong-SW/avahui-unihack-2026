import { apiFetch } from './client';
import type {
  CircleDetailDto,
  RoundDetailDto,
  AllocationMode,
  CircleStatus,
} from '@avahui/shared';

export interface ListCirclesQuery {
  status?: CircleStatus;
  mode?: AllocationMode;
  memberAddress?: string;
  page?: number;
  limit?: number;
}

export interface ListCirclesResponse {
  items: CircleDetailDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateCircleDraftInput {
  name: string;
  description?: string;
  creatorAddress?: string;
  tokenAddress?: string;
  allocationMode: AllocationMode;
  maxMembers: number;
  contributionAmount: string; // base units (6 decimals)
  collateralAmount: string;   // base units (6 decimals)
  roundDurationSeconds: number;
  biddingDurationSeconds?: number;
  gracePeriodSeconds?: number;
  startDeadline?: string;
  minBid?: string;
  maxBid?: string;
  isPrivateInvite?: boolean;
  inviteCode?: string;
  inviteCodeHash?: string;
  requireTeam1Attestation?: boolean;
}

export interface CreateCircleDraftResponse {
  id: string;
  metadataId: string;
  name: string;
  creatorAddress: string;
  startDeadlineUnix: number;
  allocationMode: AllocationMode;
  maxMembers: number;
  contributionAmount: string;
  collateralAmount: string;
  roundDurationSeconds: number;
  biddingDurationSeconds: number;
  gracePeriodSeconds: number;
  minBid: string;
  maxBid: string;
}

export const circleApi = {
  listCircles: async (query?: ListCirclesQuery): Promise<ListCirclesResponse> => {
    return apiFetch<ListCirclesResponse>('/circles', {
      method: 'GET',
      params: query as Record<string, string | number | boolean | undefined>,
    });
  },

  getCircleById: async (
    idOrAddress: string,
    inviteCode?: string,
  ): Promise<CircleDetailDto> => {
    return apiFetch<CircleDetailDto>(`/circles/${encodeURIComponent(idOrAddress)}`, {
      method: 'GET',
      params: inviteCode ? { inviteCode } : undefined,
    });
  },

  createDraft: async (
    input: CreateCircleDraftInput,
    walletAddress?: string,
  ): Promise<CreateCircleDraftResponse> => {
    return apiFetch<CreateCircleDraftResponse>('/circles/draft', {
      method: 'POST',
      body: JSON.stringify(input),
      walletAddress: walletAddress || input.creatorAddress,
    });
  },

  getRoundDetail: async (
    circleId: string,
    roundNumber: number,
  ): Promise<RoundDetailDto> => {
    return apiFetch<RoundDetailDto>(
      `/circles/${encodeURIComponent(circleId)}/rounds/${roundNumber}`,
      {
        method: 'GET',
      },
    );
  },
};
