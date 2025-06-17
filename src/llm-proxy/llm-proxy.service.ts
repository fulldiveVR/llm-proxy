import { Injectable, Logger } from "@nestjs/common";
import { generateText, streamText, ToolSet, ToolChoice, CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createVertex } from "@ai-sdk/google-vertex";
import { TokenAnalyticsService } from "../token-analytics";
import { 
  ILLMRequest, 
  ChatCompletionResponseDto, 
  ChatCompletionChunkDto, 
  MessageDto,
  ChatMessageContent
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
  convertOpenAIToolChoiceToAISDK
} from "../utils";

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
      googleAuthOptions: {
        credentials: {
          client_email: this.config.vertex.clientEmail,
          private_key: this.config.vertex.privateKey,
        }
      }
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
    const { messages, model, temperature, max_tokens, user, tools, tool_choice } = request;
    
    // Auto-detect provider if not specified
    const provider = request.provider || this.detectProvider(model);
    const selectedProvider = this.getProvider(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Generation - ${provider}/${model}`,
      generationName: "llm-generation",
      userId: user || "anonymous",
      model: model,
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
      
      // Use Vercel AI SDK to generate text
      const result = await generateText({
        model: selectedProvider(model),
        messages: aiSDKMessages,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        ...(aiSDKTools && { tools: aiSDKTools }),
        ...(aiSDKToolChoice && { toolChoice: aiSDKToolChoice }),
      });

      // Format response in OpenAI API format
      const response = convertAISDKResultToOpenAI(result, model);

      // End analytics session
      const analyticsResponse: ITokenAnalyticsInputResponse = {
        output: {
          content: result.text,
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
    const { messages, model, temperature, user } = request;
    
    // Auto-detect provider if not specified
    const provider = request.provider || this.detectProvider(model);
    const selectedProvider = this.getProvider(provider);

    // Start analytics session
    const analyticsRequest: ITokenAnalyticsInputRequest = {
      traceName: `LLM Streaming - ${provider}/${model}`,
      generationName: "llm-streaming",
      userId: user || "anonymous",
      model: model,
      input: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature,
    };

    const { trace, generation } = await this.tokenAnalytics.startSession(analyticsRequest);

    try {
      this.logger.log(`Starting streaming response with provider: ${provider}, model: ${model}`);

      // Convert OpenAI tools to AI SDK format
      const aiSDKTools = request.tools ? convertOpenAIToolsToAISDK(request.tools) : undefined;

      // Convert OpenAI tool_choice to AI SDK format
      const aiSDKToolChoice = request.tool_choice ? convertOpenAIToolChoiceToAISDK(request.tool_choice) : undefined;

      // Convert messages to AI SDK format
      const aiSDKMessages = convertOpenAIMessagesToAISDK(request.messages);
      
      // Use Vercel AI SDK to stream text
      const result = await streamText({
        model: selectedProvider(model),
        messages: aiSDKMessages,
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        ...(aiSDKTools && { tools: aiSDKTools }),
        ...(aiSDKToolChoice && { toolChoice: aiSDKToolChoice }),
      });

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let totalTokens = 0;
      const chatId = generateChatCompletionId();
      const created = Math.floor(Date.now() / 1000);

      for await (const delta of result.textStream) {
        fullContent += delta;
        
        // Format chunk in OpenAI API format
        const chunk = convertAISDKChunkToOpenAI(delta, chatId, created, model);
        
        yield chunk;
      }

      // Send final chunk with finish_reason
      const finalChunk = convertAISDKChunkToOpenAI('', chatId, created, model, "stop");
      
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
}