import { ExecutionContext, ForbiddenException, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../user/user.service';

export const REQUIRE_ACTIVE_CREDITS_KEY = 'requireActiveCredits';

// Metadata decorator to mark methods that require active credits
export const RequireActiveCredits = () => SetMetadata(REQUIRE_ACTIVE_CREDITS_KEY, true);

// Guard to check active credits
export class ActiveCreditsGuard {
  constructor(
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireActiveCredits = this.reflector.getAllAndOverride<boolean>(REQUIRE_ACTIVE_CREDITS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireActiveCredits) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasActiveCredits = UserService.hasActiveCredits(user);

    if (!hasActiveCredits) {
      throw new ForbiddenException('User has no active credits');
    }

    return true;
  }
}

// Combined decorator for convenience
export const UseCreditsGuard = () => UseGuards(ActiveCreditsGuard);