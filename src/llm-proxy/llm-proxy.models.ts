import { IsString, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class MessageDto {
  @ApiProperty({
    description: "Role of the message sender",
    example: "user",
    enum: ["system", "user", "assistant"]
  })
  @IsString()
  role: "system" | "user" | "assistant";

  @ApiProperty({
    description: "Content of the message",
    example: "Hello, how can I help you today?"
  })
  @IsString()
  content: string;
}

export class LLMRequestDto {
  @ApiProperty({
    description: "Array of messages for the conversation",
    type: [MessageDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiPropertyOptional({
    description: "Model to use for generation",
    example: "gpt-4",
    default: "gpt-4"
  })
  @IsOptional()
  @IsString()
  model?: string = "gpt-4";

  @ApiPropertyOptional({
    description: "Provider to use for generation",
    example: "openai",
    enum: ["openai", "anthropic", "vertex"],
    default: "openai"
  })
  @IsOptional()
  @IsString()
  provider?: "openai" | "anthropic" | "vertex" = "openai";

  @ApiPropertyOptional({
    description: "Temperature for generation (0.0 to 2.0)",
    example: 0.7,
    minimum: 0,
    maximum: 2,
    default: 0.7
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number = 0.7;

  @ApiPropertyOptional({
    description: "Maximum tokens to generate",
    example: 1000,
    default: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number = 1000;

  @ApiProperty({
    description: "User ID for tracking",
    example: "user-123"
  })
  @IsString()
  userId: string;
}

export class LLMResponseDto {
  @ApiProperty({
    description: "Generated response content",
    example: "I'm an AI assistant. How can I help you today?"
  })
  content: string;

  @ApiProperty({
    description: "Model used for generation",
    example: "gpt-4"
  })
  model: string;

  @ApiProperty({
    description: "Token usage information"
  })
  usage: {
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
  };

  @ApiProperty({
    description: "Finish reason",
    example: "stop"
  })
  finishReason?: string;
}

export interface ILLMRequest {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  model: string;
  provider?: "openai" | "anthropic" | "vertex";
  temperature: number;
  maxTokens: number;
  userId: string;
}

export interface ILLMResponse {
  content: string;
  model: string;
  usage: {
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
  };
  finishReason?: string;
}