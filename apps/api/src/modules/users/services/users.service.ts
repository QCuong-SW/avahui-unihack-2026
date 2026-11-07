import { Injectable, NotFoundException } from '@nestjs/common';
import { CircleStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { formatUsdcUnits, normalizeAddress } from '../../../common/utils/format.util';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentUserProfile(authUser: AuthenticatedUser) {
    let user = authUser.id
      ? await this.prisma.user.findUnique({
          where: { id: authUser.id },
          include: { wallets: true },
        })
      : await this.prisma.user.findUnique({
          where: { privyDid: authUser.privyDid },
          include: { wallets: true },
        });

    if (!user && authUser.walletAddress) {
      const normalized = normalizeAddress(authUser.walletAddress);
      const wallet = await this.prisma.wallet.findUnique({
        where: { address: normalized },
        include: { user: { include: { wallets: true } } },
      });
      user = wallet?.user ?? null;
    }

    // Auto-provision user if authenticated for the first time
    if (!user) {
      const addr = authUser.walletAddress ? normalizeAddress(authUser.walletAddress) : null;
      user = await this.prisma.user.create({
        data: {
          privyDid: authUser.privyDid,
          email: authUser.email ?? null,
          displayName: authUser.email
            ? authUser.email.split('@')[0]
            : addr
              ? `Builder ${addr.slice(0, 6)}`
              : 'AvaHui Builder',
          ...(addr
            ? {
                wallets: {
                  create: {
                    address: addr,
                    walletClientType: 'privy',
                    isPrimary: true,
                  },
                },
              }
            : {}),
        },
        include: { wallets: true },
      });
    }

    const primaryWallet =
      user.wallets.find((w) => w.isPrimary)?.address ??
      user.wallets[0]?.address ??
      authUser.walletAddress ??
      null;

    return this.getUserProfileById(user.id, primaryWallet);
  }

  async getUserProfileById(userId: string, fallbackWallet?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallets: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const walletAddresses = user.wallets.map((w) => normalizeAddress(w.address));
    if (fallbackWallet) {
      const normFallback = normalizeAddress(fallbackWallet);
      if (normFallback && !walletAddresses.includes(normFallback)) {
        walletAddresses.push(normFallback);
      }
    }

    const stats = await this.computeDashboardStats(walletAddresses);
    const primaryAddress =
      user.wallets.find((w) => w.isPrimary)?.address ??
      user.wallets[0]?.address ??
      fallbackWallet ??
      null;

    return {
      id: user.id,
      privyDid: user.privyDid,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      walletAddress: primaryAddress,
      wallets: user.wallets.map((w) => ({
        id: w.id,
        address: w.address,
        walletClientType: w.walletClientType,
        isPrimary: w.isPrimary,
      })),
      stats,
    };
  }

  async updateCurrentUser(authUser: AuthenticatedUser, dto: UpdateUserDto) {
    const profile = await this.getCurrentUserProfile(authUser);
    await this.prisma.user.update({
      where: { id: profile.id },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
    return this.getUserProfileById(profile.id, profile.walletAddress);
  }

  private async computeDashboardStats(walletAddresses: string[]) {
    if (walletAddresses.length === 0) {
      return {
        activeCirclesCount: 0,
        totalContributed: '0.00',
        totalCollateralLocked: '0.00',
        totalPayoutReceived: '0.00',
      };
    }

    const [activeCirclesCount, contribAgg, collateralAgg, payoutAgg] = await Promise.all([
      this.prisma.circleMember.count({
        where: {
          memberAddress: { in: walletAddresses },
          circle: {
            status: { in: [CircleStatus.RECRUITING, CircleStatus.ACTIVE] },
          },
        },
      }),
      this.prisma.contribution.aggregate({
        where: {
          memberAddress: { in: walletAddresses },
          isFromCollateralSlash: false,
        },
        _sum: { amount: true },
      }),
      this.prisma.collateral.aggregate({
        where: {
          memberAddress: { in: walletAddresses },
          isWithdrawn: false,
        },
        _sum: { currentLockedAmount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          recipientAddress: { in: walletAddresses },
        },
        _sum: { netAmount: true },
      }),
    ]);

    return {
      activeCirclesCount,
      totalContributed: formatUsdcUnits(contribAgg._sum.amount ?? 0),
      totalCollateralLocked: formatUsdcUnits(collateralAgg._sum.currentLockedAmount ?? 0),
      totalPayoutReceived: formatUsdcUnits(payoutAgg._sum.netAmount ?? 0),
    };
  }
}

