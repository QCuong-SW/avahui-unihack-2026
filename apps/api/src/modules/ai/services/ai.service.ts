import { Injectable, Logger } from '@nestjs/common';
import { AllocationMode } from '@avahui/shared';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { CirclesService } from '../../circles/services/circles.service';

export interface CircleAdvisorResponse {
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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly circlesService: CirclesService) {}

  /** Generates quantitative on-chain ROSCA risk/bid advice, optionally enriched via Gemini. */
  async getCircleAdvisor(
    circleId: string,
    authUser?: AuthenticatedUser,
    inviteCode?: string,
  ): Promise<CircleAdvisorResponse> {
    const circle = await this.circlesService.getCircleById(
      circleId,
      authUser,
      inviteCode,
    );

    const contribution = parseFloat(circle.contributionAmountFormatted) || 0;
    const collateral = parseFloat(circle.collateralAmountFormatted) || 0;
    const collateralRatio = contribution > 0 ? Number((collateral / contribution).toFixed(2)) : 1;
    const totalDefaults = (circle.members || []).reduce(
      (sum: number, m: any) => sum + Number(m.defaultCount || 0),
      0,
    );

    // Deterministic safety score out of 100 (higher = safer)
    let safetyScore = 55;
    if (collateralRatio >= 2) safetyScore += 20;
    else if (collateralRatio >= 1) safetyScore += 10;
    if (circle.requireTeam1Attestation) safetyScore += 10;
    if (circle.isSealedBid) safetyScore += 8;
    if (circle.enableYieldVault) safetyScore += 7;
    safetyScore -= Math.min(35, totalDefaults * 12);
    if (circle.isPaused) safetyScore -= 25;
    safetyScore = Math.max(5, Math.min(100, safetyScore));

    const riskScore = 100 - safetyScore;
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      riskScore <= 30 ? 'LOW' : riskScore <= 60 ? 'MEDIUM' : 'HIGH';

    const totalCycleSeconds =
      Number(circle.roundDurationSeconds || 300) * Number(circle.maxMembers || 5);
    const totalLockedPrincipal = collateral * Number(circle.maxMembers || 5);
    const estimatedCycleYieldUsdc = (
      (totalLockedPrincipal * 0.065 * totalCycleSeconds) /
      (365 * 86400)
    ).toFixed(4);

    let bidRecommendation: CircleAdvisorResponse['bidRecommendation'] = null;
    if (circle.allocationMode === AllocationMode.BIDDING) {
      const minBid = parseFloat(circle.minBidFormatted) || 1;
      const maxBid = parseFloat(circle.maxBidFormatted) || Math.max(minBid + 5, 20);
      const currentRoundObj = (circle.rounds || []).find(
        (r: any) => r.roundNumber === circle.currentRound,
      );
      const currentHighest = currentRoundObj
        ? (currentRoundObj.bids || []).reduce(
            (max: number, b: any) => Math.max(max, parseFloat(b.bidAmountFormatted) || 0),
            0,
          )
        : 0;
      const grossPot = contribution * Number(circle.maxMembers || 5);
      const baselineOptimal = Math.min(
        maxBid,
        Math.max(minBid, currentHighest > 0 ? currentHighest + 1 : minBid + (maxBid - minBid) * 0.35),
      );
      const optimalBidUsdc = Number(baselineOptimal.toFixed(2));
      const discountPct = grossPot > 0 ? (optimalBidUsdc / grossPot) * 100 : 0;

      bidRecommendation = {
        minBidUsdc: minBid,
        optimalBidUsdc,
        maxBidUsdc: maxBid,
        currentHighestBidUsdc: currentHighest,
        suggestedEffectiveApyPct: discountPct.toFixed(2),
      };
    }

    const highlights: string[] = [
      `Tỷ lệ thế chấp bảo chứng ${collateralRatio}x tiền đóng (${circle.collateralAmountFormatted} mUSDC/slot).`,
      circle.requireTeam1Attestation
        ? 'Bật Team1 Anti-Sybil: chặn trùng danh tính 1-Human-1-Slot.'
        : 'Chưa bật Team1 Anti-Sybil: phù hợp nhóm quen biết hoặc công khai.',
      circle.enableYieldVault
        ? `Quỹ thế chấp sinh lời tự động tại AvaHuiYieldVault (6.50% APY, ước tính ~${estimatedCycleYieldUsdc} mUSDC/chu kỳ).`
        : 'Không bật Yield Vault: vốn giữ nguyên trực tiếp trong AvaHuiCircle.',
    ];
    if (totalDefaults > 0) {
      highlights.push(`Cảnh báo: đã ghi nhận ${totalDefaults} lần trễ hạn bị trích thế chấp.`);
    }

    const fallbackSummary =
      circle.allocationMode === AllocationMode.BIDDING && bidRecommendation
        ? `Dây "${circle.name}" có mức rủi ro ${riskLevel} (${riskScore}/100). Với mức bid tối đa đang dẫn là ${bidRecommendation.currentHighestBidUsdc} mUSDC, mức đấu giá hợp lý khoảng ${bidRecommendation.optimalBidUsdc} mUSDC (chiết khấu ${bidRecommendation.suggestedEffectiveApyPct}% pot).`
        : `Dây "${circle.name}" có mức rủi ro ${riskLevel} (${riskScore}/100) với cơ chế xoay vòng cố định và tỷ lệ bảo chứng ${collateralRatio}x.`;

    const llmSummary = await this.tryGenerateGeminiSummary(
      circle.name,
      fallbackSummary,
      highlights,
    );

    const configuredModel = process.env.AI_MODEL?.trim() || 'gemini-2.5-flash';

    return {
      circleId: circle.id,
      riskScore,
      riskLevel,
      collateralRatio,
      estimatedCycleYieldUsdc,
      bidRecommendation,
      highlights,
      summary: llmSummary || fallbackSummary,
      aiPowered: Boolean(llmSummary),
      model: llmSummary ? configuredModel : 'deterministic-risk-engine-v1',
    };
  }

  private async tryGenerateGeminiSummary(
    circleName: string,
    quantitativeBrief: string,
    highlights: string[],
  ): Promise<string | null> {
    const enabled = String(process.env.AI_ENABLED ?? 'false').toLowerCase() === 'true';
    const apiKey = process.env.AI_API_KEY?.trim();
    if (!enabled || !apiKey) {
      return null;
    }

    const model = process.env.AI_MODEL?.trim() || 'gemini-2.5-flash';
    const prompt = [
      `Bạn là cố vấn rủi ro DeFi cho nền tảng hụi on-chain AvaHui trên Avalanche.`,
      `Hãy viết đúng 2 câu ngắn gọn bằng tiếng Việt đưa ra nhận xét thực tế cho dây "${circleName}" dựa trên số liệu sau:`,
      quantitativeBrief,
      ...highlights,
    ].join('\n');

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
          signal: AbortSignal.timeout(4000),
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || null;
    } catch (err) {
      this.logger.debug(`Gemini advisor fallback: ${(err as Error).message}`);
      return null;
    }
  }
}

