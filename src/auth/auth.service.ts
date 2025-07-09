import { Injectable, Scope } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"

import { InvalidAccessTokenError } from "../lib"
import { IUserService } from "../user"

import { AuthorizedUser } from "./auth.models"

export abstract class IAuthService {
  abstract authenticate(accessToken?: string): Promise<AuthorizedUser>
}

@Injectable({ scope: Scope.TRANSIENT })
export class AuthService implements IAuthService {
  public constructor(private readonly jwtService: JwtService, private readonly userService: IUserService) {}

  public async authenticate(accessToken?: string): Promise<AuthorizedUser> {
    if (!accessToken) {
      throw new InvalidAccessTokenError()
    }

    try {
      const payload = this.jwtService.verify(accessToken)
      return await this.userService.getUser(payload.id)
    } catch (error) {
      throw new InvalidAccessTokenError()
    }
  }
}
