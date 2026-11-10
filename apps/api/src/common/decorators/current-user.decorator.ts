import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@avahui/shared';

export interface AuthenticatedUser {
  id?: string;
  privyDid: string;
  email?: string | null;
  walletAddress?: string | null;
  role?: UserRole;
  authType?: 'privy' | 'siwe' | 'dev_mock';
  tokenWalletVerified?: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    return data ? user?.[data] : user;
  },
);
