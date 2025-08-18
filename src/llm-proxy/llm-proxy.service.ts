import { Injectable, Logger } from "@nestjs/common";
// import { generateText, streamText, generateObject, streamObject, embed, embedMany, ToolSet, ToolChoice, CoreMessage } from "ai";
import { Buffer } from "buffer";
import OpenAI from 'openai';
import { TokenAnalyticsService } from "../token-analytics";
import { 
  ILLMRequest, 
  ChatCompletionResponseDto, 
  ChatCompletionChunkDto, 
  ModelProvider,
  IEmbeddingRequest,
  EmbeddingResponseDto
} from "./llm-proxy.models";
import { LLMProxyConfig } from "./llm-proxy.config";
import { ITokenAnalyticsInputRequest, ITokenAnalyticsInputResponse } from "../token-analytics";
import {
  mapFinishReason,
} from "../utils";
import { jsonSchemaToZod } from "../utils/json-schema-to-zod";
import { ModelsRepository } from "../models/models.repository";

@Injectable()
export class LLMProxyService {
  private readonly logger = new Logger(LLMProxyService.name);
  private readonly openaiClient: OpenAI;
  private readonly openrouterClient: OpenAI;

  constructor(
    private config: LLMProxyConfig,
    private tokenAnalytics: TokenAnalyticsService,
    private modelsRepository: ModelsRepository,
  ) {
    this.logger.log('✅ LLM Proxy Service initialized successfully');
    this.openaiClient = new OpenAI({
      apiKey: this.config.openai.apiKey,
    });

    this.openrouterClient = new OpenAI({
      apiKey: this.config.openrouter.apiKey,
      baseURL: this.config.openrouter.baseUrl,
    });
  }

  private getProvider(provider: ModelProvider = ModelProvider.OpenAI) {
    switch (provider) {
      case ModelProvider.OpenAI:
        return this.openaiClient;
      case ModelProvider.OpenRouter:
        return this.openrouterClient;
      default:
        return this.openrouterClient;
    }
  }

  /**
   * Resolve provider and model from request
   */
  private async resolveProviderAndModel(modelId: string, requestProvider?: ModelProvider) {
    // Fetch model definition from MongoDB
    const dbModel = await this.modelsRepository.getById(modelId);
 
    if (!dbModel) {
      throw new Error(`Model "${modelId}" not found`);
    }
 
    return {
      provider: dbModel.provider,
      model: dbModel.id,
      openrouterCustomProvider: dbModel.openrouterCustomProvider,
      fallbackModels: dbModel.fallbackModels,
    };
  }

