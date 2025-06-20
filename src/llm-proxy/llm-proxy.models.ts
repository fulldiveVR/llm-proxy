import { IsString, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested, IsBoolean } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import type { 
  ChatCompletion, 
  ChatCompletionChunk, 
  ChatCompletionMessage,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
  ChatCompletionToolChoiceOption
} from 'openai/resources/chat/completions';

// OpenAI API compatible types
export type ChatMessageContentItem = 
  | { type: "text"; text: string } 
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessageContent = string | ChatMessageContentItem[];

// OpenAI API compatible models
export class MessageDto {
  @ApiProperty({
    description: "Role of the message sender",
    example: "user",
    enum: ["system", "user", "assistant", "tool", "function"]
  })
  @IsString()
  role: "system" | "user" | "assistant" | "tool" | "function";

  @ApiProperty({
    description: "Content of the message - can be a string or array of content parts for multimodal inputs",
    example: "Hello, how can I help you today?",
    oneOf: [
      { type: "string" },
      { 
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["text", "image_url"] },
            text: { type: "string" },
            image_url: { 
              type: "object",
              properties: {
                url: { type: "string" }
              }
            }
          }
        }
      }
    ]
  })
  content: ChatMessageContent;

  tool_calls?: Array<ChatCompletionMessageToolCall>;

  tool_call_id: string
  name: string
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
    enum: ["openai", "anthropic", "vertex", "openrouter"],
  })
  @IsOptional()
  @IsString()
  provider?: ModelProvider;

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

  @ApiPropertyOptional({
    description: "Tools available for the model to call",
    type: "array",
    items: {
      type: "object"
    }
  })
  @IsOptional()
  tools?: ChatCompletionTool[];

  @ApiPropertyOptional({
    description: "Controls which (if any) tool is called by the model",
    oneOf: [
      { type: "string", enum: ["none", "auto"] },
      { type: "object" }
    ]
  })
  @IsOptional()
  tool_choice?: ChatCompletionToolChoiceOption;
}

// Use official OpenAI types for responses
export type ChatCompletionResponseDto = ChatCompletion;
export type ChatCompletionChunkDto = ChatCompletionChunk;

// Swagger-compatible class that implements OpenAI interface
export class ChatCompletionResponseSwagger implements ChatCompletion {
  @ApiProperty({
    description: "Unique identifier for the completion",
    example: "chatcmpl-123"
  })
  id: string;

  @ApiProperty({
    description: "Object type",
    example: "chat.completion"
  })
  object: "chat.completion";

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
    description: "Array of completion choices"
  })
  choices: ChatCompletion.Choice[];

  @ApiProperty({
    description: "Token usage information",
    required: false
  })
  usage?: {
    completion_tokens: number;
    prompt_tokens: number;
    total_tokens: number;
  };

  @ApiProperty({
    description: "System fingerprint",
    required: false
  })
  system_fingerprint?: string;

  @ApiProperty({
    description: "Service tier used",
    required: false
  })
  service_tier?: "auto" | "default" | "flex" | null;
}

export enum ModelProvider {
  OpenAI = "openai",
  Anthropic = "anthropic",
  Vertex = "vertex",
  OpenRouter = "openrouter"
}

// Internal interface for service layer (extends ChatCompletionRequestDto)
export interface ILLMRequest extends ChatCompletionRequestDto {
  provider?: ModelProvider;
  stream?: boolean;
}