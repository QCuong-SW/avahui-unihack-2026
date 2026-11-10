import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TokenVerifierService } from '../modules/auth/services/token-verifier.service';
import { resolveAuthenticatedRequestUser } from './privy-auth.guard';

@Injectable()
export class OptionalAuthGuard implements CanActivate {
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
      false,
    );
    if (authUser) {
      request.user = authUser;
    }
    return true;
  }
}

