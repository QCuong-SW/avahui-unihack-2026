import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@avahui/shared';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { normalizeAddress } from '../common/utils/format.util';
import { TokenVerifierService } from '../modules/auth/services/token-verifier.service';

export async function resolveAuthenticatedRequestUser(
  request: any,
  prisma: PrismaService,
  tokenVerifier: TokenVerifierService,
  required: boolean,
): Promise<AuthenticatedUser | undefined> {
  const authHeader: string | undefined = request.headers?.['authorization'];
  const devWalletHeader: string | undefined =
    request.headers?.['x-wallet-address'];

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token && tokenVerifier.isDevMockAuthAllowed()) {
    token = 'dev-token-usr_01HXYZ1';
  }

  if (!token) {
    if (required) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    return undefined;
  }

  const verified = await tokenVerifier.verifyAccessToken(token, devWalletHeader);
  if (!verified) {
    if (required) {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
    return undefined;
  }

  const walletAddr = verified.walletAddress
    ? normalizeAddress(verified.walletAddress)
    : null;

  let dbUser = await prisma.user.findUnique({
    where: { privyDid: verified.privyDid },
    include: { wallets: true },
  });

  if (!dbUser && walletAddr && verified.tokenWalletVerified) {
    const existingWallet = await prisma.wallet.findUnique({
      where: { address: walletAddr },
      include: { user: { include: { wallets: true } } },
    });
    if (existingWallet?.user) {
      dbUser = existingWallet.user;
    }
  }

  if (dbUser && dbUser.isActive === false) {
    throw new ForbiddenException('Account has been suspended');
  }

  const primaryWallet =
    dbUser?.wallets?.find((w) => w.isPrimary)?.address ??
    dbUser?.wallets?.[0]?.address ??
    null;

  return {
    id: dbUser?.id,
    privyDid: dbUser?.privyDid ?? verified.privyDid,
    email: dbUser?.email ?? verified.email,
    walletAddress: walletAddr ?? primaryWallet,
    role: ((dbUser?.role as UserRole | undefined) ??
      verified.role ??
      UserRole.MEMBER) as UserRole,
    authType: verified.authType,
    tokenWalletVerified: verified.tokenWalletVerified,
  };
}

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  private readonly verifier: TokenVerifierService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() tokenVerifier?: TokenVerifierService,
  ) {
    this.verifier = tokenVerifier ?? new TokenVerifierService();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authUser = await resolveAuthenticatedRequestUser(
      request,
      this.prisma,
      this.verifier,
      true,
    );
    request.user = authUser;
    return true;
  }
}
