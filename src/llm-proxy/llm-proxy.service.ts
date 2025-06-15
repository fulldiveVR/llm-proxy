import { Injectable, Logger } from "@nestjs/common";
import { generateText, streamText, ToolSet, ToolChoice } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { TokenAnalyticsService } from "../token-analytics";
import type { ChatCompletion } from 'openai/resources/chat/completions';
import { z } from 'zod';
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

  private mapFinishReason(finishReason: string | null): ChatCompletion.Choice['finish_reason'] {
    if (!finishReason) {
      return "stop";
    }
    switch (finishReason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool-calls":
        return "tool_calls";
      case "content-filter":
        return "content_filter";
      case "error":
      case "other":
      case "unknown":
      default:
        return "stop";
    }
  }

  /**
   * Convert OpenAI tools format to AI SDK format
   */
  private convertOpenAIToolsToAISDK(openaiTools: any[]): ToolSet | undefined {
    if (!openaiTools || openaiTools.length === 0) return undefined;
    
    const aiSDKTools: ToolSet = {};
    
    for (const tool of openaiTools) {
      if (tool.type === 'function') {
        const func = tool.function;
        
        // Convert JSON schema to Zod schema
        const zodSchema = this.jsonSchemaToZod(func.parameters);
        
        aiSDKTools[func.name] = {
          description: func.description,
          parameters: zodSchema
        };
      }
    }
    
    return aiSDKTools;
  }

  /**
   * Convert OpenAI tool_choice to AI SDK format
   */
  private convertToolChoice(toolChoice: any): ToolChoice<ToolSet> | undefined {
    if (!toolChoice) return undefined;
    
    if (typeof toolChoice === 'string') {
      if (toolChoice === 'none' || toolChoice === 'auto') {
        return toolChoice as ToolChoice<ToolSet>;
      }
    }
    
    if (typeof toolChoice === 'object' && toolChoice.type === 'function') {
      return {
        type: 'tool',
        toolName: toolChoice.function.name
      };
    }
    
    return undefined;
  }

  /**
   * Convert JSON schema to Zod schema
   */
  private jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
    if (!jsonSchema || !jsonSchema.properties) {
      return z.object({});
    }

    const zodShape: Record<string, z.ZodTypeAny> = {};
    
    for (const [key, prop] of Object.entries(jsonSchema.properties)) {
      const property = prop as any;
      
      switch (property.type) {
        case 'string':
          zodShape[key] = z.string().describe(property.description || '');
          break;
        case 'number':
          zodShape[key] = z.number().describe(property.description || '');
          break;
        case 'boolean':
          zodShape[key] = z.boolean().describe(property.description || '');
          break;
        case 'array':
          zodShape[key] = z.array(z.string()).describe(property.description || '');
          break;
        case 'object':
          zodShape[key] = z.object({}).describe(property.description || '');
          break;
        default:
          zodShape[key] = z.string().describe(property.description || '');
      }
      
      // Make optional if not in required array
      if (!jsonSchema.required?.includes(key)) {
        zodShape[key] = zodShape[key].optional();
      }
    }
    
    return z.object(zodShape);
  }

  async generateResponse(request: ILLMRequest): Promise<ChatCompletionResponseDto> {
    const { messages, model, temperature, max_tokens, user, tools, tool_choice } = request;
    
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
      // Convert OpenAI tools to AI SDK format
      const aiSDKTools = request.tools ? this.convertOpenAIToolsToAISDK(request.tools) : undefined;
      
      // Convert OpenAI tool_choice to AI SDK format
      const aiSDKToolChoice = request.tool_choice ? this.convertToolChoice(request.tool_choice) : undefined;
      
      // Use Vercel AI SDK to generate text
      const result = await generateText({
        model: selectedProvider(selectedModel),
        messages: request.messages.map((msg: any) => ({ role: msg.role, content: msg.content })),
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        ...(aiSDKTools && { tools: aiSDKTools }),
        ...(aiSDKToolChoice && { toolChoice: aiSDKToolChoice }),
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
            refusal: null,
            tool_calls: result.toolCalls?.map(call => ({
              id: call.toolCallId,
              type: "function" as const,
              function: {
                name: call.toolName,
                arguments: JSON.stringify(call.args)
              }
            })) || null,
          },
          finish_reason: this.mapFinishReason(result.finishReason),
          logprobs: null,
        }],
        usage: {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: result.usage.totalTokens,
        },
        system_fingerprint: undefined,
        service_tier: null,
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
    const { messages, model, temperature, max_tokens, user, tools, tool_choice } = request;
    
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

      // Convert OpenAI tools to AI SDK format
      const aiSDKTools = request.tools ? this.convertOpenAIToolsToAISDK(request.tools) : undefined;

      // Convert OpenAI tool_choice to AI SDK format
      const aiSDKToolChoice = request.tool_choice ? this.convertToolChoice(request.tool_choice) : undefined;

      // Use Vercel AI SDK to stream text
      const result = await streamText({
        model: selectedProvider(selectedModel),
        messages: request.messages.map((msg: any) => ({ role: msg.role, content: msg.content })),
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        ...(aiSDKTools && { tools: aiSDKTools }),
        ...(aiSDKToolChoice && { toolChoice: aiSDKToolChoice }),
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