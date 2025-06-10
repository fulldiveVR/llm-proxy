import { Injectable } from "@nestjs/common";
import { IConfig } from "../infrastructure";

export interface ITokenAnalyticsConfig {
  langfuse: {
    secretKey: string;
    publicKey: string;
    baseUrl?: string;
  };
}

@Injectable()
export class TokenAnalyticsConfig implements ITokenAnalyticsConfig {
  constructor(private readonly config: IConfig) {}

  get langfuse() {
    return {
      secretKey: this.config.get<string>("tokenAnalytics.langfuse.secretKey"),
      publicKey: this.config.get<string>("tokenAnalytics.langfuse.publicKey"),
      baseUrl: this.config.get<string>("tokenAnalytics.langfuse.baseUrl"),
    };
  }
}