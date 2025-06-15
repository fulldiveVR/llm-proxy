import { Injectable, Logger, Inject } from "@nestjs/common";
import { generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { TokenAnalyticsService } from "../token-analytics";
import { 
  ILLMRequest, 
  ChatCompletionResponseDto, 
  ChatCompletionChunkDto 
} from "./llm-proxy.models";
import { LLMProxyConfig } from "./llm-proxy.config";
import { ITokenAnalyticsInputRequest, ITokenAnalyticsInputResponse } from "../token-analytics";

@Injectable()
export class LLMProxyService {
  private readonly logger = new Logger(LLMProxyService.name);
  private readonly openaiProvider;
  private readonly anthropicProvider;
  private readonly vertexProvider;

  constructor(
    @Inject("CONFIG") private config: LLMProxyConfig,
    private tokenAnalytics: TokenAnalyticsService
  ) {
    this.logger.log('✅ LLM Proxy Service initialized successfully');
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

  /**
   * Automatically detect provider based on model name
   */
  private detectProvider(model: string): "openai" | "anthropic" | "vertex" {
    const modelLower = model.toLowerCase();
    
    // Anthropic models
    if (modelLower.includes('claude')) {
      return 'anthropic';
    }
    
    // Vertex AI models  
    if (modelLower.includes('gemini') || modelLower.includes('vertex')) {
      return 'vertex';
    }
    
    // Default to OpenAI for GPT models and others
    return 'openai';
  }

  async generateResponse(request: ILLMRequest): Promise<ChatCompletionResponseDto> {
    const { messages, model, temperature, max_tokens, user } = request;
    
    // Auto-detect provider if not specified
    const provider = request.provider || this.detectProvider(model);
    const selectedProvider = this.getProvider(provider);
    const selectedModel = model || this.getDefaultModel(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Generation - ${provider}/${selectedModel}`,
      generationName: "llm-generation",
      userId: user || "anonymous",
      model: selectedModel,
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature,
    };

    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    try {
      // Use Vercel AI SDK to generate text
      const result = await generateText({
        model: selectedProvider(selectedModel),
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature,
        maxTokens: max_tokens,
      });

      // Format response in OpenAI API format
      const response: ChatCompletionResponseDto = {
        id: `chatcmpl-${Date.now()}${Math.random().toString(36).substring(2, 15)}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: selectedModel,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: result.text,
          },
          finish_reason: result.finishReason || "stop",
        }],
        usage: {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: result.usage.totalTokens,
        },
      };

      // End analytics session
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: {
          content: result.text,
          finishReason: result.finishReason,
        },
        usage: { totalTokens: result.usage.totalTokens },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

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

  async *generateStreamingResponse(request: ILLMRequest): AsyncGenerator<ChatCompletionChunkDto, void, unknown> {
    const { messages, model, temperature, max_tokens, user } = request;
    
    // Auto-detect provider if not specified
    const provider = request.provider || this.detectProvider(model);
    const selectedProvider = this.getProvider(provider);
    const selectedModel = model || this.getDefaultModel(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Streaming - ${provider}/${selectedModel}`,
      generationName: "llm-streaming",
      userId: user || "anonymous",
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
        maxTokens: max_tokens,
      });

      let fullContent = '';
      let totalTokens = 0;
      const chatId = `chatcmpl-${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
      const created = Math.floor(Date.now() / 1000);

      for await (const delta of result.textStream) {
        fullContent += delta;
        
        // Format chunk in OpenAI API format
        const chunk: ChatCompletionChunkDto = {
          id: chatId,
          object: "chat.completion.chunk",
          created,
          model: selectedModel,
          choices: [{
            index: 0,
            delta: {
              role: "assistant",
              content: delta,
            },
            finish_reason: null,
          }],
        };
        
        yield chunk;
      }

      // Send final chunk with finish_reason
      const finalChunk: ChatCompletionChunkDto = {
        id: chatId,
        object: "chat.completion.chunk",
        created,
        model: selectedModel,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "stop",
        }],
      };
      
      yield finalChunk;

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