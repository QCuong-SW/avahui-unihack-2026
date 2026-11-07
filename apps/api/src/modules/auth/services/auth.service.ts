import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SyncAuthDto } from '../dto/sync-auth.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
import { UsersService } from '../../users/services/users.service';

@Injectable()
export class AuthService {
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
}

