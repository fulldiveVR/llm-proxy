import { Injectable } from "@nestjs/common";
import { IConfig } from "../infrastructure";

export interface ILLMProxyConfig {
  openai: {
    apiKey: string;
    defaultModel: string;
    maxTokens: number;
  };
  anthropic: {
    apiKey: string;
    defaultModel: string;
    maxTokens: number;
  };
  vertex: {
    projectId: string;
    location: string;
    defaultModel: string;
    maxTokens: number;
  };
}

@Injectable()
export class LLMProxyConfig implements ILLMProxyConfig {
  constructor(private readonly config: IConfig) {}

  get openai() {
    return {
      apiKey: this.config.get<string>("llmProxy.openai.apiKey"),
      defaultModel: this.config.get<string>("llmProxy.openai.defaultModel") || "gpt-4",
      maxTokens: this.config.get<number>("llmProxy.openai.maxTokens") || 2048,
    };
  }

  get anthropic() {
    return {
      apiKey: this.config.get<string>("llmProxy.anthropic.apiKey"),
      defaultModel: this.config.get<string>("llmProxy.anthropic.defaultModel") || "claude-3-5-sonnet-20241022",
      maxTokens: this.config.get<number>("llmProxy.anthropic.maxTokens") || 2048,
    };
  }

  get vertex() {
    return {
      projectId: this.config.get<string>("llmProxy.vertex.projectId"),
      location: this.config.get<string>("llmProxy.vertex.location") || "us-central1",
      defaultModel: this.config.get<string>("llmProxy.vertex.defaultModel") || "gemini-1.5-pro",
      maxTokens: this.config.get<number>("llmProxy.vertex.maxTokens") || 2048,
    };
  }
}