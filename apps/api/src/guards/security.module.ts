import { Global, Module } from '@nestjs/common';
import { TokenVerifierService } from '../modules/auth/services/token-verifier.service';
import { PrivyAuthGuard } from './privy-auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [
    TokenVerifierService,
    PrivyAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
  exports: [
    TokenVerifierService,
    PrivyAuthGuard,
    OptionalAuthGuard,
    RolesGuard,
  ],
})
export class SecurityModule {}

