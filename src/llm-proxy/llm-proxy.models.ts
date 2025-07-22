import { IsString, IsOptional, IsNumber, Min, Max, IsArray, ValidateNested, IsBoolean, IsObject } from "class-validator";
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
import type {
  ResponseFormatText,
  ResponseFormatJSONObject,
  ResponseFormatJSONSchema
} from 'openai/resources/shared';
import type { CreateEmbeddingResponse } from "openai/resources/embeddings";

// OpenAI API compatible types
export type ChatMessageContentItem = 
  | { type: "text"; text: string } 
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessageContent = string | ChatMessageContentItem[];

export enum ModelProvider {
  OpenAI = "openai",
  Anthropic = "anthropic",
  Vertex = "vertex",
  OpenRouter = "openrouter"
}

// Use OpenAI's official response format types
export type ResponseFormat = ResponseFormatText | ResponseFormatJSONObject | ResponseFormatJSONSchema;

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
    enum: Object.values(ModelProvider),
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

  @ApiPropertyOptional({
    description: "Format for the response. Use 'json_schema' for structured output with a JSON schema.",
    example: {
      type: "json_schema",
      json_schema: {
        name: "math_response",
        description: "A mathematical calculation result",
        schema: {
          type: "object",
          properties: {
            result: { type: "number" },
            explanation: { type: "string" }
          },
          required: ["result", "explanation"],
          additionalProperties: false
        },
        strict: true
      }
    }
  })
  @IsOptional()
  @IsObject()
  response_format?: ResponseFormat;
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

// ADD: Embedding models -----------------------------------------------------------------------------------------

export type EmbeddingModel = 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large' | (string & {});

export class EmbeddingRequestDto {
  @ApiProperty({
    description: "Input text, token array, or array of either to embed. Cannot be empty.",
    oneOf: [
      { type: "string" },
      {
        type: "array",
        items: { oneOf: [{ type: "string" }, { type: "array", items: { type: "number" } }, { type: "number" }] }
      }
    ]
  })
  input: string | Array<string> | Array<number> | Array<Array<number>>;

  @ApiProperty({ description: "ID of the model to use for embeddings", example: "text-embedding-3-small" })
  @IsString()
  model: EmbeddingModel;

  @ApiPropertyOptional({
    description: "Number of dimensions for the resulting embeddings (text-embedding-3* only)",
    minimum: 1
  })
  @IsOptional()
  @IsNumber()
  dimensions?: number;

  @ApiPropertyOptional({ description: "Return format of the embeddings", enum: ["float", "base64"], example: "float" })
  @IsOptional()
  @IsString()
  encoding_format?: "float" | "base64";

  @ApiPropertyOptional({ description: "End-user identifier", example: "user-123" })
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({
    description: "Provider to use for generation (internal use)",
    enum: Object.values(ModelProvider)
  })
  @IsOptional()
  provider?: ModelProvider;
}

// OpenAI-compatible embedding response types ---------------------------------------------------------------
export type EmbeddingResponseDto = CreateEmbeddingResponse;

// Internal interface for service layer
export interface IEmbeddingRequest extends EmbeddingRequestDto {
  user?: string; // ensured string user id
}

// -----------------------------------------------------------------------------------------

// Internal interface for service layer (extends ChatCompletionRequestDto)
export interface ILLMRequest extends ChatCompletionRequestDto {
  user?: string;
}