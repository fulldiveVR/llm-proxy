import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UseGuards } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthGuard } from '../auth/auth.guard';
import { LLMProxyConfig } from '../llm-proxy/llm-proxy.config';

@Injectable()
export class SpecialUserCreditsGuard implements CanActivate {
    constructor(private readonly llmProxyConfig: LLMProxyConfig) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.id) {
            throw new ForbiddenException('User not authenticated');
        }

        const specialUsersConfig = this.llmProxyConfig.specialUsers;
        const isSpecialUser = specialUsersConfig.userIds.includes(user.id);

        if (isSpecialUser) {
            // Special user - validate model restrictions instead of credits
            this.validateSpecialUserModel(request, specialUsersConfig);
            return true;
        } else {
            // Regular user - check credits
            const hasActiveCredits = UserService.hasActiveCredits(user);
            if (!hasActiveCredits) {
                throw new ForbiddenException('User has no active credits');
            }
            return true;
        }
    }

    private validateSpecialUserModel(request: any, specialUsersConfig: any): void {
        const requestBody = request.body;
        const requestModel = requestBody?.model;

        if (!requestModel) {
            throw new ForbiddenException('Model is required for special users');
        }

        const allowedModels = specialUsersConfig.allowedModels;

        if (!allowedModels.includes(requestModel)) {
            throw new ForbiddenException(
                `Special user can only use the following models: ${allowedModels.join(', ')}`
            );
        }
    }
}

/**
 * Combined guard decorator that applies both authentication and special user credits logic
 */
export function UseAuthAndSpecialUserCreditsGuard(): MethodDecorator {
    return UseGuards(AuthGuard, SpecialUserCreditsGuard);
}