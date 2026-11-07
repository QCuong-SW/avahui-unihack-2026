import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AllocationMode as PrismaAllocationMode,
  CircleStatus as PrismaCircleStatus,
  Prisma,
} from '@prisma/client';
import { getContractAddresses } from '@avahui/blockchain';
import { USDC_DECIMALS, USDC_SYMBOL } from '@avahui/shared';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { formatUsdcUnits, normalizeAddress } from '../../../common/utils/format.util';
import { CreateCircleDraftDto, QueryCirclesDto } from '../dto/circle.dto';

@Injectable()
export class CirclesService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(authUser: AuthenticatedUser, dto: CreateCircleDraftDto) {
    const metadataId = `meta_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const creatorAddress = normalizeAddress(
      dto.creatorAddress ||
        authUser.walletAddress ||
        '0x71c95911e9a5d330f4d621842ec243ee13432921',
    );
    const defaultTokenAddress = normalizeAddress(
      dto.tokenAddress || getContractAddresses(43113).mockUSDC,
    );

    let startDeadlineDate: Date;
    if (typeof dto.startDeadline === 'number' || /^\d+$/.test(String(dto.startDeadline || ''))) {
      const ts = Number(dto.startDeadline);
      startDeadlineDate = new Date(ts > 1e12 ? ts : ts * 1000);
    } else if (dto.startDeadline) {
      startDeadlineDate = new Date(dto.startDeadline);
    } else {
      startDeadlineDate = new Date(Date.now() + 7 * 86400 * 1000);
    }

    const circle = await this.prisma.circle.create({
      data: {
        metadataId,
        chainId: Number(process.env.CHAIN_ID || 43113),
        name: dto.name,
        description: dto.description ?? null,
        creatorAddress,
        tokenAddress: defaultTokenAddress,
        allocationMode: dto.allocationMode as unknown as PrismaAllocationMode,
        status: PrismaCircleStatus.DRAFT,
        maxMembers: dto.maxMembers,
        currentMemberCount: 0,
        currentRound: 0,
        totalRounds: dto.maxMembers,
        contributionAmount: dto.contributionAmount,
        collateralAmount: dto.collateralAmount,
        roundDurationSeconds: dto.roundDurationSeconds,
        biddingDurationSeconds: dto.biddingDurationSeconds ?? 0,
        gracePeriodSeconds: dto.gracePeriodSeconds,
        startDeadline: startDeadlineDate,
        minBid: dto.minBid ?? '0',
        maxBid: dto.maxBid ?? '0',
        totalDiscountPool: '0',
      },
    });

    return {
      id: circle.id,
      metadataId: circle.metadataId,
      status: circle.status,
      name: circle.name,
      startDeadlineUnix: Math.floor(circle.startDeadline.getTime() / 1000),
      circle: await this.getCircleById(circle.id),
    };
  }

  async listCircles(query: QueryCirclesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CircleWhereInput = {};

    if (query.status) {
      where.status = query.status as unknown as PrismaCircleStatus;
    } else {
      // By default exclude unsubmitted DRAFTs from public exploration unless explicitly queried
      where.status = { not: PrismaCircleStatus.DRAFT };
    }

    if (query.mode) {
      where.allocationMode = query.mode as unknown as PrismaAllocationMode;
    }

    if (query.memberAddress) {
      const addr = normalizeAddress(query.memberAddress);
      where.OR = [
        { creatorAddress: addr },
        { members: { some: { memberAddress: addr } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.circle.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          members: {
            orderBy: { slotIndex: 'asc' },
            include: { user: true, collateral: true },
          },
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: {
              contributions: { orderBy: { contributedAt: 'asc' } },
              bids: { orderBy: { bidAmount: 'desc' } },
              payout: true,
            },
          },
        },
      }),
      this.prisma.circle.count({ where }),
    ]);

    const addressMap = await this.buildAddressDisplayNameMap(items);

    return {
      items: items.map((c) => this.mapCircleDetail(c, addressMap)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCircleById(idOrIdentifier: string) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrIdentifier,
      );

    const where: Prisma.CircleWhereInput = isUuid
      ? { id: idOrIdentifier }
      : {
          OR: [
            { metadataId: idOrIdentifier },
            { contractAddress: normalizeAddress(idOrIdentifier) },
          ],
        };

    const circle = await this.prisma.circle.findFirst({
      where,
      include: {
        members: {
          orderBy: { slotIndex: 'asc' },
          include: { user: true, collateral: true },
        },
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: {
            contributions: { orderBy: { contributedAt: 'asc' } },
            bids: { orderBy: { bidAmount: 'desc' } },
            payout: true,
          },
        },
      },
    });

    if (!circle) {
      throw new NotFoundException(`Circle "${idOrIdentifier}" not found`);
    }

    const addressMap = await this.buildAddressDisplayNameMap([circle]);
    return this.mapCircleDetail(circle, addressMap);
  }

  async getRoundDetail(idOrIdentifier: string, roundNumber: number) {
    const circle = await this.getCircleById(idOrIdentifier);
    const round = circle.rounds.find((r) => r.roundNumber === Number(roundNumber));

    if (!round) {
      throw new NotFoundException(
        `Round #${roundNumber} in circle "${idOrIdentifier}" not found`,
      );
    }

    return round;
  }

  private async buildAddressDisplayNameMap(circles: any[]): Promise<Record<string, string>> {
    const addresses = new Set<string>();
    for (const c of circles) {
      if (c.creatorAddress) addresses.add(normalizeAddress(c.creatorAddress));
      for (const m of c.members || []) {
        addresses.add(normalizeAddress(m.memberAddress));
      }
      for (const r of c.rounds || []) {
        if (r.winnerAddress) addresses.add(normalizeAddress(r.winnerAddress));
        for (const contrib of r.contributions || []) {
          addresses.add(normalizeAddress(contrib.memberAddress));
        }
        for (const bid of r.bids || []) {
          addresses.add(normalizeAddress(bid.bidderAddress));
        }
      }
    }

    const addrList = Array.from(addresses).filter(Boolean);
    if (addrList.length === 0) return {};

    const wallets = await this.prisma.wallet.findMany({
      where: { address: { in: addrList } },
      include: { user: true },
    });

    const map: Record<string, string> = {};
    for (const w of wallets) {
      if (w.user?.displayName) {
        map[normalizeAddress(w.address)] = w.user.displayName;
      }
    }
    return map;
  }

  private mapCircleDetail(circle: any, addressNameMap: Record<string, string>) {
    const getName = (addr?: string | null) => {
      if (!addr) return null;
      const norm = normalizeAddress(addr);
      return addressNameMap[norm] || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return {
      id: circle.id,
      metadataId: circle.metadataId,
      contractAddress: circle.contractAddress,
      chainId: circle.chainId,
      name: circle.name,
      description: circle.description,
      creatorAddress: circle.creatorAddress,
      tokenAddress: circle.tokenAddress,
      tokenSymbol: USDC_SYMBOL,
      tokenDecimals: USDC_DECIMALS,
      allocationMode: circle.allocationMode,
      status: circle.status,
      maxMembers: circle.maxMembers,
      currentMemberCount: circle.currentMemberCount,
      currentRound: circle.currentRound,
      totalRounds: circle.totalRounds,
      contributionAmount: circle.contributionAmount.toString(),
      contributionAmountFormatted: formatUsdcUnits(circle.contributionAmount),
      collateralAmount: circle.collateralAmount.toString(),
      collateralAmountFormatted: formatUsdcUnits(circle.collateralAmount),
      roundDurationSeconds: circle.roundDurationSeconds,
      biddingDurationSeconds: circle.biddingDurationSeconds,
      gracePeriodSeconds: circle.gracePeriodSeconds,
      startDeadline: circle.startDeadline?.toISOString() ?? null,
      minBid: circle.minBid.toString(),
      minBidFormatted: formatUsdcUnits(circle.minBid),
      maxBid: circle.maxBid.toString(),
      maxBidFormatted: formatUsdcUnits(circle.maxBid),
      totalDiscountPool: circle.totalDiscountPool.toString(),
      totalDiscountPoolFormatted: formatUsdcUnits(circle.totalDiscountPool),
      creationTxHash: circle.creationTxHash,
      createdAt: circle.createdAt.toISOString(),
      members: (circle.members || []).map((m: any) => ({
        id: m.id,
        slotIndex: m.slotIndex,
        userId: m.userId,
        displayName: m.user?.displayName ?? getName(m.memberAddress),
        walletAddress: m.memberAddress,
        lockedCollateral: m.collateral?.currentLockedAmount?.toString() ?? circle.collateralAmount.toString(),
        lockedCollateralFormatted: formatUsdcUnits(
          m.collateral?.currentLockedAmount ?? circle.collateralAmount,
        ),
        initialLockedAmountFormatted: formatUsdcUnits(
          m.collateral?.initialLockedAmount ?? circle.collateralAmount,
        ),
        totalSlashedAmountFormatted: formatUsdcUnits(m.collateral?.totalSlashedAmount ?? 0),
        hasReceivedPayout: m.hasReceivedPayout,
        wonRoundNumber: m.wonRoundNumber,
        defaultCount: m.defaultCount,
        status: m.status,
        joinTxHash: m.joinTxHash,
        joinedAt: m.joinedAt?.toISOString(),
      })),
      rounds: (circle.rounds || []).map((r: any) => ({
        id: r.id,
        roundNumber: r.roundNumber,
        status: r.status,
        startTime: r.startTime?.toISOString() ?? null,
        contributionDeadline: r.contributionDeadline?.toISOString() ?? null,
        biddingDeadline: r.biddingDeadline?.toISOString() ?? null,
        graceDeadline: r.graceDeadline?.toISOString() ?? null,
        winnerAddress: r.winnerAddress,
        winnerName: getName(r.winnerAddress),
        grossPot: r.grossPotAmount.toString(),
        grossPotFormatted: formatUsdcUnits(r.grossPotAmount),
        winningBid: r.winningBidAmount.toString(),
        winningBidFormatted: formatUsdcUnits(r.winningBidAmount),
        netPayout: r.netPayoutAmount.toString(),
        netPayoutFormatted: formatUsdcUnits(r.netPayoutAmount),
        settlementTxHash: r.settlementTxHash,
        settledAt: r.settledAt?.toISOString() ?? null,
        contributionsCount: (r.contributions || []).length,
        contributions: (r.contributions || []).map((c: any) => ({
          id: c.id,
          roundNumber: c.roundNumber,
          memberAddress: c.memberAddress,
          memberName: getName(c.memberAddress),
          amount: c.amount.toString(),
          amountFormatted: formatUsdcUnits(c.amount),
          isFromCollateralSlash: c.isFromCollateralSlash,
          paidAt: c.contributedAt.toISOString(),
          txHash: c.txHash,
        })),
        bids: (r.bids || []).map((b: any) => ({
          id: b.id,
          roundNumber: b.roundNumber,
          bidderAddress: b.bidderAddress,
          bidderName: getName(b.bidderAddress),
          bidAmount: b.bidAmount.toString(),
          bidAmountFormatted: formatUsdcUnits(b.bidAmount),
          isWinningBid: b.isWinningBid,
          createdAt: b.placedAt.toISOString(),
          txHash: b.txHash,
        })),
        payout: r.payout
          ? {
              id: r.payout.id,
              roundNumber: r.payout.roundNumber,
              recipientAddress: r.payout.recipientAddress,
              recipientName: getName(r.payout.recipientAddress),
              grossAmount: r.payout.grossAmount.toString(),
              grossAmountFormatted: formatUsdcUnits(r.payout.grossAmount),
              discountAmount: r.payout.discountAmount.toString(),
              discountAmountFormatted: formatUsdcUnits(r.payout.discountAmount),
              netAmount: r.payout.netAmount.toString(),
              netAmountFormatted: formatUsdcUnits(r.payout.netAmount),
              txHash: r.payout.txHash,
              paidAt: r.payout.paidAt.toISOString(),
            }
          : null,
      })),
    };
  }
}

