import { CoreMessage } from 'ai';
import { MessageDto, ChatMessageContent, ChatCompletionResponseDto, ChatCompletionChunkDto } from '../llm-proxy/llm-proxy.models';

/**
 * Extract text content from OpenAI message content
 */
export function extractTextContent(content: ChatMessageContent): string {
  if (typeof content === 'string') {
    return content;
  }
  
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => {
        const text = part.text;
        return Array.isArray(text) ? text.join('\n') : (text || '');
      })
      .join('\n');
  }
  
  return '';
}

/**
 * Convert OpenAI messages to AI SDK format with proper tool handling
 */
export function convertOpenAIMessagesToAISDK(messages: MessageDto[]): CoreMessage[] {
  const result: CoreMessage[] = [];
  
  for (const msg of messages) {
    // Handle assistant messages with tool calls
    if (msg.role === 'assistant' && msg.tool_calls) {
      result.push({
        role: 'assistant',
        content: msg.tool_calls.map((call: any) => ({
          type: 'tool-call',
          toolCallId: call.id,
          toolName: call.function.name,
          args: JSON.parse(call.function.arguments)
        }))
      });
      continue;
    }
    
    // Handle tool messages
    if (msg.role === 'tool' && msg.tool_call_id) {
      const toolResult = extractTextContent(msg.content);
      result.push({
        role: 'tool',
        content: [{
          type: 'tool-result',
          toolCallId: msg.tool_call_id,
          toolName: msg.name || 'unknown',
          result: toolResult
        }]
      });
      continue;
    }
    
    // Handle system messages (must be string)
    if (msg.role === 'system') {
      const textContent = extractTextContent(msg.content);
      result.push({ role: 'system', content: textContent });
      continue;
    }
    
    // Handle user messages (can be string or content array)
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Convert to AI SDK format for multimodal content
        const aiSDKContent = msg.content.map((part: any) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else if (part.type === 'image_url') {
            return { type: 'image', image: part.image_url.url };
          }
          return part; // fallback
        });
        result.push({ role: 'user', content: aiSDKContent });
      }
      continue;
    }
    
    // Handle regular assistant messages (string content)
    if (msg.role === 'assistant') {
      const textContent = extractTextContent(msg.content);
      // Convert empty arrays to empty strings for assistant messages
      result.push({ 
        role: 'assistant', 
        content: textContent || '' 
      });
      continue;
    }
    
    // Skip function messages and other unsupported roles
    if (msg.role === 'function') {
      console.warn('Skipping function message - deprecated in favor of tool messages');
      continue;
    }
    
    console.warn(`Skipping message with unsupported role: ${msg.role}`);
  }
  
  return result;
}

/**
 * Map AI SDK finish reason to OpenAI finish reason
 */
export function mapFinishReason(finishReason: string | undefined): "stop" | "length" | "tool_calls" | "content_filter" | "function_call" {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool-calls':
      return 'tool_calls';
    case 'content-filter':
      return 'content_filter';
    default:
      return 'stop';
  }
}

/**
 * Generate OpenAI-compatible chat completion ID
 */
export function generateChatCompletionId(): string {
  return `chatcmpl-${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Convert AI SDK GenerateTextResult to OpenAI ChatCompletionResponseDto
 */
export function convertAISDKResultToOpenAI(
  result: any, // AI SDK GenerateTextResult
  model: string,
  id?: string
): ChatCompletionResponseDto {
  return {
    id: id || generateChatCompletionId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: result.text,
        refusal: null,
        tool_calls: result.toolCalls?.map((call: any) => ({
          id: call.toolCallId,
          type: "function" as const,
          function: {
            name: call.toolName,
            arguments: JSON.stringify(call.args)
          }
        })) || null,
      },
      finish_reason: mapFinishReason(result.finishReason),
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
}

/**
 * Convert AI SDK StreamTextResult chunk to OpenAI ChatCompletionChunkDto
 */
export function convertAISDKChunkToOpenAI(
  chunk: any, // AI SDK chunk or text content
  chatId: string,
  created: number,
  model: string,
  finishReason?: "stop" | "length" | "tool_calls" | "content_filter" | "function_call" | null
): ChatCompletionChunkDto {
  // Handle simple text content
  if (typeof chunk === 'string') {
    return {
      id: chatId,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{
        index: 0,
        delta: chunk ? { content: chunk } : {},
        finish_reason: finishReason || null,
        logprobs: null,
      }],
      usage: undefined,
      system_fingerprint: undefined,
      service_tier: null,
    };
  }
  
  // Handle AI SDK chunk object
  return {
    id: chatId,
    object: "chat.completion.chunk",
    created,
    model,
    choices: [{
      index: 0,
      delta: {
        role: chunk.type === 'text-delta' ? undefined : "assistant",
        content: chunk.type === 'text-delta' ? chunk.textDelta : (chunk.type === 'finish' ? null : ''),
        tool_calls: chunk.type === 'tool-call-delta' ? [{
          index: 0,
          id: chunk.toolCallId,
          type: "function" as const,
          function: {
            name: chunk.toolName,
            arguments: chunk.argsTextDelta || ''
          }
        }] : undefined,
      },
      finish_reason: chunk.type === 'finish' ? mapFinishReason(chunk.finishReason) : (finishReason || null),
      logprobs: null,
    }],
    usage: chunk.type === 'finish' && chunk.usage ? {
      prompt_tokens: chunk.usage.promptTokens,
      completion_tokens: chunk.usage.completionTokens,
      total_tokens: chunk.usage.totalTokens,
    } : undefined,
    system_fingerprint: undefined,
    service_tier: null,
  };
}
