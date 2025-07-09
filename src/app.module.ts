import { Module } from "@nestjs/common"

import { InfrastructureModule } from "./infrastructure"
import { TokenAnalyticsModule } from "./token-analytics"
import { LLMProxyModule } from "./llm-proxy"
import { AuthModule } from "./auth"
import { UserModule } from "./user"

@Module({
  imports: [
    InfrastructureModule,
    TokenAnalyticsModule,
    AuthModule,
    UserModule,
    LLMProxyModule,
  ],
})
export class AppModule {}
