import { Body, Controller, Post, Res, HttpStatus, Headers, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from "@nestjs/swagger";
import { Response } from "express";
import { LLMProxyService } from "./llm-proxy.service";
import { 
  ChatCompletionRequestDto, 
  ChatCompletionResponseDto,
  ChatCompletionChunkDto,
  ILLMRequest 
} from "./llm-proxy.models";

@ApiTags("OpenAI API Compatible")
@Controller("v1/chat")
export class LLMProxyController {
  constructor(private readonly llmProxyService: LLMProxyService) {}

  @Post("completions")
  @ApiOperation({
    summary: "Create a chat completion",
    description: "Creates a completion for the chat message"
  })
  @ApiQuery({
    name: "stream",
    description: "Whether to stream the response",
    required: false,
    type: Boolean
  })
  @ApiResponse({
    status: 200,
    description: "Chat completion created successfully",
    type: ChatCompletionResponseDto
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters"
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error"
  })
  async createChatCompletion(
    @Body() requestDto: ChatCompletionRequestDto,
    @Query("stream") stream: boolean,
    @Res() res: Response
  ): Promise<void> {
    try {
      // Prepare request for the service
      const request: ILLMRequest = {
        messages: requestDto.messages,
        model: requestDto.model,
        provider: requestDto.provider,
        temperature: requestDto.temperature,
        max_tokens: requestDto.max_tokens,
        user: requestDto.user,
        stream: stream
      };

      // Handle streaming response
      if (stream) {
        // Set headers for Server-Sent Events
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("Access-Control-Allow-Origin", "*");

        try {
          const streamGenerator = this.llmProxyService.generateStreamingResponse(request);
          
          // Stream each chunk in OpenAI format
          for await (const chunk of streamGenerator) {
            const formattedChunk = `data: ${chunk}\n\n`;
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