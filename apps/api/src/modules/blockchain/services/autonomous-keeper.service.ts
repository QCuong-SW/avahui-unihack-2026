import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CircleStatus, RoundStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface KeeperCheckResult {
  checkedAt: string;
  expiredOpenRoundsCount: number;
  autoSettledRoundIds: string[];
}

@Injectable()
export class AutonomousKeeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutonomousKeeperService.name);
  private keeperTimer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const enabled = process.env.KEEPER_ENABLED !== 'false';
    if (!enabled || process.env.NODE_ENV === 'test') {
      return;
    }

    const intervalMs = Number(process.env.KEEPER_INTERVAL_MS || 15000);
    this.keeperTimer = setInterval(() => {
      this.checkAndSettleExpiredRounds().catch((err) => {
        this.logger.warn(`Keeper check failed: ${err?.message || err}`);
      });
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.keeperTimer) {
      clearInterval(this.keeperTimer);
      this.keeperTimer = null;
    }
  }

  /**
   * Scans active circles for open rounds whose graceDeadline or biddingDeadline has passed,
   * and logs/notifies autonomous settlement readiness.
   */
  async checkAndSettleExpiredRounds(circleId?: string): Promise<KeeperCheckResult> {
    const now = new Date();
    const expiredRounds = await this.prisma.round.findMany({
      where: {
        ...(circleId ? { circleId } : {}),
        status: RoundStatus.OPEN,
        circle: {
          status: CircleStatus.ACTIVE,
        },
        OR: [
          { graceDeadline: { lte: now } },
          {
            graceDeadline: null,
            contributionDeadline: { lte: now },
          },
        ],
      },
      include: {
        circle: true,
      },
    });

    const settledIds: string[] = [];
    for (const round of expiredRounds) {
      settledIds.push(round.id);
      this.logger.log(
        `[AutonomousKeeper] Round #${round.roundNumber} of circle "${round.circle.name}" (${round.circle.contractAddress}) is ready for autonomous settlement.`,
      );
    }

    return {
      checkedAt: now.toISOString(),
      expiredOpenRoundsCount: expiredRounds.length,
      autoSettledRoundIds: settledIds,
    };
  }
}

