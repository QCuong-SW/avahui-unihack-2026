import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CircleStatus, Prisma, UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { formatUsdcUnits } from '../../../common/utils/format.util';
import {
  ModerateCircleDto,
  QueryAdminUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from '../dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      totalUsers,
      suspendedUsers,
      adminCount,
      verifierCount,
      verifiedTeam1Users,
      totalCircles,
      recruitingCircles,
      activeCircles,
      completedCircles,
      cancelledCircles,
      privateCircles,
      hiddenCircles,
      totalTransactions,
      totalIndexedEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { role: PrismaUserRole.ADMIN } }),
      this.prisma.user.count({ where: { role: PrismaUserRole.VERIFIER } }),
      this.prisma.user.count({ where: { team1Verified: true } }),
      this.prisma.circle.count(),
      this.prisma.circle.count({ where: { status: CircleStatus.RECRUITING } }),
      this.prisma.circle.count({ where: { status: CircleStatus.ACTIVE } }),
      this.prisma.circle.count({ where: { status: CircleStatus.COMPLETED } }),
      this.prisma.circle.count({ where: { status: CircleStatus.CANCELLED } }),
      this.prisma.circle.count({ where: { isPrivateInvite: true } }),
      this.prisma.circle.count({ where: { isHiddenByAdmin: true } }),
      this.prisma.blockchainTransaction.count(),
      this.prisma.blockchainEvent.count(),
    ]);

    return {
      users: {
        total: totalUsers,
        suspended: suspendedUsers,
        admins: adminCount,
        verifiers: verifierCount,
        team1Verified: verifiedTeam1Users,
      },
      circles: {
        total: totalCircles,
        recruiting: recruitingCircles,
        active: activeCircles,
        completed: completedCircles,
        cancelled: cancelledCircles,
        privateCircles,
        hiddenCircles,
      },
      blockchain: {
        totalTransactions,
        totalIndexedEvents,
        chainId: Number(process.env.CHAIN_ID || 43113),
        indexerEnabled:
          String(process.env.INDEXER_ENABLED ?? 'true').toLowerCase() === 'true',
        keeperEnabled:
          String(process.env.KEEPER_ENABLED ?? 'true').toLowerCase() === 'true',
        keeperConfigured: Boolean(
          process.env.KEEPER_PRIVATE_KEY?.startsWith('0x') &&
            process.env.KEEPER_PRIVATE_KEY.length === 66,
        ),
        privyConfigured: Boolean(
          process.env.PRIVY_APP_ID &&
            !process.env.PRIVY_APP_ID.startsWith('mock_') &&
            process.env.PRIVY_APP_ID !== 'your_privy_app_id_here',
        ),
      },
    };
  }

  async listUsers(query: QueryAdminUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.role) {
      where.role = query.role as unknown as PrismaUserRole;
    }
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
        { privyDid: { contains: q, mode: 'insensitive' } },
        { wallets: { some: { address: { contains: q.toLowerCase() } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { wallets: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        id: u.id,
        privyDid: u.privyDid,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        isActive: u.isActive,
        team1Verified: u.team1Verified,
        identityNullifier: u.identityNullifier,
        trustTier: u.trustTier,
        wallets: u.wallets.map((w) => ({
          id: w.id,
          address: w.address,
          walletClientType: w.walletClientType,
          isPrimary: w.isPrimary,
        })),
        createdAt: u.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(
    actor: AuthenticatedUser,
    userId: string,
    dto: UpdateUserRoleDto,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException(`User "${userId}" not found`);
    }
    if (actor.id && actor.id === userId && dto.role !== 'ADMIN') {
      throw new ForbiddenException('Admin cannot demote their own account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role as unknown as PrismaUserRole },
      include: { wallets: true },
    });

    return {
      id: updated.id,
      privyDid: updated.privyDid,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      isActive: updated.isActive,
    };
  }

  async updateUserStatus(
    actor: AuthenticatedUser,
    userId: string,
    dto: UpdateUserStatusDto,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      throw new NotFoundException(`User "${userId}" not found`);
    }
    if (actor.id && actor.id === userId && !dto.isActive) {
      throw new ForbiddenException('Admin cannot suspend their own account');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
    });

    return {
      id: updated.id,
      privyDid: updated.privyDid,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
    };
  }

  async listCircles(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.circle.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.circle.count(),
    ]);

    return {
      items: items.map((c) => ({
        id: c.id,
        metadataId: c.metadataId,
        contractAddress: c.contractAddress,
        name: c.name,
        creatorAddress: c.creatorAddress,
        allocationMode: c.allocationMode,
        status: c.status,
        maxMembers: c.maxMembers,
        currentMemberCount: c.currentMemberCount,
        contributionAmountFormatted: formatUsdcUnits(c.contributionAmount),
        collateralAmountFormatted: formatUsdcUnits(c.collateralAmount),
        isPrivateInvite: c.isPrivateInvite,
        requireTeam1Attestation: c.requireTeam1Attestation,
        isHiddenByAdmin: c.isHiddenByAdmin,
        moderationReason: c.moderationReason,
        createdAt: c.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async moderateCircle(circleId: string, dto: ModerateCircleDto) {
    const circle = await this.prisma.circle.findUnique({
      where: { id: circleId },
    });
    if (!circle) {
      throw new NotFoundException(`Circle "${circleId}" not found`);
    }

    const updated = await this.prisma.circle.update({
      where: { id: circleId },
      data: {
        isHiddenByAdmin: dto.isHiddenByAdmin,
        moderationReason: dto.moderationReason ?? null,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      isHiddenByAdmin: updated.isHiddenByAdmin,
      moderationReason: updated.moderationReason,
    };
  }
}

