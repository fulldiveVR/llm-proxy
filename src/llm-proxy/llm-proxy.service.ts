import { Injectable, Logger } from "@nestjs/common";
import { generateText, streamText, generateObject, streamObject, embed, embedMany, ToolSet, ToolChoice, CoreMessage } from "ai";
import { z } from 'zod';
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { Buffer } from "buffer";
import OpenAI from 'openai';
import { TokenAnalyticsService } from "../token-analytics";
import { 
  ILLMRequest, 
  ChatCompletionResponseDto, 
  ChatCompletionChunkDto, 
  MessageDto,
  ChatMessageContent,
  ModelProvider,
  IEmbeddingRequest,
  EmbeddingResponseDto
} from "./llm-proxy.models";
import { LLMProxyConfig } from "./llm-proxy.config";
import { ITokenAnalyticsInputRequest, ITokenAnalyticsInputResponse } from "../token-analytics";
import {
  convertOpenAIMessagesToAISDK,
  convertAISDKResultToOpenAI,
  convertAISDKChunkToOpenAI,
  generateChatCompletionId,
  mapFinishReason,
  convertOpenAIToolsToAISDK,
  convertOpenAIToolChoiceToAISDK,
  extractModelAndProvider
} from "../utils";
import { jsonSchemaToZod } from "../utils/json-schema-to-zod";

@Injectable()
export class LLMProxyService {
  private readonly logger = new Logger(LLMProxyService.name);
  private readonly openaiProvider;
  private readonly anthropicProvider;
  private readonly vertexProvider;
  private readonly openrouterProvider;
  // Direct OpenAI clients for structured output
  private readonly openrouterClient: OpenAI;

