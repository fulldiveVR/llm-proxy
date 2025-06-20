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
  const providerLower = provider.toLowerCase();
  
  switch (providerLower) {
    case 'openrouter':
      return { provider: ModelProvider.OpenRouter, model: modelId.join(separator) };
    case 'openai':
      return { provider: ModelProvider.OpenAI, model: modelId.join(separator) };
    case 'anthropic':
      return { provider: ModelProvider.Anthropic, model: modelId.join(separator) };
    case 'vertex':
    case 'google':
      return { provider: ModelProvider.Vertex, model: modelId.join(separator) };
    default:
      // For unknown providers, return as-is and let the service handle it
      return { provider: provider as ModelProvider, model: modelId.join(separator) };
  }
};