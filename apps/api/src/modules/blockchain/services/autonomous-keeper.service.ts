import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CircleStatus, RoundStatus } from '@prisma/client';
import { createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AVALANCHE_FUJI_CHAIN, AvaHuiCircleABI } from '@avahui/blockchain';
import { PrismaService } from '../../../database/prisma.service';
import { createFujiRpcTransport } from '../../../common/utils/rpc.util';

/**
 * AutonomousKeeperService — Policy-Enforced Server Agent Wallet Keeper
 * Monitors active ROSCA rounds and autonomously dispatches `settleRound()`
 * on Avalanche Fuji when bidding/grace deadlines expire.
 */
@Injectable()
export class AutonomousKeeperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutonomousKeeperService.name);
  private keeperTimer: NodeJS.Timeout | null = null;
  private isExecuting = false;

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
}