  constructor(
    private config: LLMProxyConfig,
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
      googleAuthOptions: {
        credentials: {
          client_email: this.config.vertex.clientEmail,
          private_key: this.config.vertex.privateKey,
        }
      }
    });

    // OpenRouter uses OpenAI-compatible API but with different base URL
    this.openrouterProvider = createOpenAI({
      apiKey: this.config.openrouter.apiKey,
      baseURL: this.config.openrouter.baseUrl,
    });

    this.openrouterClient = new OpenAI({
      apiKey: this.config.openrouter.apiKey,
      baseURL: this.config.openrouter.baseUrl,
    });
  }

  private getProvider(provider: ModelProvider = ModelProvider.OpenAI) {
    switch (provider) {
      case ModelProvider.OpenAI:
        return this.openaiProvider;
      case ModelProvider.Anthropic:
        return this.anthropicProvider;
      case ModelProvider.Vertex:
        return this.vertexProvider;
      case ModelProvider.OpenRouter:
        return this.openrouterProvider;
      default:
        return this.openaiProvider;
    }
  }

  /**
   * Resolve provider and model from request
   */
  private resolveProviderAndModel(model: string, requestProvider?: ModelProvider) {
    if (requestProvider) {
      return { provider: requestProvider, model };
    }
    
    const extracted = extractModelAndProvider(model);

    return {
      provider: (extracted.provider as ModelProvider),
      model: extracted.model
    };
  }

  async generateResponse(request: ILLMRequest): Promise<ChatCompletionResponseDto> {
    const { messages, model, temperature, max_tokens, user, tools, tool_choice, response_format } = request;
    
    // Resolve provider and model
    const { provider, model: actualModel } = this.resolveProviderAndModel(model, request.provider);
    const selectedProvider = this.getProvider(provider);

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

    try {
      // Convert OpenAI tools to AI SDK format
      const aiSDKTools = request.tools ? convertOpenAIToolsToAISDK(request.tools) : undefined;
      
      // Convert OpenAI tool_choice to AI SDK format
      const aiSDKToolChoice = request.tool_choice ? convertOpenAIToolChoiceToAISDK(request.tool_choice) : undefined;
      
      // Convert messages to AI SDK format
      const aiSDKMessages = convertOpenAIMessagesToAISDK(request.messages);
      
      // Common parameters for both text and object generation
      const baseParams = {
        model: selectedProvider(actualModel),
        messages: aiSDKMessages,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
      };

      let result;

      // Check if structured output is requested
      if (response_format?.type === 'json_schema') {
        // For OpenAI and OpenRouter providers, use direct OpenAI client for better structured output support
        if (provider === ModelProvider.OpenRouter) {
          this.logger.log(`Using direct OpenAI client for structured output with ${provider}/${actualModel}`);
          
          const openaiClient = this.openrouterClient;
          
          const openaiResponse = await openaiClient.chat.completions.create({
            model: actualModel,
            messages: request.messages as any,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            response_format: response_format as any,
            ...(request.tools && { tools: request.tools }),
            ...(request.tool_choice && { tool_choice: request.tool_choice }),
          });

          // Convert OpenAI response to our expected format
          const content = openaiResponse.choices[0].message.content || '';
          let parsedObject = null;
          
          try {
            parsedObject = content ? JSON.parse(content) : null;
          } catch (parseError) {
            this.logger.warn(`Failed to parse JSON from structured output: ${parseError.message}. Content: ${content}`);
            parsedObject = null;
          }

          result = {
            text: content,
            object: parsedObject,
            finishReason: openaiResponse.choices[0].finish_reason,
            usage: {
              promptTokens: openaiResponse.usage?.prompt_tokens || 0,
              completionTokens: openaiResponse.usage?.completion_tokens || 0,
              totalTokens: openaiResponse.usage?.total_tokens || 0,
            },
            toolCalls: openaiResponse.choices[0].message.tool_calls?.map(call => ({
              toolCallId: call.id,
              toolName: call.function.name,
              args: JSON.parse(call.function.arguments),
            })),
          };
        } else {
          // Fallback to AI SDK for other providers
          const zodSchema = jsonSchemaToZod(response_format.json_schema.schema);
          result = await generateObject({
            ...baseParams,
            schema: zodSchema,
          });
        }
      } else {
        // Use regular generateText for non-structured output
        result = await generateText({
          ...baseParams,
          ...(aiSDKTools && { tools: aiSDKTools }),
          ...(aiSDKToolChoice && { toolChoice: aiSDKToolChoice }),
        });
      }

      // Format response in OpenAI API format
      const response = convertAISDKResultToOpenAI(result, actualModel);

      // End analytics session
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: {
          content: (result as any).object ? JSON.stringify((result as any).object) : (result as any).text,
          finishReason: mapFinishReason(result.finishReason),
        },
        usage: { input: result.usage.promptTokens, output: result.usage.completionTokens, total: result.usage.totalTokens },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

      return response;
    } catch (error) {
      this.logger.error(`Error generating response: ${error.message}`);
      
      // End analytics session with error
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { error: error.message },
        usage: { input: 0, output: 0, total: 0 },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);
      
      throw error;
    }
  }

  async *generateStreamingResponse(request: ILLMRequest): AsyncGenerator<ChatCompletionChunkDto, void, unknown> {
    const { messages, model, temperature, user, response_format } = request;
    
    // Resolve provider and model
    const { provider, model: actualModel } = this.resolveProviderAndModel(model, request.provider);
    const selectedProvider = this.getProvider(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Streaming - ${provider}/${actualModel}`,
      generationName: "llm-streaming",
      userId: user || "anonymous",
      model: actualModel,
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature,
    };

    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    try {
      this.logger.log(`Starting streaming response with provider: ${provider}, model: ${actualModel}`);

      // Convert OpenAI tools to AI SDK format
      const aiSDKTools = request.tools ? convertOpenAIToolsToAISDK(request.tools) : undefined;

      // Convert OpenAI tool_choice to AI SDK format
      const aiSDKToolChoice = request.tool_choice ? convertOpenAIToolChoiceToAISDK(request.tool_choice) : undefined;

      // Convert messages to AI SDK format
      const aiSDKMessages = convertOpenAIMessagesToAISDK(request.messages);
      
      // Common parameters for both text and object streaming
      const baseParams = {
        model: selectedProvider(actualModel),
        messages: aiSDKMessages,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
      };

      let result;

      // Check if structured output is requested
      if (response_format?.type === 'json_schema') {
        // Convert JSON schema to Zod schema
        const zodSchema = jsonSchemaToZod(response_format.json_schema.schema);
        
        // Use streamObject for structured output
        result = await streamObject({
          ...baseParams,
          schema: zodSchema,
        });
      } else {
        // Use regular streamText for non-structured output
        result = await streamText({
          ...baseParams,
          ...(aiSDKTools && { tools: aiSDKTools }),
          ...(aiSDKToolChoice && { toolChoice: aiSDKToolChoice }),
        });
      }

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let totalTokens = 0;
      const chatId = generateChatCompletionId();
      const created = Math.floor(Date.now() / 1000);

      for await (const delta of result.textStream) {
        fullContent += delta;
        
        // Format chunk in OpenAI API format
        const chunk = convertAISDKChunkToOpenAI(delta, chatId, created, actualModel);
        
        yield chunk;
      }

      // Send final chunk with finish_reason
      const finalChunk = convertAISDKChunkToOpenAI('', chatId, created, actualModel, "stop");
      
      yield finalChunk;

      // Get final usage information
      const finalResult = await result.usage;
      if (finalResult) {
        inputTokens = finalResult.promptTokens;
        outputTokens = finalResult.completionTokens;
        totalTokens = finalResult.totalTokens;
      }

      // End analytics session
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: {
          content: fullContent,
          streaming: true,
        },
        usage: { input: inputTokens, output: outputTokens, total: totalTokens },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

      this.logger.log(`Successfully completed streaming response. Tokens used: ${totalTokens}`);
    } catch (error) {
      this.logger.error(`Error in streaming response: ${error.message}`, error.stack);
      
      // End analytics session with error
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

    // Resolve provider and model
    const { provider, model: actualModel } = this.resolveProviderAndModel(model, request.provider);
    const selectedProvider: any = this.getProvider(provider);

    // Build AI SDK embedding model function
    // Not all providers support embeddings; currently we default to OpenAI behaviour
    const embeddingModelFn = selectedProvider.embedding
      ? selectedProvider.embedding(actualModel, dimensions ? { dimensions } : undefined)
      : this.openaiProvider.embedding(actualModel, dimensions ? { dimensions } : undefined);

    // Prepare analytics session
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
      let embeddings: number[][] = [];
      let tokensUsed = 0;

      if (Array.isArray(input)) {
        // Batch embedding
        const { embeddings: batchEmbeddings, usage } = await embedMany({
          model: embeddingModelFn,
          values: input as any[],
        });
        embeddings = batchEmbeddings as number[][];
        tokensUsed = usage?.tokens || 0;
      } else {
        // Single embedding
        const { embedding: singleEmbedding, usage } = await embed({
          model: embeddingModelFn,
          value: input as any,
        });
        embeddings = [singleEmbedding as number[]];
        tokensUsed = usage?.tokens || 0;
      }

      // Convert embeddings to base64 if requested
      const formattedEmbeddings = encoding_format === "base64"
        ? embeddings.map(vec => Buffer.from(new Float32Array(vec).buffer).toString('base64'))
        : embeddings;

      // Build OpenAI-compatible response
      const response: EmbeddingResponseDto = {
        object: "list",
        model: actualModel,
        data: formattedEmbeddings.map((emb, idx) => ({
          object: "embedding",
          index: idx,
          embedding: emb as any,
        })),
        usage: {
          prompt_tokens: tokensUsed,
          total_tokens: tokensUsed,
        },
      } as EmbeddingResponseDto;

      // End analytics
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: { embeddings: response.data.length },
        usage: { input: tokensUsed, output: 0, total: tokensUsed },
      };

      await this.tokenAnalytics.endSession(trace, generation, analyticsResponse);

      return response;
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