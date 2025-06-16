import { z } from 'zod';
import { ToolSet, ToolChoice } from 'ai';

/**
 * Convert JSON schema to Zod schema
 */
export function jsonSchemaToZod(jsonSchema: any): z.ZodObject<any> {
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

/**
 * Convert OpenAI tools format to AI SDK format
 */
export function convertOpenAIToolsToAISDK(openaiTools: any[]): ToolSet | undefined {
  if (!openaiTools || openaiTools.length === 0) return undefined;
  
  const aiSDKTools: ToolSet = {};
  
  for (const tool of openaiTools) {
    if (tool.type === 'function') {
      const func = tool.function;
      
      // Convert JSON schema to Zod schema
      const zodSchema = jsonSchemaToZod(func.parameters);
      
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
export function convertOpenAIToolChoiceToAISDK(toolChoice: any): ToolChoice<ToolSet> | undefined {
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
