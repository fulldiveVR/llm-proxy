import { Module } from "@nestjs/common";
import { LLMProxyService } from "./llm-proxy.service";
import { LLMProxyController } from "./llm-proxy.controller";
import { EmbeddingsController } from "./embeddings.controller";
import { LLMProxyConfig } from "./llm-proxy.config";
import { TokenAnalyticsModule } from "../token-analytics";
import { AuthGuard } from "../auth";

@Module({
  imports: [TokenAnalyticsModule],
  controllers: [LLMProxyController, EmbeddingsController],
  providers: [
    LLMProxyConfig,
    LLMProxyService,
    AuthGuard,
  ],
  exports: [LLMProxyService],
})
export class LLMProxyModule {}