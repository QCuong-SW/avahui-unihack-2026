'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AllocationMode, CircleItem } from '@avahui/shared';
import { aiApi, CircleAdvisorDto } from '@/lib/api';
import { TOUR_SANDBOX_CIRCLE_ID } from '@/features/guide/context/InteractiveTourContext';
import { Sparkles, ShieldCheck, TrendingUp, Gavel } from 'lucide-react';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

function buildLocalFallbackAdvisor(circle: CircleItem): CircleAdvisorDto {
  const contrib = parseFloat(circle.contributionAmountFormatted) || 0;
  const col = parseFloat(circle.collateralAmountFormatted) || 0;
  const collateralRatio = contrib > 0 ? Number((col / contrib).toFixed(2)) : 1;
  const riskScore = circle.requireTeam1Attestation ? 20 : 35;
  const riskLevel = riskScore <= 30 ? 'LOW' : 'MEDIUM';

  return {
    circleId: circle.id,
    riskScore,
    riskLevel,
    collateralRatio,
    estimatedCycleYieldUsdc: (
      (col * circle.maxMembers * 0.065 * circle.roundDurationSeconds * circle.maxMembers) /
      (365 * 86400)
    ).toFixed(4),
    bidRecommendation:
      circle.allocationMode === AllocationMode.BIDDING
        ? {
            minBidUsdc: parseFloat(circle.minBidFormatted) || 1,
            optimalBidUsdc: Number(
              ((parseFloat(circle.minBidFormatted) || 1) +
                ((parseFloat(circle.maxBidFormatted) || 20) -
                  (parseFloat(circle.minBidFormatted) || 1)) *
                  0.35).toFixed(2),
            ),
            maxBidUsdc: parseFloat(circle.maxBidFormatted) || 20,
            currentHighestBidUsdc: 0,
            suggestedEffectiveApyPct: '2.50',
          }
        : null,
    highlights: [
      `Tỷ lệ bảo chứng thế chấp ${collateralRatio}x tiền đóng mỗi kỳ.`,
    ],
    summary: `Dây "${circle.name}" đạt mức rủi ro ${riskLevel === 'LOW' ? 'Thấp' : 'Trung bình'} (${riskScore}/100) với bảo chứng ${collateralRatio}x.`,
    aiPowered: false,
    model: 'deterministic-risk-engine-v1',
  };
}

const RISK_LEVEL_LABEL: Record<CircleAdvisorDto['riskLevel'], string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
};

export function CircleAdvisorCard({ circle }: { circle: CircleItem }) {
  const inviteCode =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('invite') ||
        circle.inviteCode ||
        undefined
      : circle.inviteCode || undefined;

  const { data } = useQuery<CircleAdvisorDto>({
    queryKey: ['avahui', 'ai-advisor', circle.id, inviteCode],
    queryFn: async () => {
      if (isMockMode || circle.id === TOUR_SANDBOX_CIRCLE_ID) {
        return buildLocalFallbackAdvisor(circle);
      }
      return await aiApi.getCircleAdvisor(circle.id, inviteCode);
    },
    staleTime: 15_000,
    retry: false,
  });

  const advisor = data || buildLocalFallbackAdvisor(circle);
  const badgeClass =
    advisor.riskLevel === 'LOW'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : advisor.riskLevel === 'MEDIUM'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : 'border-rose-500/40 bg-rose-500/10 text-rose-300';

  return (
    <section className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl p-4 sm:p-5 space-y-3.5 font-mono text-xs shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-white">
          <Sparkles className="h-4 w-4 text-sky-400" />
          <span>Trợ lý Rủi ro &amp; Đấu giá AvaHui</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
            Rủi ro {RISK_LEVEL_LABEL[advisor.riskLevel] || advisor.riskLevel} ({advisor.riskScore}/100)
          </span>
          <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] text-zinc-400">
            {advisor.aiPowered ? advisor.model : 'Phân tích định lượng'}
          </span>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-zinc-300">{advisor.summary}</p>

      <div className="grid gap-2.5 sm:grid-cols-3 text-[11px]">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Mức bảo chứng</span>
          </div>
          <div className="mt-1 font-bold text-white text-sm">{advisor.collateralRatio}x</div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span>Lãi Vault dự kiến</span>
          </div>
          <div className="mt-1 font-bold text-emerald-400 text-sm">
            +{advisor.estimatedCycleYieldUsdc} mUSDC
          </div>
        </div>

        {advisor.bidRecommendation && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <Gavel className="h-3.5 w-3.5 text-avalanche-red" />
              <span>Giá đấu gợi ý</span>
            </div>
            <div className="mt-1 font-bold text-amber-300 text-sm">
              {advisor.bidRecommendation.optimalBidUsdc} mUSDC
              <span className="ml-1 text-[10px] font-normal text-zinc-400">
                (chiết khấu {advisor.bidRecommendation.suggestedEffectiveApyPct}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

