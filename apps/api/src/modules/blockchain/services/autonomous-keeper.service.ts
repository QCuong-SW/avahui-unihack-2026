import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AllocationMode, CircleStatus, RoundStatus } from '@prisma/client';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AVALANCHE_FUJI_CHAIN, AvaHuiCircleABI } from '@avahui/blockchain';
import { PrismaService } from '../../../database/prisma.service';
import { createFujiRpcTransport } from '../../../common/utils/rpc.util';

/**
 * AutonomousKeeperService — Policy-Enforced Server Agent Wallet Keeper
 * Monitors active ROSCA rounds, sends idempotent deadline reminders, and
 * autonomously dispatches `settleRound()` on Avalanche Fuji when grace deadlines expire.
 */
@Injectable()
export class AutonomousKeeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutonomousKeeperService.name);
  private keeperTimer: NodeJS.Timeout | null = null;
  private isExecuting = false;
  private isReminding = false;

  private readonly rpcUrl =
    process.env.AVALANCHE_RPC_URL || 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
  private readonly keeperIntervalMs = Number(
    process.env.KEEPER_POLL_INTERVAL_MS || 4000,
  );

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const enabled =
      String(process.env.KEEPER_ENABLED ?? 'true').toLowerCase() === 'true';
    if (!enabled) {
      this.logger.log('Autonomous Agent Keeper is disabled via KEEPER_ENABLED=false');
      return;
    }

    this.logger.log(
      `Autonomous Settlement Keeper initialized (interval=${this.keeperIntervalMs}ms)`,
    );

    this.keeperTimer = setInterval(() => {
      this.sendDeadlineReminders().catch((err) =>
        this.logger.debug(`Deadline reminder skipped: ${(err as Error).message}`),
      );
      this.scanAndSettleExpiredRounds().catch((err) =>
        this.logger.debug(`Keeper scan skipped: ${(err as Error).message}`),
      );
    }, this.keeperIntervalMs);
  }

  onModuleDestroy() {
    if (this.keeperTimer) {
      clearInterval(this.keeperTimer);
      this.keeperTimer = null;
    }
  }

  async scanAndSettleExpiredRounds(): Promise<number> {
    if (this.isExecuting) return 0;
    this.isExecuting = true;
    let settledCount = 0;

    try {
      const now = new Date();
      const expiredOpenRounds = await this.prisma.round.findMany({
        where: {
          status: RoundStatus.OPEN,
          graceDeadline: { lte: now },
          circle: {
            status: CircleStatus.ACTIVE,
            contractAddress: { not: null },
          },
        },
        include: {
          circle: true,
        },
        take: 10,
      });

      const keeperPrivateKey = process.env.KEEPER_PRIVATE_KEY as `0x${string}` | undefined;
      if (!keeperPrivateKey || !keeperPrivateKey.startsWith('0x') || keeperPrivateKey.length !== 66) {
        return 0;
      }

      const account = privateKeyToAccount(keeperPrivateKey);
      const walletClient = createWalletClient({
        account,
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: createFujiRpcTransport(this.rpcUrl),
      });

      for (const round of expiredOpenRounds) {
        const contractAddress = round.circle.contractAddress as `0x${string}`;
        try {
          const txHash = await walletClient.writeContract({
            address: contractAddress,
            abi: AvaHuiCircleABI,
            functionName: 'settleRound',
            args: [round.roundNumber],
            account,
            chain: null,
          });
          settledCount++;
          this.logger.log(
            `[AgentKeeper] Autonomously triggered settleRound(#${round.roundNumber}) on ${contractAddress} -> tx=${txHash}`,
          );
        } catch (err) {
          this.logger.debug(
            `[AgentKeeper] Could not auto-settle round #${round.roundNumber} on ${contractAddress}: ${(err as Error).message}`,
          );
        }
      }

      return settledCount;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Checks open rounds nearing contribution or bidding deadlines and emits at most one
   * in-app reminder per pending member per round (plus optional ALERT_WEBHOOK_URL).
   */
  async sendDeadlineReminders(nowInput = new Date()): Promise<number> {
    if (this.isReminding) return 0;
    this.isReminding = true;
    let sentCount = 0;

    try {
      const openRounds = await this.prisma.round.findMany({
        where: {
          status: RoundStatus.OPEN,
          circle: { status: CircleStatus.ACTIVE },
        },
        include: {
          circle: {
            include: {
              members: {
                where: { userId: { not: null } },
                select: {
                  userId: true,
                  memberAddress: true,
                  hasReceivedPayout: true,
                },
              },
            },
          },
          contributions: { select: { memberAddress: true } },
          bids: { select: { bidderAddress: true } },
        },
        take: 25,
      });

      const nowMs = nowInput.getTime();
      for (const round of openRounds) {
        const contribThresholdMs =
          Math.max(15, Math.floor((round.circle.roundDurationSeconds || 300) * 0.2)) * 1000;
        const contribLeftMs = round.contributionDeadline
          ? round.contributionDeadline.getTime() - nowMs
          : -1;

        if (contribLeftMs > 0 && contribLeftMs <= contribThresholdMs) {
          const paidSet = new Set(
            round.contributions.map((c) => c.memberAddress.toLowerCase()),
          );
          const pendingMembers = round.circle.members.filter(
            (m) => m.userId && !paidSet.has(m.memberAddress.toLowerCase()),
          );
          const minsOrSecs =
            contribLeftMs >= 60_000
              ? `${Math.ceil(contribLeftMs / 60_000)} phút`
              : `${Math.ceil(contribLeftMs / 1000)} giây`;
          sentCount += await this.dispatchUniqueRoundNotifications({
            circleId: round.circleId,
            title: `Nhắc hạn đóng tiền Vòng #${round.roundNumber}`,
            body: `Dây "${round.circle.name}" còn khoảng ${minsOrSecs} trước hạn đóng tiền. Đóng đúng hạn để tránh bị trích thế chấp.`,
            userIds: pendingMembers.map((m) => m.userId!),
          });
        }

        const isBidding = round.circle.allocationMode === AllocationMode.BIDDING;
        const bidThresholdMs =
          Math.max(15, Math.floor((round.circle.biddingDurationSeconds || 120) * 0.25)) * 1000;
        const bidLeftMs = round.biddingDeadline
          ? round.biddingDeadline.getTime() - nowMs
          : -1;

        if (isBidding && bidLeftMs > 0 && bidLeftMs <= bidThresholdMs) {
          const bidderSet = new Set(
            round.bids.map((b) => b.bidderAddress.toLowerCase()),
          );
          const eligibleUnbid = round.circle.members.filter(
            (m) =>
              m.userId &&
              !m.hasReceivedPayout &&
              !bidderSet.has(m.memberAddress.toLowerCase()),
          );
          const minsOrSecs =
            bidLeftMs >= 60_000
              ? `${Math.ceil(bidLeftMs / 60_000)} phút`
              : `${Math.ceil(bidLeftMs / 1000)} giây`;
          sentCount += await this.dispatchUniqueRoundNotifications({
            circleId: round.circleId,
            title: `Sắp hết giờ bỏ thăm Vòng #${round.roundNumber}`,
            body: `Dây "${round.circle.name}" còn khoảng ${minsOrSecs} để gửi hoặc mở thăm kín (Reveal Bid).`,
            userIds: eligibleUnbid.map((m) => m.userId!),
          });
        }
      }

      return sentCount;
    } finally {
      this.isReminding = false;
    }
  }

  private async dispatchUniqueRoundNotifications(input: {
    circleId: string;
    title: string;
    body: string;
    userIds: string[];
  }): Promise<number> {
    if (input.userIds.length === 0) return 0;

    const existing = await this.prisma.notification.findMany({
      where: {
        circleId: input.circleId,
        title: input.title,
        userId: { in: input.userIds },
      },
      select: { userId: true },
    });
    const alreadySent = new Set(existing.map((n) => n.userId));
    const recipients = input.userIds.filter((uid) => !alreadySent.has(uid));
    if (recipients.length === 0) return 0;

    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        circleId: input.circleId,
        title: input.title,
        body: input.body,
      })),
    });

    await this.postAlertWebhook(`[${input.title}] ${input.body}`);
    return recipients.length;
  }

  private async postAlertWebhook(message: string): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, content: message }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Optional best-effort webhook
    }
  }
}
