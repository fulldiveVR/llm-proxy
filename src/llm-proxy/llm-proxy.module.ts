import { Module } from "@nestjs/common";
import { LLMProxyService } from "./llm-proxy.service";
import { LLMProxyController } from "./llm-proxy.controller";
import { LLMProxyConfig } from "./llm-proxy.config";
import { TokenAnalyticsModule } from "../token-analytics";

@Module({
  imports: [TokenAnalyticsModule],
  controllers: [LLMProxyController],
  providers: [
    LLMProxyConfig,
    LLMProxyService,
  ],
  exports: [LLMProxyService],
})
export class LLMProxyModule {}