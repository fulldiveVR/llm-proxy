import { Injectable, Logger } from "@nestjs/common";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { TokenAnalyticsService } from "../token-analytics";
import { ILLMRequest, ILLMResponse } from "./llm-proxy.models";
import { LLMProxyConfig } from "./llm-proxy.config";
import { ITokenAnalyticsInputRequest, ITokenAnalyticsInputResponse } from "../token-analytics";

@Injectable()
export class LLMProxyService {
  private readonly logger = new Logger(LLMProxyService.name);
  private readonly openaiProvider;
  private readonly anthropicProvider;
  private readonly vertexProvider;

  constructor(
    private readonly tokenAnalytics: TokenAnalyticsService,
    private readonly config: LLMProxyConfig
  ) {
    this.openaiProvider = createOpenAI({
      apiKey: this.config.openai.apiKey,
    });

    this.anthropicProvider = createAnthropic({
      apiKey: this.config.anthropic.apiKey,
    });

    this.vertexProvider = createVertex({
      project: this.config.vertex.projectId,
      location: this.config.vertex.location,
    });
  }

  private getProvider(provider: "openai" | "anthropic" | "vertex" = "openai") {
    switch (provider) {
      case "openai":
        return this.openaiProvider;
      case "anthropic":
        return this.anthropicProvider;
      case "vertex":
        return this.vertexProvider;
      default:
        return this.openaiProvider;
    }
  }

  private getDefaultModel(provider: "openai" | "anthropic" | "vertex" = "openai"): string {
    switch (provider) {
      case "openai":
        return this.config.openai.defaultModel;
      case "anthropic":
        return this.config.anthropic.defaultModel;
      case "vertex":
        return this.config.vertex.defaultModel;
      default:
        return this.config.openai.defaultModel;
    }
  }

  async generateResponse(request: ILLMRequest): Promise<ILLMResponse> {
    const { messages, model, provider = "openai", temperature, maxTokens, userId } = request;
    
    const selectedProvider = this.getProvider(provider);
    const selectedModel = model || this.getDefaultModel(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Generation - ${provider}/${selectedModel}`,
      generationName: "llm-generation",
      userId,
      model: selectedModel,
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature,
    };

    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    try {
      this.logger.log(`Generating response with provider: ${provider}, model: ${selectedModel}`);

      // Use Vercel AI SDK to generate text
      const result = await generateText({
        model: selectedProvider(selectedModel),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature,
        maxTokens,
      });

      const usage = {
        totalTokens: result.usage.totalTokens,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
      };

      const response: ILLMResponse = {
        content: result.text,
        model: selectedModel,
        usage,
        finishReason: result.finishReason,
      };

      // End analytics session
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: {
          content: result.text,
          finishReason: result.finishReason,
        },
        usage: { totalTokens: usage.totalTokens },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

      this.logger.log(`Successfully generated response. Tokens used: ${usage.totalTokens}`);

      return response;
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`, error.stack);
      
      // End analytics session with error
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: error.message },
        usage: { totalTokens: 0 },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      
      throw error;
    }
  }

  async *generateStreamingResponse(request: ILLMRequest): AsyncGenerator<string, void, unknown> {
    const { messages, model, provider = "openai", temperature, maxTokens, userId } = request;
    
    const selectedProvider = this.getProvider(provider);
    const selectedModel = model || this.getDefaultModel(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Streaming - ${provider}/${selectedModel}`,
      generationName: "llm-streaming",
      userId,
      model: selectedModel,
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature,
    };

    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    try {
      this.logger.log(`Starting streaming response with provider: ${provider}, model: ${selectedModel}`);

      // Use Vercel AI SDK to stream text
      const result = await streamText({
        model: selectedProvider(selectedModel),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature,
        maxTokens,
      });

      let fullContent = '';
      let totalTokens = 0;

      for await (const delta of result.textStream) {
        fullContent += delta;
        yield delta;
      }

      // Get final usage information
      const finalResult = await result.usage;
      if (finalResult) {
        totalTokens = finalResult.totalTokens;
      }

      // End analytics session
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: {
          content: fullContent,
          streaming: true,
        },
        usage: { totalTokens },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

      this.logger.log(`Successfully completed streaming response. Tokens used: ${totalTokens}`);

    } catch (error) {
      this.logger.error(`Error in streaming response: ${error.message}`, error.stack);
      
      // End analytics session with error
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: error.message },
        usage: { totalTokens: 0 },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      
      throw error;
    }
  }
}