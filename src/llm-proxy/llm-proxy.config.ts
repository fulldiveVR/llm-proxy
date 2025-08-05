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
  specialUsers: {
    userIds: string[];
    allowedModels: string[];
  };
}

@Injectable()
export class LLMProxyConfig implements ILLMProxyConfig {
  constructor(private readonly config: IConfig) { }

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

  get specialUsers() {
    // Get raw config values
    const rawUserIds = this.config.get<any>("llmProxy.specialUsers.userIds");
    const rawAllowedModels = this.config.get<any>("llmProxy.specialUsers.allowedModels");

    // Parse userIds
    let userIds: string[] = [];
    if (Array.isArray(rawUserIds)) {
      userIds = rawUserIds;
    } else if (typeof rawUserIds === 'string') {
      try {
        userIds = JSON.parse(rawUserIds);
      } catch (e) {
        console.error('Failed to parse userIds as JSON:', e);
        userIds = rawUserIds.split(',').map(id => id.trim());
      }
    }

    // Parse allowedModels
    let allowedModels: string[] = ["openrouter/google/gemma-3-4b-it", "text-embedding-3-small"];
    if (Array.isArray(rawAllowedModels)) {
      allowedModels = rawAllowedModels;
    } else if (typeof rawAllowedModels === 'string') {
      try {
        allowedModels = JSON.parse(rawAllowedModels);
      } catch (e) {
        console.error('Failed to parse allowedModels as JSON:', e);
        allowedModels = rawAllowedModels.split(',').map(model => model.trim());
      }
    }

    console.log('Parsed userIds:', userIds);
    console.log('Parsed allowedModels:', allowedModels);

    return {
      userIds,
      allowedModels,
    };
  }
}