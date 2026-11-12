import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { SyncAuthDto } from '../dto/sync-auth.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class AuthService {
  private readonly faucetCooldownMap = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async syncUser(authUser: AuthenticatedUser, dto: SyncAuthDto) {
    const walletAddress = normalizeAddress(dto.walletAddress);
    const privyDid = dto.privyDid || authUser.privyDid || `did:privy:${walletAddress}`;
    const email = dto.email || authUser.email || null;
    const defaultDisplayName =
      dto.displayName ||
      (email ? email.split('@')[0] : `Builder ${walletAddress.slice(0, 6)}`);

    // Check if wallet is already linked to a user
    const existingWallet = await this.prisma.wallet.findUnique({
      where: { address: walletAddress },
      include: { user: true },
    });

    let userId: string;

    if (existingWallet) {
      userId = existingWallet.userId;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(email ? { email } : {}),
          ...(dto.displayName ? { displayName: dto.displayName } : {}),
        },
      });
    } else {
      const user = await this.prisma.user.upsert({
        where: { privyDid },
        update: {
          ...(email ? { email } : {}),
          ...(dto.displayName ? { displayName: dto.displayName } : {}),
        },
        create: {
          privyDid,
          email,
          displayName: defaultDisplayName,
        },
      });
      userId = user.id;

      await this.prisma.wallet.upsert({
        where: { address: walletAddress },
        update: { userId },
        create: {
          userId,
          address: walletAddress,
          walletClientType: 'privy',
          isPrimary: true,
        },
      });
    }

    // Backfill userId on any existing circle_members with this walletAddress
    await this.prisma.circleMember.updateMany({
      where: { memberAddress: walletAddress, userId: null },
      data: { userId },
    });

    return this.usersService.getUserProfileById(userId, walletAddress);
  }

  async issueTeam1Attestation(
    authUser: AuthenticatedUser,
    body: { walletAddress?: string; email?: string },
  ) {
    const subject = normalizeAddress(
      body?.walletAddress ||
        authUser.walletAddress ||
        '0x71c95911e9a5d330f4d621842ec243ee13432921',
    );
    const uniqueHumanKey = (
      body?.email ||
      authUser.email ||
      authUser.privyDid ||
      subject
    )
      .trim()
      .toLowerCase();

    const identityHash =
      '0x' +
      createHash('sha256')
        .update(`avahui:team1:identity:${uniqueHumanKey}`)
        .digest('hex');

    const attestationSig =
      '0x' +
      createHash('sha256')
        .update(`avahui:team1:sig:${subject}:${identityHash}:2`)
        .digest('hex');

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 30 * 86400;

    return {
      subject,
      identityHash,
      trustTier: 2,
      issuedAt,
      expiresAt,
      attestationSig,
      isTeam1Verified: true,
    };
  }

  async checkAndRecordFaucetClaim(
    authUser: AuthenticatedUser,
    walletAddressInput?: string,
  ) {
    const walletAddress = normalizeAddress(
      walletAddressInput ||
        authUser.walletAddress ||
        '0x71c95911e9a5d330f4d621842ec243ee13432921',
    );
    const cooldownSeconds = 60;
    const nowSec = Math.floor(Date.now() / 1000);
    const lastClaimSec = this.faucetCooldownMap.get(walletAddress) || 0;
    const remainingCooldownSeconds = Math.max(
      0,
      lastClaimSec + cooldownSeconds - nowSec,
    );

    if (remainingCooldownSeconds === 0) {
      this.faucetCooldownMap.set(walletAddress, nowSec);
    }

    return {
      walletAddress,
      allowed: remainingCooldownSeconds === 0,
      remainingCooldownSeconds,
      cooldownSeconds,
      lastClaimedAt:
        lastClaimSec > 0 ? new Date(lastClaimSec * 1000).toISOString() : null,
    };
  }
}

