import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { verifyMessage } from 'viem';
import { UserRole } from '@avahui/shared';
import { PrismaService } from '../../../database/prisma.service';
import { SyncAuthDto } from '../dto/sync-auth.dto';
import { VerifySiweDto } from '../dto/siwe.dto';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
import { UsersService } from '../../users/services/users.service';
import { TokenVerifierService } from './token-verifier.service';

@Injectable()
export class AuthService {
  private readonly verifier: TokenVerifierService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    @Optional() tokenVerifier?: TokenVerifierService,
  ) {
    this.verifier = tokenVerifier ?? new TokenVerifierService();
  }

  async requestSiweNonce(addressRaw: string) {
    if (!addressRaw || !/^0x[a-fA-F0-9]{40}$/.test(addressRaw.trim())) {
      throw new BadRequestException('Invalid Ethereum wallet address');
    }

    const address = normalizeAddress(addressRaw);
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const issuedAt = new Date().toISOString();
    const chainId = Number(process.env.CHAIN_ID || 43113);

    await this.prisma.authNonce.create({
      data: {
        address,
        nonce,
        expiresAt,
      },
    });

    const message = [
      'avahui.io wants you to sign in with your Ethereum account:',
      address,
      '',
      'Sign in to AvaHui On-Chain ROSCA Platform on Avalanche Fuji.',
      '',
      'URI: https://avahui.io',
      'Version: 1',
      `Chain ID: ${chainId}`,
      `Nonce: ${nonce}`,
      `Issued At: ${issuedAt}`,
    ].join('\n');

    return {
      address,
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifySiweSignature(dto: VerifySiweDto) {
    const address = normalizeAddress(dto.address);
    const nonceMatch = dto.message.match(/Nonce:\s*([a-fA-F0-9]{16,64})/);
    const nonce = dto.nonce?.trim() || nonceMatch?.[1];

    if (!nonce) {
      throw new BadRequestException('Missing SIWE nonce in message');
    }

    if (!dto.message.toLowerCase().includes(address)) {
      throw new UnauthorizedException('SIWE message address mismatch');
    }

    const nonceRecord = await this.prisma.authNonce.findUnique({
      where: { nonce },
    });

    if (
      !nonceRecord ||
      nonceRecord.address !== address ||
      nonceRecord.usedAt !== null ||
      nonceRecord.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired SIWE nonce');
    }

    // Consume nonce atomically to prevent replay attacks
    const consumed = await this.prisma.authNonce.updateMany({
      where: {
        id: nonceRecord.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    if (consumed.count !== 1) {
      throw new UnauthorizedException('SIWE nonce has already been used');
    }

    let signatureValid = false;
    try {
      signatureValid = await verifyMessage({
        address: address as `0x${string}`,
        message: dto.message,
        signature: dto.signature as `0x${string}`,
      });
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const existingWallet = await this.prisma.wallet.findUnique({
      where: { address },
      include: { user: true },
    });

    let user = existingWallet?.user ?? null;
    if (!user) {
      const privyDid = `did:privy:wallet_${address}`;
      user = await this.prisma.user.upsert({
        where: { privyDid },
        update: {},
        create: {
          privyDid,
          displayName: `Builder ${address.slice(0, 6)}`,
          wallets: {
            create: {
              address,
              walletClientType: 'external_siwe',
              isPrimary: true,
            },
          },
        },
      });
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Account has been suspended');
    }

    await this.prisma.circleMember.updateMany({
      where: { memberAddress: address, userId: null },
      data: { userId: user.id },
    });

    const accessToken = this.verifier.signSiweJwt({
      privyDid: user.privyDid,
      walletAddress: address,
      role: user.role as UserRole,
    });

    return {
      accessToken,
      user: await this.usersService.getUserProfileById(user.id, address),
    };
  }

  async syncUser(authUser: AuthenticatedUser, dto: SyncAuthDto) {
    const walletAddress = normalizeAddress(dto.walletAddress);
    // Always trust the verified identity from JWT rather than trusting client-supplied privyDid
    const privyDid = authUser.privyDid;

    if (
      authUser.tokenWalletVerified &&
      authUser.walletAddress &&
      normalizeAddress(authUser.walletAddress) !== walletAddress
    ) {
      throw new ForbiddenException(
        'Cannot link a different wallet address than verified token identity',
      );
    }

    const email = authUser.email || dto.email || null;
    const defaultDisplayName =
      dto.displayName ||
      (email ? email.split('@')[0] : `Builder ${walletAddress.slice(0, 6)}`);

    const existingWallet = await this.prisma.wallet.findUnique({
      where: { address: walletAddress },
      include: { user: true },
    });

    let userId: string;

    if (existingWallet) {
      if (existingWallet.user.privyDid !== privyDid) {
        throw new ConflictException(
          'Wallet address is already linked to another account',
        );
      }
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

      await this.prisma.wallet.create({
        data: {
          userId,
          address: walletAddress,
          walletClientType:
            authUser.authType === 'siwe' ? 'external_siwe' : 'privy',
          isPrimary: true,
        },
      });
    }

    await this.prisma.circleMember.updateMany({
      where: { memberAddress: walletAddress, userId: null },
      data: { userId },
    });

    return this.usersService.getUserProfileById(userId, walletAddress);
  }
}
