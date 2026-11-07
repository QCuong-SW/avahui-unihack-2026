import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { normalizeAddress } from '../common/utils/format.util';

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    const devWalletHeader: string | undefined = request.headers['x-wallet-address'];

    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // In development mode, allow fallback to a default demo user or x-wallet-address header for Swagger convenience
    if (!token && process.env.NODE_ENV !== 'production') {
      token = devWalletHeader || 'dev-token-usr_01HXYZ1';
    }

    if (!token) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const parsed = this.parseTokenPayload(token, devWalletHeader);
    const walletAddr = parsed.walletAddress ? normalizeAddress(parsed.walletAddress) : null;

    // Look up existing user by privyDid or walletAddress
    let dbUser = await this.prisma.user.findUnique({
      where: { privyDid: parsed.privyDid },
      include: { wallets: true },
    });

    if (!dbUser && walletAddr) {
      const existingWallet = await this.prisma.wallet.findUnique({
        where: { address: walletAddr },
        include: { user: { include: { wallets: true } } },
      });
      if (existingWallet?.user) {
        dbUser = existingWallet.user;
      }
    }

    const authUser: AuthenticatedUser = {
      id: dbUser?.id,
      privyDid: dbUser?.privyDid ?? parsed.privyDid,
      email: dbUser?.email ?? parsed.email,
      walletAddress:
        walletAddr ??
        dbUser?.wallets?.find((w) => w.isPrimary)?.address ??
        dbUser?.wallets?.[0]?.address ??
        null,
    };

    request.user = authUser;
    return true;
  }

  private parseTokenPayload(
    token: string,
    devWalletHeader?: string,
  ): { privyDid: string; email?: string; walletAddress?: string } {
    // 1. Check if token is a JWT (3 base64url parts)
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const payload = JSON.parse(payloadJson);
        return {
          privyDid: payload.sub || payload.did || `did:privy:${token.slice(0, 16)}`,
          email: payload.email || undefined,
          walletAddress: payload.wallet_address || devWalletHeader || undefined,
        };
      } catch {
        // Fallback below
      }
    }

    // 2. Check if token is an Ethereum address (0x...)
    if (/^0x[a-fA-F0-9]{40}$/.test(token)) {
      const normalized = normalizeAddress(token);
      return {
        privyDid: `did:privy:wallet_${normalized}`,
        walletAddress: normalized,
      };
    }

    // 3. Default / Dev token mapping to MOCK_CURRENT_USER
    if (token === 'dev-token-usr_01HXYZ1' || token === 'mock-token' || token === 'test') {
      return {
        privyDid: 'did:privy:usr_01HXYZ1',
        email: 'builder@avahui.io',
        walletAddress:
          devWalletHeader || '0x71c95911e9a5d330f4d621842ec243ee13432921',
      };
    }

    return {
      privyDid: token.startsWith('did:privy:') ? token : `did:privy:${token}`,
      walletAddress: devWalletHeader,
    };
  }
}

