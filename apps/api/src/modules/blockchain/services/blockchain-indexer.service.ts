import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AllocationMode,
  CircleStatus,
  MemberStatus,
  Prisma,
  RoundStatus,
  TxStatus,
  TxType,
} from '@prisma/client';
import {
  createPublicClient,
  decodeEventLog,
  http,
} from 'viem';
import {
  AVALANCHE_FUJI_CHAIN,
  AvaHuiCircleABI,
  AvaHuiFactoryABI,
} from '@avahui/blockchain';
import { PrismaService } from '../../../database/prisma.service';
import { formatUsdcUnits, normalizeAddress } from '../../../common/utils/format.util';

export interface IndexedEventInput {
  chainId: number;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockTimestamp: Date;
  contractAddress: string;
  eventName: string;
  args: Record<string, any>;
}

const MAX_BLOCK_RANGE = 2000n;

@Injectable()
export class BlockchainIndexerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlockchainIndexerService.name);
  private publicClient: any;
  private pollTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  private readonly chainId = Number(process.env.CHAIN_ID || 43113);
  private readonly rpcUrl =
    process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';
  private readonly factoryAddress = normalizeAddress(
    process.env.ROSCA_FACTORY_ADDRESS || '',
  );
  private readonly pollIntervalMs = Number(
    process.env.INDEXER_POLL_INTERVAL_MS || 3000,
  );
  private readonly confirmationBlocks = BigInt(
    process.env.INDEXER_CONFIRMATION_BLOCKS ?? 2,
  );

  constructor(private readonly prisma: PrismaService) {
    this.publicClient = createPublicClient({
      chain: AVALANCHE_FUJI_CHAIN as any,
      transport: http(this.rpcUrl),
    });
  }

  onModuleInit() {
    const enabled =
      String(process.env.INDEXER_ENABLED ?? 'true').toLowerCase() === 'true';
    const hasValidFactory =
      this.factoryAddress &&
      this.factoryAddress !== '0x0000000000000000000000000000000000000000';

    if (!enabled || !hasValidFactory) {
      this.logger.log(
        `Blockchain Indexer polling idle (INDEXER_ENABLED=${enabled}, factory=${this.factoryAddress || 'none'})`,
      );
      return;
    }

    this.logger.log(
      `Starting Avalanche Event Indexer on chain ${this.chainId} every ${this.pollIntervalMs}ms (factory=${this.factoryAddress})`,
    );

    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((err) =>
        this.logger.warn(`Indexer poll error: ${(err as Error).message}`),
      );
    }, this.pollIntervalMs);
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async pollOnce(): Promise<number> {
    if (this.isSyncing) return 0;
    this.isSyncing = true;
    let processedCount = 0;

    try {
      const latestBlock = await this.publicClient.getBlockNumber();
      const safeTargetBlock =
        latestBlock > this.confirmationBlocks
          ? latestBlock - this.confirmationBlocks
          : latestBlock;

      let state = await this.prisma.indexerState.findUnique({
        where: { chainId: this.chainId },
      });

      if (!state) {
        const startBlockEnv = BigInt(process.env.INDEXER_START_BLOCK || 0);
        const isLocalRpc =
          this.rpcUrl.includes('127.0.0.1') || this.rpcUrl.includes('localhost');
        const initialBlock =
          startBlockEnv > 0n
            ? startBlockEnv - 1n
            : isLocalRpc
              ? 0n
              : safeTargetBlock;
        state = await this.prisma.indexerState.create({
          data: {
            chainId: this.chainId,
            lastProcessedBlock: initialBlock,
          },
        });
      }

      if (safeTargetBlock <= state.lastProcessedBlock) {
        return 0;
      }

      const fromBlock = state.lastProcessedBlock + 1n;
      const toBlock =
        fromBlock + MAX_BLOCK_RANGE - 1n < safeTargetBlock
          ? fromBlock + MAX_BLOCK_RANGE - 1n
          : safeTargetBlock;

      const knownCircles = await this.prisma.circle.findMany({
        where: { contractAddress: { not: null } },
        select: { contractAddress: true },
      });

      const targetAddresses = Array.from(
        new Set([
          ...(this.factoryAddress &&
          this.factoryAddress !== '0x0000000000000000000000000000000000000000'
            ? [this.factoryAddress as `0x${string}`]
            : []),
          ...knownCircles
            .map((c) => normalizeAddress(c.contractAddress))
            .filter(Boolean)
            .map((a) => a as `0x${string}`),
        ]),
      );

      if (targetAddresses.length > 0) {
        const logs = await this.publicClient.getLogs({
          address: targetAddresses,
          fromBlock,
          toBlock,
        });

        const newlyCreatedCircles: `0x${string}`[] = [];
        for (const rawLog of logs) {
          const decoded = this.tryDecodeLog(rawLog);
          if (!decoded) continue;

          if (decoded.eventName === 'CircleCreated' && decoded.args?.circleAddress) {
            const addr = normalizeAddress(decoded.args.circleAddress) as `0x${string}`;
            if (!targetAddresses.includes(addr)) {
              newlyCreatedCircles.push(addr);
            }
          }

          const didProcess = await this.processDecodedEvent({
            chainId: this.chainId,
            txHash: normalizeAddress(rawLog.transactionHash || ''),
            logIndex: Number(rawLog.logIndex ?? 0),
            blockNumber: BigInt(rawLog.blockNumber ?? fromBlock),
            blockTimestamp: new Date(),
            contractAddress: normalizeAddress(rawLog.address),
            eventName: decoded.eventName,
            args: decoded.args,
          });
          if (didProcess) processedCount++;
        }

        // Catch same-batch events emitted by circles deployed in this block window
        if (newlyCreatedCircles.length > 0) {
          const extraLogs = await this.publicClient.getLogs({
            address: newlyCreatedCircles,
            fromBlock,
            toBlock,
          });
          for (const rawLog of extraLogs) {
            const decoded = this.tryDecodeLog(rawLog);
            if (!decoded) continue;

            const didProcess = await this.processDecodedEvent({
              chainId: this.chainId,
              txHash: normalizeAddress(rawLog.transactionHash || ''),
              logIndex: Number(rawLog.logIndex ?? 0),
              blockNumber: BigInt(rawLog.blockNumber ?? fromBlock),
              blockTimestamp: new Date(),
              contractAddress: normalizeAddress(rawLog.address),
              eventName: decoded.eventName,
              args: decoded.args,
            });
            if (didProcess) processedCount++;
          }
        }
      }

      await this.prisma.indexerState.update({
        where: { chainId: this.chainId },
        data: { lastProcessedBlock: toBlock },
      });

      return processedCount;
    } finally {
      this.isSyncing = false;
    }
  }

  private tryDecodeLog(
    rawLog: any,
  ): { eventName: string; args: Record<string, any> } | null {
    const combinedAbi = [...AvaHuiFactoryABI, ...AvaHuiCircleABI];
    try {
      const decoded: any = decodeEventLog({
        abi: combinedAbi,
        data: rawLog.data,
        topics: rawLog.topics,
      });
      return {
        eventName: String(decoded.eventName),
        args: (decoded.args || {}) as Record<string, any>,
      };
    } catch {
      return null;
    }
  }

  /**
   * Idempotently processes a single decoded Smart Contract event inside a Prisma transaction.
   * Guaranteed by UNIQUE (chain_id, tx_hash, log_index) on `blockchain_events`.
   */
  async processDecodedEvent(event: IndexedEventInput): Promise<boolean> {
    const txHash = normalizeAddress(event.txHash);
    const contractAddress = normalizeAddress(event.contractAddress);

    const existingEvent = await this.prisma.blockchainEvent.findUnique({
      where: {
        chainId_txHash_logIndex: {
          chainId: event.chainId,
          txHash,
          logIndex: event.logIndex,
        },
      },
    });

    if (existingEvent) {
      return false;
    }

    const serializedPayload = JSON.parse(
      JSON.stringify(event.args, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.blockchainEvent.create({
        data: {
          chainId: event.chainId,
          txHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          blockTimestamp: event.blockTimestamp,
          contractAddress,
          eventName: event.eventName,
          payload: serializedPayload,
          processed: true,
        },
      });

      switch (event.eventName) {
        case 'CircleCreated':
          await this.handleCircleCreated(tx, event, txHash);
          break;
        case 'MemberJoined':
          await this.handleMemberJoined(tx, event, txHash);
          break;
        case 'CircleActivated':
          await this.handleCircleActivated(tx, event);
          break;
        case 'ContributionMade':
          await this.handleContributionMade(tx, event, txHash);
          break;
        case 'BidSubmitted':
          await this.handleBidSubmitted(tx, event, txHash);
          break;
        case 'BidCommitted':
          await this.handleBidCommitted(tx, event, txHash);
          break;
        case 'BidRevealed':
          await this.handleBidRevealed(tx, event, txHash);
          break;
        case 'YieldHarvested':
          await this.handleYieldHarvested(tx, event);
          break;
        case 'SybilAttestationVerified':
          await this.handleSybilAttestationVerified(tx, event, txHash);
          break;
        case 'CollateralSlashed':
          await this.handleCollateralSlashed(tx, event, txHash);
          break;
        case 'RoundSettled':
          await this.handleRoundSettled(tx, event, txHash);
          break;
        case 'CircleCompleted':
          await this.handleCircleCompleted(tx, event);
          break;
        case 'CollateralWithdrawn':
          await this.handleCollateralWithdrawn(tx, event, txHash);
          break;
        case 'CircleCancelled':
          await this.handleCircleCancelled(tx, event, txHash);
          break;
      }
    });

    this.logger.log(
      `Indexed event ${event.eventName} (tx=${txHash.slice(0, 10)}..., logIndex=${event.logIndex})`,
    );
    return true;
  }

  private async handleCircleCreated(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress);
    const creatorAddress = normalizeAddress(args.creator);
    const tokenAddress = normalizeAddress(args.token);
    const metadataId = String(args.metadataId || `meta_${circleAddress.slice(2, 12)}`);
    const allocationMode =
      Number(args.allocationMode) === 1
        ? AllocationMode.BIDDING
        : AllocationMode.FIXED;
    const maxMembers = Number(args.maxMembers || 5);
    const contributionAmount = String(args.contributionAmount || '0');
    const collateralAmount = String(args.collateralAmount || '0');

    let onChainInviteHash: string | null = null;
    let onChainRequireAttestation = false;
    if (
      !process.env.JEST_WORKER_ID &&
      this.publicClient &&
      typeof this.publicClient.readContract === 'function'
    ) {
      try {
        const [inviteHashRaw, requireAttestRaw] = await Promise.all([
          this.publicClient.readContract({
            address: circleAddress as `0x${string}`,
            abi: AvaHuiCircleABI,
            functionName: 'inviteCodeHash',
          }),
          this.publicClient.readContract({
            address: circleAddress as `0x${string}`,
            abi: AvaHuiCircleABI,
            functionName: 'requireAttestation',
          }),
        ]);
        const normalizedHash = String(inviteHashRaw || '').toLowerCase();
        if (
          normalizedHash &&
          normalizedHash !==
            '0x0000000000000000000000000000000000000000000000000000000000000000'
        ) {
          onChainInviteHash = normalizedHash;
        }
        onChainRequireAttestation = Boolean(requireAttestRaw);
      } catch {
        // Ignore when offline or in unit tests without live RPC
      }
    }

    const circle = await tx.circle.upsert({
      where: { metadataId },
      update: {
        contractAddress: circleAddress,
        status: CircleStatus.RECRUITING,
        creationTxHash: txHash,
        ...(onChainInviteHash
          ? { isPrivateInvite: true, inviteCodeHash: onChainInviteHash }
          : {}),
        ...(onChainRequireAttestation ? { requireTeam1Attestation: true } : {}),
      },
      create: {
        metadataId,
        contractAddress: circleAddress,
        chainId: event.chainId,
        name: String(args.name || 'AvaHui Circle'),
        creatorAddress,
        tokenAddress,
        allocationMode,
        status: CircleStatus.RECRUITING,
        maxMembers,
        currentMemberCount: 0,
        currentRound: 0,
        totalRounds: maxMembers,
        contributionAmount,
        collateralAmount,
        totalDiscountPool: '0',
        roundDurationSeconds: 300,
        biddingDurationSeconds: allocationMode === AllocationMode.BIDDING ? 180 : 0,
        gracePeriodSeconds: 60,
        startDeadline: new Date(Date.now() + 7 * 86400 * 1000),
        isPrivateInvite: Boolean(onChainInviteHash),
        inviteCodeHash: onChainInviteHash,
        requireTeam1Attestation: onChainRequireAttestation,
        creationTxHash: txHash,
      },
    });

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      creatorAddress,
      circleAddress,
      circle.id,
      TxType.CREATE_CIRCLE,
    );
  }

  private async handleMemberJoined(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const memberAddress = normalizeAddress(args.member);
    const slotIndex = Number(args.slotIndex);
    const collateralLocked = String(args.collateralLocked || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const wallet = await tx.wallet.findUnique({
      where: { address: memberAddress },
    });

    const member = await tx.circleMember.upsert({
      where: {
        circleId_memberAddress: {
          circleId: circle.id,
          memberAddress,
        },
      },
      update: {
        slotIndex,
        userId: wallet?.userId ?? null,
      },
      create: {
        circleId: circle.id,
        userId: wallet?.userId ?? null,
        memberAddress,
        slotIndex,
        status: MemberStatus.ACTIVE,
        joinTxHash: txHash,
        joinedAt: event.blockTimestamp,
      },
    });

    await tx.collateral.upsert({
      where: { memberId: member.id },
      update: {
        initialLockedAmount: collateralLocked,
        currentLockedAmount: collateralLocked,
      },
      create: {
        circleId: circle.id,
        memberId: member.id,
        memberAddress,
        initialLockedAmount: collateralLocked,
        currentLockedAmount: collateralLocked,
      },
    });

    const memberCount = await tx.circleMember.count({
      where: { circleId: circle.id },
    });

    await tx.circle.update({
      where: { id: circle.id },
      data: {
        currentMemberCount: Math.max(circle.currentMemberCount, slotIndex, memberCount),
      },
    });

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      memberAddress,
      circleAddress,
      circle.id,
      TxType.JOIN_CIRCLE,
    );
  }

  private async handleCircleActivated(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const startTimeSec = Number(args.startTime || Math.floor(Date.now() / 1000));
    const currentRound = Number(args.currentRound || 1);
    const contribDeadlineSec = Number(args.contributionDeadline || startTimeSec + 300);
    const biddingDeadlineSec = Number(args.biddingDeadline || startTimeSec + 180);

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
      include: { members: true },
    });
    if (!circle) return;

    const startTime = new Date(startTimeSec * 1000);
    const contributionDeadline = new Date(contribDeadlineSec * 1000);
    const biddingDeadline = new Date(biddingDeadlineSec * 1000);
    const graceDeadline = new Date(
      (contribDeadlineSec + circle.gracePeriodSeconds) * 1000,
    );
    const grossPot = (
      BigInt(circle.maxMembers) * BigInt(circle.contributionAmount.toString())
    ).toString();

    await tx.circle.update({
      where: { id: circle.id },
      data: {
        status: CircleStatus.ACTIVE,
        currentRound,
        activatedAt: startTime,
      },
    });

    for (let r = 1; r <= circle.maxMembers; r++) {
      const isFirst = r === currentRound;
      await tx.round.upsert({
        where: {
          circleId_roundNumber: {
            circleId: circle.id,
            roundNumber: r,
          },
        },
        update: isFirst
          ? {
              status: RoundStatus.OPEN,
              startTime,
              contributionDeadline,
              biddingDeadline,
              graceDeadline,
              grossPotAmount: grossPot,
            }
          : {},
        create: {
          circleId: circle.id,
          roundNumber: r,
          status: isFirst ? RoundStatus.OPEN : RoundStatus.PENDING,
          startTime: isFirst ? startTime : null,
          contributionDeadline: isFirst ? contributionDeadline : null,
          biddingDeadline: isFirst ? biddingDeadline : null,
          graceDeadline: isFirst ? graceDeadline : null,
          grossPotAmount: grossPot,
        },
      });
    }

    await this.notifyCircleMembers(
      tx,
      circle.id,
      `Dây hụi "${circle.name}" đã kích hoạt!`,
      `Đủ ${circle.maxMembers} thành viên tham gia. Vòng #1 đã chính thức mở đóng tiền.`,
    );
  }

  private async handleContributionMade(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const roundNumber = Number(args.roundNumber);
    const memberAddress = normalizeAddress(args.member);
    const amount = String(args.amount || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const round = await this.ensureRoundExists(tx, circle, roundNumber);

    await tx.contribution.upsert({
      where: {
        circleId_roundNumber_memberAddress: {
          circleId: circle.id,
          roundNumber,
          memberAddress,
        },
      },
      update: {
        amount,
        txHash,
        isFromCollateralSlash: false,
      },
      create: {
        circleId: circle.id,
        roundId: round.id,
        roundNumber,
        memberAddress,
        amount,
        isFromCollateralSlash: false,
        txHash,
        contributedAt: event.blockTimestamp,
      },
    });

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      memberAddress,
      circleAddress,
      circle.id,
      TxType.CONTRIBUTE,
    );
  }

  private async handleBidSubmitted(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const roundNumber = Number(args.roundNumber);
    const bidderAddress = normalizeAddress(args.bidder);
    const bidAmount = String(args.bidAmount || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const round = await this.ensureRoundExists(tx, circle, roundNumber);

    const existingBid = await tx.bid.findFirst({
      where: {
        roundId: round.id,
        bidderAddress,
        bidAmount,
      },
    });

    if (!existingBid) {
      await tx.bid.create({
        data: {
          circleId: circle.id,
          roundId: round.id,
          roundNumber,
          bidderAddress,
          bidAmount,
          isWinningBid: false,
          txHash,
          placedAt: event.blockTimestamp,
        },
      });
    }

    const currentTopBid = BigInt(
      round.winningBidAmount ? round.winningBidAmount.toString() : '0',
    );
    if (BigInt(bidAmount) > currentTopBid) {
      const grossPot = BigInt(circle.maxMembers) * BigInt(circle.contributionAmount.toString());
      const netPayout = grossPot - BigInt(bidAmount);

      await tx.round.update({
        where: { id: round.id },
        data: {
          winningBidAmount: bidAmount,
          netPayoutAmount: netPayout.toString(),
        },
      });
    }

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      bidderAddress,
      circleAddress,
      circle.id,
      TxType.PLACE_BID,
    );
  }

  private async handleCollateralSlashed(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const roundNumber = Number(args.roundNumber);
    const defaultedMember = normalizeAddress(args.defaultedMember);
    const slashedAmount = String(args.slashedAmount || '0');
    const remainingCollateral = String(args.remainingCollateral || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const round = await this.ensureRoundExists(tx, circle, roundNumber);

    const member = await tx.circleMember.findUnique({
      where: {
        circleId_memberAddress: {
          circleId: circle.id,
          memberAddress: defaultedMember,
        },
      },
      include: { collateral: true },
    });

    if (member) {
      await tx.circleMember.update({
        where: { id: member.id },
        data: {
          defaultCount: { increment: 1 },
          status: MemberStatus.DEFAULTED,
        },
      });

      if (member.collateral) {
        const prevSlashed = BigInt(member.collateral.totalSlashedAmount.toString());
        await tx.collateral.update({
          where: { id: member.collateral.id },
          data: {
            currentLockedAmount: remainingCollateral,
            totalSlashedAmount: (prevSlashed + BigInt(slashedAmount)).toString(),
          },
        });
      }

      if (member.userId) {
        await tx.notification.create({
          data: {
            userId: member.userId,
            circleId: circle.id,
            title: `Trừ thế chấp tự động Vòng #${roundNumber}`,
            body: `Bạn đã quá hạn đóng tiền Vòng #${roundNumber} trong "${circle.name}". Smart Contract đã trích ${formatUsdcUnits(slashedAmount)} mUSDC từ thế chấp để bảo vệ quỹ.`,
          },
        });
      }
    }

    await tx.contribution.upsert({
      where: {
        circleId_roundNumber_memberAddress: {
          circleId: circle.id,
          roundNumber,
          memberAddress: defaultedMember,
        },
      },
      update: {
        amount: slashedAmount,
        isFromCollateralSlash: true,
        txHash,
      },
      create: {
        circleId: circle.id,
        roundId: round.id,
        roundNumber,
        memberAddress: defaultedMember,
        amount: slashedAmount,
        isFromCollateralSlash: true,
        txHash,
        contributedAt: event.blockTimestamp,
      },
    });
  }

  private async handleRoundSettled(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const roundNumber = Number(args.roundNumber);
    const recipient = normalizeAddress(args.recipient);
    const grossPotAmount = String(args.grossPotAmount || '0');
    const winningBidAmount = String(args.winningBidAmount || '0');
    const netPayoutAmount = String(args.netPayoutAmount || '0');
    const nextRoundNumber = Number(args.nextRoundNumber || 0);

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const round = await this.ensureRoundExists(tx, circle, roundNumber);

    await tx.round.update({
      where: { id: round.id },
      data: {
        status: RoundStatus.SETTLED,
        winnerAddress: recipient,
        grossPotAmount,
        winningBidAmount,
        netPayoutAmount,
        settledAt: event.blockTimestamp,
        settlementTxHash: txHash,
      },
    });

    // Mark winning bid if any
    if (BigInt(winningBidAmount) > 0n) {
      const topBid = await tx.bid.findFirst({
        where: {
          roundId: round.id,
          bidderAddress: recipient,
          bidAmount: winningBidAmount,
        },
      });
      if (topBid) {
        await tx.bid.update({
          where: { id: topBid.id },
          data: { isWinningBid: true },
        });
      }
    }

    await tx.payout.upsert({
      where: { roundId: round.id },
      update: {
        recipientAddress: recipient,
        grossAmount: grossPotAmount,
        discountAmount: winningBidAmount,
        netAmount: netPayoutAmount,
        txHash,
      },
      create: {
        circleId: circle.id,
        roundId: round.id,
        roundNumber,
        recipientAddress: recipient,
        grossAmount: grossPotAmount,
        discountAmount: winningBidAmount,
        netAmount: netPayoutAmount,
        txHash,
        paidAt: event.blockTimestamp,
      },
    });

    await tx.circleMember.updateMany({
      where: { circleId: circle.id, memberAddress: recipient },
      data: {
        hasReceivedPayout: true,
        wonRoundNumber: roundNumber,
      },
    });

    const currentDiscountPool = circle.totalDiscountPool
      ? circle.totalDiscountPool.toString()
      : '0';
    const newDiscountPool = (
      BigInt(currentDiscountPool) + BigInt(winningBidAmount)
    ).toString();

    await tx.circle.update({
      where: { id: circle.id },
      data: {
        totalDiscountPool: newDiscountPool,
        ...(nextRoundNumber > 0 ? { currentRound: nextRoundNumber } : {}),
      },
    });

    if (nextRoundNumber > 0) {
      const nextStart = event.blockTimestamp;
      const nextContribDeadline = new Date(
        nextStart.getTime() + circle.roundDurationSeconds * 1000,
      );
      const nextBiddingDeadline = new Date(
        nextStart.getTime() + circle.biddingDurationSeconds * 1000,
      );
      const nextGraceDeadline = new Date(
        nextContribDeadline.getTime() + circle.gracePeriodSeconds * 1000,
      );

      await tx.round.upsert({
        where: {
          circleId_roundNumber: {
            circleId: circle.id,
            roundNumber: nextRoundNumber,
          },
        },
        update: {
          status: RoundStatus.OPEN,
          startTime: nextStart,
          contributionDeadline: nextContribDeadline,
          biddingDeadline: nextBiddingDeadline,
          graceDeadline: nextGraceDeadline,
          grossPotAmount,
        },
        create: {
          circleId: circle.id,
          roundNumber: nextRoundNumber,
          status: RoundStatus.OPEN,
          startTime: nextStart,
          contributionDeadline: nextContribDeadline,
          biddingDeadline: nextBiddingDeadline,
          graceDeadline: nextGraceDeadline,
          grossPotAmount,
        },
      });
    }

    await this.notifyCircleMembers(
      tx,
      circle.id,
      `Kết toán Vòng #${roundNumber} — "${circle.name}"`,
      `Thành viên ${recipient.slice(0, 6)}...${recipient.slice(-4)} đã nhận Payout ${formatUsdcUnits(netPayoutAmount)} mUSDC.`,
    );

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      recipient,
      circleAddress,
      circle.id,
      TxType.SETTLE_ROUND,
    );
  }

  private async handleCircleCompleted(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const totalDiscountPool = String(args.totalDiscountPool || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    await tx.circle.update({
      where: { id: circle.id },
      data: {
        status: CircleStatus.COMPLETED,
        totalDiscountPool,
        completedAt: event.blockTimestamp,
      },
    });

    await this.notifyCircleMembers(
      tx,
      circle.id,
      `Dây hụi "${circle.name}" đã hoàn tất!`,
      `Toàn bộ ${circle.maxMembers} vòng đã kết thúc. Bạn có thể bấm Rút Thế Chấp & Tiền Thưởng ngay bây giờ.`,
    );
  }

  private async handleCollateralWithdrawn(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const memberAddress = normalizeAddress(args.member);
    const collateralReturned = String(args.collateralReturned || '0');
    const discountBonusReturned = String(args.discountBonusReturned || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const member = await tx.circleMember.findUnique({
      where: {
        circleId_memberAddress: {
          circleId: circle.id,
          memberAddress,
        },
      },
      include: { collateral: true },
    });

    if (member) {
      await tx.circleMember.update({
        where: { id: member.id },
        data: { status: MemberStatus.WITHDRAWN },
      });

      if (member.collateral) {
        await tx.collateral.update({
          where: { id: member.collateral.id },
          data: {
            currentLockedAmount: '0',
            withdrawnAmount: collateralReturned,
            discountBonusClaimed: discountBonusReturned,
            isWithdrawn: true,
            withdrawTxHash: txHash,
          },
        });
      }
    }

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      memberAddress,
      circleAddress,
      circle.id,
      TxType.WITHDRAW_COLLATERAL,
    );
  }

  private async handleCircleCancelled(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    await tx.circle.update({
      where: { id: circle.id },
      data: { status: CircleStatus.CANCELLED },
    });

    await this.notifyCircleMembers(
      tx,
      circle.id,
      `Dây hụi "${circle.name}" đã hủy do quá hạn gom người`,
      `Bạn có thể rút lại 100% tiền thế chấp từ Smart Contract.`,
    );

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      circle.creatorAddress,
      circleAddress,
      circle.id,
      TxType.CANCEL_CIRCLE,
    );
  }

  private async ensureRoundExists(
    tx: Prisma.TransactionClient,
    circle: { id: string; maxMembers: number; contributionAmount: Prisma.Decimal },
    roundNumber: number,
  ) {
    const grossPot = (
      BigInt(circle.maxMembers) * BigInt(circle.contributionAmount.toString())
    ).toString();

    return tx.round.upsert({
      where: {
        circleId_roundNumber: {
          circleId: circle.id,
          roundNumber,
        },
      },
      update: {},
      create: {
        circleId: circle.id,
        roundNumber,
        status: RoundStatus.OPEN,
        grossPotAmount: grossPot,
      },
    });
  }

  private async confirmTransactionRecord(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
    senderAddress: string,
    contractAddress: string,
    circleId: string | null,
    txType: TxType,
  ) {
    await tx.blockchainTransaction.upsert({
      where: { txHash },
      update: {
        status: TxStatus.CONFIRMED,
        blockNumber: event.blockNumber,
        confirmedAt: event.blockTimestamp,
        ...(circleId ? { circleId } : {}),
      },
      create: {
        chainId: event.chainId,
        txHash,
        senderAddress,
        contractAddress,
        circleId,
        txType,
        status: TxStatus.CONFIRMED,
        blockNumber: event.blockNumber,
        confirmedAt: event.blockTimestamp,
      },
    });
  }

  private async notifyCircleMembers(
    tx: Prisma.TransactionClient,
    circleId: string,
    title: string,
    body: string,
  ) {
    const members = await tx.circleMember.findMany({
      where: { circleId, userId: { not: null } },
      select: { userId: true },
    });

    const userIds = Array.from(
      new Set(members.map((m) => m.userId).filter((id): id is string => Boolean(id))),
    );

    if (userIds.length === 0) return;

    await tx.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        circleId,
        title,
        body,
      })),
    });
  }

  private async handleBidCommitted(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const bidderAddress = normalizeAddress(args.bidder);
    const roundNumber = Number(args.roundNumber || 1);

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    await this.notifyCircleMembers(
      tx,
      circle.id,
      `Thăm đấu giá kín mới — Vòng #${roundNumber}`,
      `Thành viên ${bidderAddress.slice(0, 6)}...${bidderAddress.slice(-4)} đã khóa mã cam kết (Sealed-Bid Commit).`,
    );

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      bidderAddress,
      circleAddress,
      circle.id,
      TxType.COMMIT_BID,
    );
  }

  private async handleBidRevealed(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    await this.handleBidSubmitted(tx, event, txHash);
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const bidderAddress = normalizeAddress(args.bidder);
    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (circle) {
      await this.confirmTransactionRecord(
        tx,
        event,
        txHash,
        bidderAddress,
        circleAddress,
        circle.id,
        TxType.REVEAL_BID,
      );
    }
  }

  private async handleYieldHarvested(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const yieldEarned = String(args.yieldEarned || args.yieldAmount || '0');

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });
    if (!circle) return;

    const currentDiscountPool = circle.totalDiscountPool
      ? circle.totalDiscountPool.toString()
      : '0';
    const updatedBonusPool = (BigInt(currentDiscountPool) + BigInt(yieldEarned)).toString();

    await tx.circle.update({
      where: { id: circle.id },
      data: {
        totalDiscountPool: updatedBonusPool,
      },
    });

    await this.notifyCircleMembers(
      tx,
      circle.id,
      `Thu hoạch Lãi suất DeFi — "${circle.name}"`,
      `Quỹ thế chấp đã sinh lời +${formatUsdcUnits(yieldEarned)} mUSDC từ ERC-4626 Yield Vault và được cộng vào quỹ thưởng cuối kỳ.`,
    );
  }

  private async handleSybilAttestationVerified(
    tx: Prisma.TransactionClient,
    event: IndexedEventInput,
    txHash: string,
  ) {
    const args = event.args;
    const circleAddress = normalizeAddress(args.circleAddress || event.contractAddress);
    const memberAddress = normalizeAddress(args.member);

    const circle = await tx.circle.findUnique({
      where: { contractAddress: circleAddress },
    });

    await this.confirmTransactionRecord(
      tx,
      event,
      txHash,
      memberAddress,
      circleAddress,
      circle?.id ?? null,
      TxType.VERIFY_ATTESTATION,
    );
  }
}

