import { apiFetch } from './client';

export interface CircleAdvisorDto {
  circleId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  collateralRatio: number;
  estimatedCycleYieldUsdc: string;
  bidRecommendation: {
    minBidUsdc: number;
    optimalBidUsdc: number;
    maxBidUsdc: number;
    currentHighestBidUsdc: number;
    suggestedEffectiveApyPct: string;
  } | null;
  highlights: string[];
  summary: string;
  aiPowered: boolean;
  model: string;
}

export const aiApi = {
  getCircleAdvisor: (circleId: string, inviteCode?: string) =>
    apiFetch<CircleAdvisorDto>(`/ai/circles/${encodeURIComponent(circleId)}/advisor`, {
      method: 'GET',
      params: inviteCode ? { inviteCode } : undefined,
    }),
};

