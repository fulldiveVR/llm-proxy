import { Module, Logger } from "@nestjs/common";
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
        const langfuseConfig = config.langfuse;
        
        return new Langfuse({
          secretKey: langfuseConfig.secretKey,
          publicKey: langfuseConfig.publicKey,
          baseUrl: langfuseConfig.baseUrl,
        });
      },
      inject: [TokenAnalyticsConfig],
    },
    TokenAnalyticsService,
  ],
  exports: [TokenAnalyticsService],
})
export class TokenAnalyticsModule {}