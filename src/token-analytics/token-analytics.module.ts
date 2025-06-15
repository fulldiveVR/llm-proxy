import { Module } from "@nestjs/common";
import Langfuse from "langfuse";
import { TokenAnalyticsService } from "./token-analytics.service";
import { TokenAnalyticsParser } from "./token-analytics.parser";
import { TokenAnalyticsConfig } from "./token-analytics.config";

@Module({
  providers: [
    TokenAnalyticsConfig,
    {
      provide: 'ITokenAnalyticsParser',
      useClass: TokenAnalyticsParser,
    },
    {
      provide: Langfuse,
      useFactory: (config: TokenAnalyticsConfig) => {
        return new Langfuse({
          secretKey: config.langfuse.secretKey,
          publicKey: config.langfuse.publicKey,
          baseUrl: config.langfuse.baseUrl,
        });
      },
      inject: [TokenAnalyticsConfig],
    },
    TokenAnalyticsService,
  ],
  exports: [TokenAnalyticsService],
})
export class TokenAnalyticsModule {}