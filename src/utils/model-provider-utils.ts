import { ModelProvider } from '../llm-proxy/llm-proxy.models';

/**
 * Extract model and provider from model string
 */
export const extractModelAndProvider = (model: string): { provider: ModelProvider; model: string } => {
  const separator = "/";
  const split = model.split(separator);
  
  if (split.length === 1) {
    // no "/" separator found - auto-detect provider
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
  
  const [provider, ...modelId] = split;
  const providerLower = provider.toLowerCase();
  
  // Check if it's an OpenRouter model format (provider/model)
  // OpenRouter supports models from multiple providers with format like "openai/gpt-4", "anthropic/claude-3-sonnet", etc.
  // If the provider part matches known OpenRouter providers, treat it as OpenRouter
  const openRouterProviders = ['openai', 'anthropic', 'google', 'meta', 'microsoft', 'mistral', 'cohere', 'ai21', 'huggingface'];
  if (openRouterProviders.includes(providerLower)) {
    // This could be an OpenRouter model, but we need to distinguish from direct provider usage
    // For now, we'll assume direct provider usage unless explicitly specified as openrouter
    if (providerLower === 'openrouter') {
      return { provider: ModelProvider.OpenRouter, model: modelId.join(separator) };
    }
    
    // Map to direct providers
    switch (providerLower) {
      case 'openai':
        return { provider: ModelProvider.OpenAI, model: modelId.join(separator) };
      case 'anthropic':
        return { provider: ModelProvider.Anthropic, model: modelId.join(separator) };
      case 'google':
        return { provider: ModelProvider.Vertex, model: modelId.join(separator) };
      default:
        // For other providers not directly supported, use OpenRouter
        return { provider: ModelProvider.OpenRouter, model: model };
    }
  }
  
  // Direct provider specification
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
      return { provider: provider as ModelProvider, model: modelId.join(separator) };
  }
};