import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UseGuards,
  applyDecorators,
  createParamDecorator,
} from "@nestjs/common"
import { Request } from "express"
import { ApiBearerAuth } from "@nestjs/swagger"

import { IAuthService } from "./auth.service"
import { AuthorizedUser } from "./auth.models"

interface IUserRequest extends Request {
  user: AuthorizedUser
}

const getAccessToken = (ctx: ExecutionContext): string => {
  const { headers } = ctx.switchToHttp().getRequest() as IUserRequest
  const [, accessToken] = headers.authorization?.split(" ") || []
  return accessToken
}

@Injectable()
export class AuthGuard implements CanActivate {
  public constructor(private readonly authService: IAuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as IUserRequest

    const accessToken = getAccessToken(context)
    request.user = await this.authService.authenticate(accessToken)

    return true
  }
}

export function UseAuthGuard(): MethodDecorator {
  return applyDecorators(UseGuards(AuthGuard), ApiBearerAuth())
}

export const AuthUser = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthorizedUser => {
  const { user } = ctx.switchToHttp().getRequest()
  return user
})

export const AccessToken = createParamDecorator((data: unknown, ctx: ExecutionContext): string => getAccessToken(ctx))
