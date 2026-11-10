import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@avahui/shared';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    const effectiveRole = user?.role ?? UserRole.MEMBER;

    if (!user || !requiredRoles.includes(effectiveRole)) {
      throw new ForbiddenException(
        `Required role (${requiredRoles.join(' | ')}) not satisfied`,
      );
    }

    return true;
  }
}

