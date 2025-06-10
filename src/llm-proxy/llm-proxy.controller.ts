import { Body, Controller, Post, Res, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Response } from "express";
import { LLMProxyService } from "./llm-proxy.service";
import { LLMRequestDto, LLMResponseDto, ILLMRequest } from "./llm-proxy.models";

@ApiTags("LLM Proxy")
@Controller("llm-proxy")
export class LLMProxyController {
  constructor(private readonly llmProxyService: LLMProxyService) {}

  @Post("generate")
  @ApiOperation({
    summary: "Generate text response",
    description: "Generate a text response using the specified language model"
  })
  @ApiResponse({
    status: 201,
    description: "Text generated successfully",
    type: LLMResponseDto
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters"
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error during text generation"
  })
  async generateText(
    @Body() requestDto: LLMRequestDto
  ): Promise<LLMResponseDto> {
    const request: ILLMRequest = {
      messages: requestDto.messages,
      model: requestDto.model || "gpt-4",
      provider: requestDto.provider || "openai",
      temperature: requestDto.temperature || 0.7,
      maxTokens: requestDto.maxTokens || 1000,
      userId: requestDto.userId,
    };

    const response = await this.llmProxyService.generateResponse(request);

    return {
      content: response.content,
      model: response.model,
      usage: response.usage,
      finishReason: response.finishReason,
    };
  }

  @Post("stream")
  @ApiOperation({
    summary: "Generate streaming text response",
    description: "Generate a streaming text response using the specified language model"
  })
  @ApiResponse({
    status: 200,
    description: "Streaming text generation started",
    content: {
      "text/plain": {
        schema: {
          type: "string",
          description: "Server-sent events stream of generated text chunks"
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters"
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error during streaming text generation"
  })
  async streamText(
    @Body() requestDto: LLMRequestDto,
    @Res() res: Response
  ): Promise<void> {
    const request: ILLMRequest = {
      messages: requestDto.messages,
      model: requestDto.model || "gpt-4",
      provider: requestDto.provider || "openai",
      temperature: requestDto.temperature || 0.7,
      maxTokens: requestDto.maxTokens || 1000,
      userId: requestDto.userId,
    };

    // Set headers for Server-Sent Events
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Cache-Control");

    try {
      const stream = this.llmProxyService.generateStreamingResponse(request);

      for await (const chunk of stream) {
        // Write each chunk as it arrives
        res.write(chunk);
      }

      res.status(HttpStatus.OK).end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).write(`Error: ${error.message}`);
      res.end();
    }
  }
}