import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UseGuards } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { AuthGuard } from '../auth/auth.guard';
import { LLMProxyConfig } from '../llm-proxy/llm-proxy.config';

@Injectable()
export class CreditsByModelsGuard implements CanActivate {
    constructor(private readonly llmProxyConfig: LLMProxyConfig) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.id) {
            throw new ForbiddenException('User not authenticated');
        }

        const freeModelsConfig = this.llmProxyConfig.freeModels;
        const hasActiveCredits = UserService.hasActiveCredits(user);

        if (hasActiveCredits) {
            // User with active credits can use any model
            return true;
        } else {
            // User without credits can only use models from allowedModels
            this.validateModelAccess(request, freeModelsConfig);
            return true;
        }
    }

    private validateModelAccess(request: any, freeModelsConfig: any): void {
        const requestBody = request.body;
        const requestModel = requestBody?.model;

        if (!requestModel) {
            throw new ForbiddenException('Model is required for users without subscription');
        }

        const allowedModels: string[] = freeModelsConfig.allowedModels;

        if (!allowedModels.includes(requestModel)) {
            // Replace with default free model instead of throwing error
            const defaultFreeModel = allowedModels[0];
            requestBody.model = defaultFreeModel;
            console.log(`User without subscription requested ${requestModel}, replaced with ${defaultFreeModel}`);
        }
    }

}

/**
 * Combined guard decorator that applies both authentication and credits by models logic
 */
export function UseAuthAndCreditsByModelsGuard(): MethodDecorator {
    return UseGuards(AuthGuard, CreditsByModelsGuard);
}
