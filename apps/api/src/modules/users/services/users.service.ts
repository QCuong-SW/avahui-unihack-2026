import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CircleStatus } from '@prisma/client';
import { UserRole } from '@avahui/shared';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { formatUsdcUnits, normalizeAddress } from '../../../common/utils/format.util';
import { UpdateUserDto } from '../dto/update-user.dto';
import { TokenVerifierService } from '../../auth/services/token-verifier.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tokenVerifier?: TokenVerifierService,
  ) {}

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

    const shouldEnrichFromPrivy =
      authUser.authType === 'privy' &&
      Boolean(this.tokenVerifier?.hasRealPrivyServerCredentials()) &&
      (!user || !user.email || user.wallets.length === 0);

    const privyIdentity = shouldEnrichFromPrivy
      ? await this.tokenVerifier!.fetchPrivyUserIdentity(authUser.privyDid)
      : null;

    const verifiedEmail = privyIdentity?.email ?? authUser.email ?? null;
    const isBootstrapAdmin = Boolean(
      privyIdentity?.email &&
        this.tokenVerifier?.isBootstrapAdminEmail(privyIdentity.email),
    );
    const verifiedWallet = authUser.walletAddress
      ? normalizeAddress(authUser.walletAddress)
      : (privyIdentity?.verifiedWallets[0] ?? null);

    // Auto-provision user if authenticated for the first time
    if (!user) {
      const existingWalletOwner = verifiedWallet
        ? await this.prisma.wallet.findUnique({ where: { address: verifiedWallet } })
        : null;
      const attachWallet =
        verifiedWallet && !existingWalletOwner ? verifiedWallet : null;

      user = await this.prisma.user.create({
        data: {
          privyDid: authUser.privyDid,
          email: verifiedEmail,
          displayName:
            privyIdentity?.displayName ||
            (verifiedEmail
              ? verifiedEmail.split('@')[0]
              : attachWallet
                ? `Builder ${attachWallet.slice(0, 6)}`
                : 'AvaHui Builder'),
          ...(isBootstrapAdmin ? { role: UserRole.ADMIN } : {}),
          ...(attachWallet
            ? {
                wallets: {
                  create: {
                    address: attachWallet,
                    walletClientType: 'privy',
                    isPrimary: true,
                  },
                },
              }
            : {}),
        },
        include: { wallets: true },
      });
    } else if (privyIdentity) {
      const needsEmail = !user.email && Boolean(privyIdentity.email);
      const needsName =
        Boolean(privyIdentity.displayName) &&
        (!user.displayName || user.displayName === 'AvaHui Builder');
      const needsAdminPromotion =
        isBootstrapAdmin && user.role !== UserRole.ADMIN;

      if (needsEmail || needsName || needsAdminPromotion) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(needsEmail ? { email: privyIdentity.email } : {}),
            ...(needsName ? { displayName: privyIdentity.displayName } : {}),
            ...(needsAdminPromotion ? { role: UserRole.ADMIN } : {}),
          },
          include: { wallets: true },
        });
      }

      if (user.wallets.length === 0 && privyIdentity.verifiedWallets[0]) {
        const candidate = privyIdentity.verifiedWallets[0];
        const taken = await this.prisma.wallet.findUnique({
          where: { address: candidate },
        });
        if (!taken) {
          await this.prisma.wallet.create({
            data: {
              userId: user.id,
              address: candidate,
              walletClientType: 'privy',
              isPrimary: true,
            },
          });
          user =
            (await this.prisma.user.findUnique({
              where: { id: user.id },
              include: { wallets: true },
            })) ?? user;
        }
      }
    }

    const primaryWallet =
      user.wallets.find((w) => w.isPrimary)?.address ??
      user.wallets[0]?.address ??
      verifiedWallet ??
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

    const stats = await this.computeDashboardStats(
      walletAddresses,
      user.team1Verified,
    );
    const primaryAddress =
      user.wallets.find((w) => w.isPrimary)?.address ??
      user.wallets[0]?.address ??
      fallbackWallet ??
      null;

    return {
      id: user.id,
      privyDid: user.privyDid,
      role: user.role,
      isActive: user.isActive,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      team1Attested: user.team1Verified,
      isTeam1Verified: user.team1Verified,
      identityNullifier: user.identityNullifier ?? undefined,
      trustTier: user.trustTier,
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

  /** Computes deterministic on-chain ROSCA credit score (0..1000) and tier from indexed history. */
  computeRoscaCreditProfile(input: {
    completedCirclesCount: number;
    onTimePaymentsCount: number;
    defaultCount: number;
    team1Verified: boolean;
  }): { creditScore: number; creditTier: 'NEW' | 'TRUSTED' | 'EXPERT' } {
    const rawScore =
      500 +
      input.onTimePaymentsCount * 25 +
      input.completedCirclesCount * 80 +
      (input.team1Verified ? 100 : 0) -
      input.defaultCount * 150;
    const creditScore = Math.max(0, Math.min(1000, rawScore));
    const creditTier =
      creditScore >= 750
        ? 'EXPERT'
        : creditScore >= 600
          ? 'TRUSTED'
          : 'NEW';
    return { creditScore, creditTier };
  }

  private async computeDashboardStats(
    walletAddresses: string[],
    team1Verified = false,
  ) {
    if (walletAddresses.length === 0) {
      const credit = this.computeRoscaCreditProfile({
        completedCirclesCount: 0,
        onTimePaymentsCount: 0,
        defaultCount: 0,
        team1Verified,
      });
      return {
        activeCirclesCount: 0,
        totalContributed: '0.00',
        totalCollateralLocked: '0.00',
        totalPayoutReceived: '0.00',
        completedCirclesCount: 0,
        onTimePaymentsCount: 0,
        defaultCount: 0,
        ...credit,
      };
    }

    const [
      activeCirclesCount,
      completedCirclesCount,
      defaultAgg,
      contribAgg,
      collateralAgg,
      payoutAgg,
    ] = await Promise.all([
      this.prisma.circleMember.count({
        where: {
          memberAddress: { in: walletAddresses },
          circle: {
            status: { in: [CircleStatus.RECRUITING, CircleStatus.ACTIVE] },
          },
        },
      }),
      this.prisma.circleMember.count({
        where: {
          memberAddress: { in: walletAddresses },
          defaultCount: 0,
          circle: {
            status: CircleStatus.COMPLETED,
          },
        },
      }),
      typeof this.prisma.circleMember?.aggregate === 'function'
        ? this.prisma.circleMember.aggregate({
            where: {
              memberAddress: { in: walletAddresses },
            },
            _sum: { defaultCount: true },
          })
        : Promise.resolve({ _sum: { defaultCount: 0 } }),
      this.prisma.contribution.aggregate({
        where: {
          memberAddress: { in: walletAddresses },
          isFromCollateralSlash: false,
        },
        _sum: { amount: true },
        _count: { _all: true },
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

    const onTimePaymentsCount = Number(
      (contribAgg as { _count?: { _all?: number } })?._count?._all ?? 0,
    );
    const defaultCount = Number(defaultAgg?._sum?.defaultCount ?? 0);
    const credit = this.computeRoscaCreditProfile({
      completedCirclesCount,
      onTimePaymentsCount,
      defaultCount,
      team1Verified,
    });

    return {
      activeCirclesCount,
      totalContributed: formatUsdcUnits(contribAgg._sum.amount ?? 0),
      totalCollateralLocked: formatUsdcUnits(collateralAgg._sum.currentLockedAmount ?? 0),
      totalPayoutReceived: formatUsdcUnits(payoutAgg._sum.netAmount ?? 0),
      completedCirclesCount,
      onTimePaymentsCount,
      defaultCount,
      ...credit,
    };
  }
}

