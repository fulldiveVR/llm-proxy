import { Injectable } from "@nestjs/common";
import { IConfig } from "../infrastructure";

export interface ILLMProxyConfig {
  openai: {
    apiKey: string;
  };
  anthropic: {
    apiKey: string;
  };
  vertex: {
    projectId: string;
    location: string;
  };
  openrouter: {
    apiKey: string;
    baseUrl?: string;
  };
}

@Injectable()
export class LLMProxyConfig implements ILLMProxyConfig {
  constructor(private readonly config: IConfig) {}

  get openai() {
    return {
      apiKey: this.config.get<string>("llmProxy.openai.apiKey"),
    };
  }

  get anthropic() {
    return {
      apiKey: this.config.get<string>("llmProxy.anthropic.apiKey"),
    };
  }

  get vertex() {
    return {
      projectId: this.config.get<string>("llmProxy.vertex.projectId"),
      location: this.config.get<string>("llmProxy.vertex.location") || "us-central1",
      clientEmail: this.config.get<string>("llmProxy.vertex.clientEmail"),
      privateKey: this.config.get<string>("llmProxy.vertex.privateKey"),
    };
  }

  get openrouter() {
    return {
      apiKey: this.config.get<string>("llmProxy.openrouter.apiKey"),
      baseUrl: this.config.get<string>("llmProxy.openrouter.baseUrl") || "https://openrouter.ai/api/v1",
    };
  }
}