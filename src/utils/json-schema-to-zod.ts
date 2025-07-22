import { z } from 'zod';

/**
 * Convert JSON Schema to Zod schema for structured output
 */
export function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return z.object({});
  }

  switch (jsonSchema.type) {
    case 'object':
      const shape: Record<string, z.ZodTypeAny> = {};
      
      if (jsonSchema.properties) {
        for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
          let zodType = jsonSchemaToZod(propSchema);
          
          // Handle required fields
          if (!jsonSchema.required?.includes(key)) {
            zodType = zodType.optional();
          }
          
          // Add description if available
          if ((propSchema as any).description) {
            zodType = zodType.describe((propSchema as any).description);
          }
          
          shape[key] = zodType;
        }
      }
      
      return z.object(shape);
      
    case 'array':
      if (jsonSchema.items) {
        return z.array(jsonSchemaToZod(jsonSchema.items));
      }
      return z.array(z.any());
      
    case 'string':
      let stringSchema = z.string();
      if (jsonSchema.enum) {
        return z.enum(jsonSchema.enum);
      }
      return stringSchema;
      
    case 'number':
      return z.number();
      
    case 'integer':
      return z.number().int();
      
    case 'boolean':
      return z.boolean();
      
    default:
      return z.any();
  }
}