import { Body, Controller, Get, Post, Query, Res, HttpStatus, Logger, UseGuards, Headers } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
import { Response } from "express";
import { LLMProxyService } from "./llm-proxy.service";
import { 
  ChatCompletionRequestDto, 
  ChatCompletionResponseSwagger,
  ILLMRequest, 
  ModelProvider
} from "./llm-proxy.models";
import { AuthGuard } from "../auth";

@ApiTags("OpenAI API Compatible")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("v1/chat")
export class LLMProxyController {
  private readonly logger: Logger;

  constructor(private readonly llmProxyService: LLMProxyService) {
    this.logger = new Logger(LLMProxyController.name);
  }

  @Get("/health")
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  @ApiResponse({ status: 401, description: "Unauthorized - Invalid or missing API key" })
  healthCheck() {
    return { 
      status: "ok", 
      timestamp: new Date().toISOString(),
      service: "llm-proxy"
    };
  }

  @Post("completions")
  @ApiOperation({
    summary: "Create a chat completion",
    description: "Creates a completion for the chat message"
  })

  @ApiResponse({
    status: 200,
    description: "Chat completion created successfully",
    type: ChatCompletionResponseSwagger
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters"
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key"
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error"
  })
  async createChatCompletion(
    @Body() requestDto: ChatCompletionRequestDto,
    @Headers("x-provider") xProvider: ModelProvider | undefined,
    @Res() res: Response
  ): Promise<void> {
    try {
      const isStreaming = requestDto.stream || false;
      
      // Log incoming request
      const effectiveProvider = xProvider || requestDto.provider;
      this.logger.log(`Incoming chat completion request: model=${requestDto.model || 'default'}, provider=${effectiveProvider}, x-provider=${xProvider || 'none'}, messages=${requestDto.messages?.length || 0}, streaming=${isStreaming}, max_tokens=${requestDto.max_tokens}`);
      
      // Prepare request for the service
      const request: ILLMRequest = {
        messages: requestDto.messages,
        model: requestDto.model,
        provider: effectiveProvider, // X-Provider header overrides body provider
        temperature: requestDto.temperature,
        max_tokens: requestDto.max_tokens,
        user: requestDto.user,
        tools: requestDto.tools,
        tool_choice: requestDto.tool_choice,
        stream: requestDto.stream
      };

      // Handle streaming response
      if (isStreaming) {
        // Set headers for Server-Sent Events
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");

        try {
          const streamGenerator = this.llmProxyService.generateStreamingResponse(request);
          
          // Stream each chunk in OpenAI format
          for await (const chunk of streamGenerator) {
            const formattedChunk = `data: ${JSON.stringify(chunk)}\n\n`;
            res.write(formattedChunk);
          }
          
          // End the stream
          res.write("data: [DONE]\n\n");
          res.end();
        } catch (error) {
          res.write(`data: {"error": {"message": "${error.message}", "type": "server_error"}}\n\n`);
          res.end();
        }
      } 
      // Handle non-streaming response
      else {
        const response = await this.llmProxyService.generateResponse(request);
        res.status(HttpStatus.OK).json(response);
      }
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          message: error.message,
          type: "server_error"
        }
      });
    }
  }
}