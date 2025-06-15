import { IsString, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

// OpenAI API compatible models
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

export class ChatCompletionRequestDto {
  @ApiProperty({
    description: "Array of messages for the conversation",
    type: [MessageDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

  @ApiProperty({
    description: "Model to use for generation",
    example: "gpt-4"
  })
  @IsString()
  model: string;

  @ApiPropertyOptional({
    description: "Provider to use for generation (internal use)",
    example: "openai",
    enum: ["openai", "anthropic", "vertex"],
  })
  @IsOptional()
  @IsString()
  provider?: "openai" | "anthropic" | "vertex";

  @ApiPropertyOptional({
    description: "Temperature for generation (0.0 to 2.0)",
    example: 0.7,
    minimum: 0,
    maximum: 2
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: "Maximum tokens to generate",
    example: 1000
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  @ApiPropertyOptional({
    description: "Whether to stream the response",
    example: false
  })
  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @ApiPropertyOptional({
    description: "User ID for tracking",
    example: "user-123"
  })
  @IsOptional()
  @IsString()
  user?: string;
}

// Response format compatible with OpenAI API
export class ChatCompletionChoiceDto {
  @ApiProperty({
    description: "Index of the choice",
    example: 0
  })
  index: number;

  @ApiProperty({
    description: "Message containing the completion"
  })
  message: {
    role: string;
    content: string;
  };

  @ApiProperty({
    description: "Reason the completion finished",
    example: "stop"
  })
  finish_reason: string;
}

export class ChatCompletionResponseDto {
  @ApiProperty({
    description: "Unique identifier for the completion",
    example: "chatcmpl-123"
  })
  id: string;

  @ApiProperty({
    description: "Object type",
    example: "chat.completion"
  })
  object: string;

  @ApiProperty({
    description: "Unix timestamp of when the completion was created"
  })
  created: number;

  @ApiProperty({
    description: "Model used for completion",
    example: "gpt-4"
  })
  model: string;

  @ApiProperty({
    description: "Array of completion choices",
    type: [ChatCompletionChoiceDto]
  })
  choices: ChatCompletionChoiceDto[];

  @ApiProperty({
    description: "Token usage information"
  })
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Stream response format
export class ChatCompletionChunkDto {
  @ApiProperty({
    description: "Unique identifier for the completion chunk",
    example: "chatcmpl-123"
  })
  id: string;

  @ApiProperty({
    description: "Object type",
    example: "chat.completion.chunk"
  })
  object: string;

  @ApiProperty({
    description: "Unix timestamp of when the chunk was created"
  })
  created: number;

  @ApiProperty({
    description: "Model used for completion",
    example: "gpt-4"
  })
  model: string;

  @ApiProperty({
    description: "Array of completion choices",
  })
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason: string | null;
  }>;
}

// Internal interface for service layer (extends ChatCompletionRequestDto)
export interface ILLMRequest extends ChatCompletionRequestDto {
  // All properties are inherited from ChatCompletionRequestDto
}