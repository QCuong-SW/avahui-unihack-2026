import { Injectable, Optional } from '@nestjs/common';
import { TxStatus, TxType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
import { TrackTransactionDto } from '../dto/track-transaction.dto';
import { BlockchainIndexerService } from '../../blockchain/services/blockchain-indexer.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly indexerService?: BlockchainIndexerService,
  ) {}

  async trackTransaction(authUser: AuthenticatedUser, dto: TrackTransactionDto) {
    const txHash = normalizeAddress(dto.txHash);
    const senderAddress = normalizeAddress(
      dto.senderAddress ||
        authUser.walletAddress ||
        '0x71c95911e9a5d330f4d621842ec243ee13432921',
    );
    const contractAddress = normalizeAddress(dto.contractAddress);

    let circleId: string | null = null;
    if (dto.circleId) {
      const circle = await this.prisma.circle.findFirst({
        where: {
          OR: [
            ...(this.isUuid(dto.circleId) ? [{ id: dto.circleId }] : []),
            { metadataId: dto.circleId },
            { contractAddress: normalizeAddress(dto.circleId) },
          ],
        },
      });
      circleId = circle?.id ?? null;
    } else {
      const circleByContract = await this.prisma.circle.findUnique({
        where: { contractAddress },
      });
      circleId = circleByContract?.id ?? null;
    }

    const record = await this.prisma.blockchainTransaction.upsert({
      where: { txHash },
      update: {
        ...(circleId ? { circleId } : {}),
      },
      create: {
        chainId: Number(process.env.CHAIN_ID || 43113),
        txHash,
        senderAddress,
        contractAddress,
        circleId,
        txType: dto.txType as unknown as TxType,
        status: TxStatus.PENDING,
      },
      include: { circle: true },
    });

    // Event-driven instant index trigger so UI sees confirmed state immediately
    let refreshed = record;
    if (this.indexerService) {
      await this.indexerService.pollOnce().catch(() => 0);
      if (typeof this.prisma.blockchainTransaction.findUnique === 'function') {
        refreshed =
          (await this.prisma.blockchainTransaction.findUnique({
            where: { txHash },
            include: { circle: true },
          })) || record;
      }
    }

    return this.mapTransaction(refreshed);
  }

  async getMyTransactions(authUser: AuthenticatedUser, circleIdFilter?: string) {
    const addresses = new Set<string>();
    if (authUser.walletAddress) {
      addresses.add(normalizeAddress(authUser.walletAddress));
    }

    if (authUser.id) {
      const wallets = await this.prisma.wallet.findMany({
        where: { userId: authUser.id },
      });
      for (const w of wallets) {
        addresses.add(normalizeAddress(w.address));
      }
    }

    const addrList = Array.from(addresses).filter(Boolean);

    const records = await this.prisma.blockchainTransaction.findMany({
      where: {
        ...(addrList.length > 0 ? { senderAddress: { in: addrList } } : {}),
        ...(circleIdFilter && this.isUuid(circleIdFilter)
          ? { circleId: circleIdFilter }
          : {}),
      },
      include: { circle: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return records.map((r) => this.mapTransaction(r));
  }

  private isUuid(val: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  }

  private mapTransaction(r: any) {
    return {
      id: r.id,
      chainId: r.chainId,
      txHash: r.txHash,
      senderAddress: r.senderAddress,
      contractAddress: r.contractAddress,
      circleId: r.circleId,
      circleName: r.circle?.name ?? null,
      txType: r.txType,
      status: r.status,
      blockNumber: r.blockNumber !== null ? r.blockNumber.toString() : null,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
    };
  }
}

