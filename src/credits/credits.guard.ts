import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UseGuards } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthGuard } from '../auth/auth.guard';

@Injectable()
export class CreditsGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
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

export function UseAuthAndCreditsGuard(): MethodDecorator {
  return UseGuards(AuthGuard, CreditsGuard);
}