  async generateResponse(request: ILLMRequest): Promise<ChatCompletionResponseDto> {
    const { messages, model, temperature, max_tokens, user, tools, tool_choice, response_format } = request;
    
    const { provider, model: actualModel, fallbackModels, openrouterCustomProvider } = await this.resolveProviderAndModel(model, request.provider);
    const client = this.getProvider(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Generation - ${provider}/${actualModel}`,
      generationName: "llm-generation",
      userId: user || "anonymous",
      model: actualModel,
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature,
    };

    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    // Combine primary model with fallbacks
    const candidateModels = [actualModel, ...(fallbackModels || [])];

    let response: ChatCompletionResponseDto | null = null;
    let lastError: any;
    for (const candidate of candidateModels) {
      try {
        response = await client.chat.completions.create({
          model: candidate,
        // @ts-ignore
          models: fallbackModels,
          messages: messages as any,
          temperature,
          provider: openrouterCustomProvider,
          max_tokens,
          ...(tools && { tools }),
          ...(tool_choice && { tool_choice }),
          ...(response_format && { response_format }),
        }) as ChatCompletionResponseDto;
        break; // success
      } catch (err) {
        this.logger.warn(`Model ${candidate} failed with error: ${err.message}`);
        lastError = err;
        continue; // try next fallback model
      }
    }

    if (!response) {
      // End analytics with error and rethrow
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: lastError?.message || "Unknown error" },
        usage: { input: 0, output: 0, total: 0 },
      };
      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      throw lastError || new Error("Failed to generate response with all candidate models");
    }

    // End analytics session with success
    const analyticsResponse: ITokenAnalyticsInputResponse = {
      output: {
        content: response.choices[0].message.content || '',
        finishReason: mapFinishReason(response.choices[0].finish_reason || undefined),
      },
      usage: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
    await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

    return response;
  }

  async *generateStreamingResponse(request: ILLMRequest): AsyncGenerator<ChatCompletionChunkDto, void, unknown> {
    const { messages, model, temperature, max_tokens, user, tools, tool_choice, response_format } = request;
    
    const { provider, model: actualModel, fallbackModels, openrouterCustomProvider } = await this.resolveProviderAndModel(model, request.provider);
    const client = this.getProvider(provider);

    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Streaming - ${provider}/${actualModel}`,
      generationName: "llm-streaming",
      userId: user || "anonymous",
      model: actualModel,
      input: messages.map(msg => ({ role: msg.role, content: msg.content })),
      temperature,
    };
    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    // Attempt primary + fallback models for streaming
    const candidateModels = [actualModel, ...(fallbackModels || [])];
    let stream: AsyncIterable<ChatCompletionChunkDto> | null = null;
    let lastError: any;
    let usedModel = actualModel;

    for (const candidate of candidateModels) {
      try {
        // @ts-ignore
        stream = await client.chat.completions.create({
          model: candidate,
          models: fallbackModels,
          messages: messages as any,
          temperature,
          max_tokens,
          provider: openrouterCustomProvider,
          stream: true,
          ...(tools && { tools }),
          ...(tool_choice && { tool_choice }),
          ...(response_format && { response_format }),
        }) as unknown as AsyncIterable<ChatCompletionChunkDto>;
        usedModel = candidate;
        break;
      } catch (err) {
        this.logger.warn(`Streaming with model ${candidate} failed: ${err.message}`);
        lastError = err;
        continue;
      }
    }

    if (!stream) {
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: lastError?.message || "Unknown error" },
        usage: { input: 0, output: 0, total: 0 },
      };
      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      throw lastError || new Error("Failed to initiate streaming response with all candidate models");
    }

    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    try {
      for await (const chunk of stream) {
        // Accumulate content if present
        const deltaContent = chunk.choices?.[0]?.delta?.content;
        if (deltaContent) {
          fullContent += deltaContent;
        }

        // Capture usage data when available (typically only final chunk)
        if ((chunk as any).usage) {
          promptTokens = (chunk as any).usage.prompt_tokens || 0;
          completionTokens = (chunk as any).usage.completion_tokens || 0;
          totalTokens = (chunk as any).usage.total_tokens || 0;
        }

        // Yield chunk to caller
        yield chunk;
      }


      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { content: fullContent, streaming: true },
        usage: { input: promptTokens, output: completionTokens, total: totalTokens },
      };
      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
    } catch (error) {
      this.logger.error(`Error in streaming response: ${error.message}`, error.stack);
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: error.message },
        usage: { input: 0, output: 0, total: 0 },
      };
      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      throw error;
    }
  }

  /**
   * Generate embeddings for the given request (OpenAI compatible)
   */
  async generateEmbeddings(request: IEmbeddingRequest): Promise<EmbeddingResponseDto> {
    const { input, model, user, encoding_format, dimensions } = request;

    const { provider, model: actualModel, fallbackModels } = await this.resolveProviderAndModel(model, request.provider);
    const client: any = this.getProvider(provider);

    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Embedding - ${provider}/${actualModel}`,
      generationName: "llm-embedding",
      userId: user || "anonymous",
      model: actualModel,
      input: Array.isArray(input)
        ? (input as any[]).map((val, idx) => ({ role: `input-${idx}`, content: val as any }))
        : [{ role: "input", content: input as any }],
    };
    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    try {
      const embeddingResponse = await client.embeddings.create({
        model: actualModel,
        input: input as any,
        ...(encoding_format && { encoding_format }),
        ...(dimensions && { dimensions }),
        ...(user && { user }),
      }) as EmbeddingResponseDto;

      const tokensUsed = embeddingResponse.usage?.total_tokens || embeddingResponse.usage?.prompt_tokens || 0;

      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { embeddings: embeddingResponse.data.length },
        usage: { input: tokensUsed, output: 0, total: tokensUsed },
      };
      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

      return embeddingResponse;
    } catch (error) {
      this.logger.error(`Error generating embeddings: ${error.message}`);
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: error.message },
        usage: { input: 0, output: 0, total: 0 },
      };
      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      throw error;
    }
  }
}