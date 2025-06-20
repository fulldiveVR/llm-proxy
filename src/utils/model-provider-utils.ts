import { ModelProvider } from '../llm-proxy/llm-proxy.models';

/**
 * Extract model and provider from model string
 */
export const extractModelAndProvider = (model: string): { provider: ModelProvider; model: string } => {
  const separator = "/";
  const split = model.split(separator);
  
  if (split.length === 1) {
    // No "/" separator found - auto-detect provider based on model name
    const modelLower = model.toLowerCase();
    
    // Anthropic models
    if (modelLower.includes('claude')) {
      return { provider: ModelProvider.Anthropic, model: model };
    }
    
    // Vertex AI models
    if (modelLower.includes('gemini') || modelLower.includes('vertex')) {
      return { provider: ModelProvider.Vertex, model: model };
    }
    
    // Default to OpenAI for GPT models and others
    return { provider: ModelProvider.OpenAI, model: model };
  }
  
  // "/" separator found - first part is provider, rest is model
  const [provider, ...modelId] = split;
  return { provider: provider as ModelProvider, model: modelId.join(separator) };
};