import { Module } from "@nestjs/common"

import { InfrastructureModule } from "./infrastructure"
import { TokenAnalyticsModule } from "./token-analytics"
import { LLMProxyModule } from "./llm-proxy"
import { AuthModule } from "./auth"
import { UserModule } from "./user"
import { CreditsModule } from "./credits/credits.module"

@Module({
  imports: [
    InfrastructureModule,
    TokenAnalyticsModule,
    AuthModule,
    UserModule,
    LLMProxyModule,
    CreditsModule,
  ],
})
export class AppModule {}
