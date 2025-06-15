import { Module } from "@nestjs/common"

import { InfrastructureModule } from "./infrastructure"
import { TokenAnalyticsModule } from "./token-analytics"
import { LLMProxyModule } from "./llm-proxy"

@Module({
  imports: [
    InfrastructureModule,
    TokenAnalyticsModule,
    LLMProxyModule,
  ],
})
export class AppModule {}
