import { Global, Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"

import { ConfigModule } from "../infrastructure"

import { AuthConfig } from "./auth.config"
import { AuthService, IAuthService } from "./auth.service"

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(AuthConfig, "auth")],
      inject: [AuthConfig],
      useFactory: async (config: AuthConfig) => ({
        secret: config.jwtSecret,
      }),
    }),
  ],
  providers: [AuthService, { provide: IAuthService, useExisting: AuthService }],
  exports: [IAuthService],
})
@Global()
export class AuthModule {}
