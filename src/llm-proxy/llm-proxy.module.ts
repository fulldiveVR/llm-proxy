import { Module } from "@nestjs/common";
import { LLMProxyService } from "./llm-proxy.service";
import { LLMProxyController } from "./llm-proxy.controller";
import { EmbeddingsController } from "./embeddings.controller";
import { LLMProxyConfig } from "./llm-proxy.config";
import { TokenAnalyticsModule } from "../token-analytics";
import { AuthGuard } from "../auth";
import { CreditsByModelsGuard } from "../credits";
import { ModelsRepository } from "../models/models.repository";

@Module({
  imports: [TokenAnalyticsModule],
  controllers: [LLMProxyController, EmbeddingsController],
  providers: [
    LLMProxyConfig,
    LLMProxyService,
    ModelsRepository,
    AuthGuard,
    CreditsByModelsGuard,
  ],
  exports: [LLMProxyService],
})
export class LLMProxyModule { }