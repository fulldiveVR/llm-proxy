# Multi-Provider LLM Support Guide

This guide explains how to use the LLM Proxy service with multiple AI providers: OpenAI, Anthropic, and Google Vertex AI.

## Supported Providers

### 1. OpenAI
- **Models**: GPT-4, GPT-3.5-turbo, and other OpenAI models
- **Default Model**: `gpt-4`
- **Required Environment Variables**:
  - `OPENAI_API_KEY`: Your OpenAI API key
  - `OPENAI_MODEL`: Default model (optional, defaults to gpt-4)
  - `OPENAI_MAX_TOKENS`: Maximum tokens (optional, defaults to 2048)

### 2. Anthropic (Claude)
- **Models**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Default Model**: `claude-3-5-sonnet-20241022`
- **Required Environment Variables**:
  - `ANTHROPIC_API_KEY`: Your Anthropic API key
  - `ANTHROPIC_MODEL`: Default model (optional)
  - `ANTHROPIC_MAX_TOKENS`: Maximum tokens (optional, defaults to 2048)

### 3. Google Vertex AI
- **Models**: Gemini 1.5 Pro, Gemini 1.5 Flash, and other Vertex AI models
- **Default Model**: `gemini-1.5-pro`
- **Required Environment Variables**:
  - `VERTEX_PROJECT_ID`: Your Google Cloud project ID
  - `VERTEX_LOCATION`: Region (e.g., us-central1)
  - `VERTEX_MODEL`: Default model (optional)
  - `VERTEX_MAX_TOKENS`: Maximum tokens (optional, defaults to 2048)

## Configuration

### Local Development Setup

Create a `config/local.yml` file with your API keys:

```bash
# Create local configuration file
cp config/default.yml config/local.yml
```

Update the `config/local.yml` file with your actual API keys:

```yaml
# config/local.yml (create this file locally, not committed to git)
llmProxy:
  openai:
    apiKey: "your-openai-api-key"
    model: "gpt-4"
    maxTokens: 2048
  anthropic:
    apiKey: "your-anthropic-api-key"
    model: "claude-3-5-sonnet-20241022"
    maxTokens: 2048
  vertexAI:
    projectId: "your-gcp-project-id"
    location: "us-central1"
    model: "gemini-1.5-pro"
    maxTokens: 2048

langfuse:
  secretKey: "your-langfuse-secret-key"
  publicKey: "your-langfuse-public-key"
  baseUrl: "https://cloud.langfuse.com"

app:
  port: 54011
  host: "0.0.0.0"
```

### Production Configuration

In production, environment variables will be automatically mapped via `custom-environment-variables.yml`:

- `OPENAI_API_KEY` → OpenAI API key
- `ANTHROPIC_API_KEY` → Anthropic API key  
- `VERTEX_AI_PROJECT_ID` → Google Cloud project ID
- `LANGFUSE_SECRET_KEY` → Langfuse secret key
- `LANGFUSE_PUBLIC_KEY` → Langfuse public key

### Configuration Files

The service uses configuration files in the `config/` directory:

- `config/default.yml`: Default configuration values
- `config/custom-environment-variables.yml`: Environment variable mappings for production
- `config/local.yml`: Local development configuration (create this file for local secrets)

## API Usage

### Request Format

Both endpoints (`/llm-proxy/generate` and `/llm-proxy/stream`) accept the following request format:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1000,
  "userId": "user-123"
}
```

### Provider Selection

You can specify the provider in your request:

#### OpenAI Example
```json
{
  "messages": [{"role": "user", "content": "Explain quantum computing"}],
  "provider": "openai",
  "model": "gpt-4",
  "userId": "user-123"
}
```

#### Anthropic Example
```json
{
  "messages": [{"role": "user", "content": "Explain quantum computing"}],
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "userId": "user-123"
}
```

#### Vertex AI Example
```json
{
  "messages": [{"role": "user", "content": "Explain quantum computing"}],
  "provider": "vertex",
  "model": "gemini-1.5-pro",
  "userId": "user-123"
}
```

### Default Behavior

If no provider is specified, the service defaults to OpenAI:

```json
{
  "messages": [{"role": "user", "content": "Hello!"}],
  "userId": "user-123"
}
```

This will use OpenAI with the default model configured in your environment.

## API Endpoints

### 1. Non-Streaming Generation

**Endpoint**: `POST /llm-proxy/generate`

**Response**:
```json
{
  "content": "Generated response text",
  "model": "gpt-4",
  "usage": {
    "totalTokens": 150
  },
  "finishReason": "stop"
}
```

### 2. Streaming Generation

**Endpoint**: `POST /llm-proxy/stream`

**Response**: Server-sent events stream with text chunks

## Analytics and Tracking

All requests are automatically tracked using Langfuse analytics, including:

- Provider used
- Model used
- Token usage
- Request/response timing
- User and organization information

The analytics data includes provider-specific information for better insights into usage patterns across different AI providers.

## Error Handling

The service includes comprehensive error handling for:

- Invalid API keys
- Model not available
- Rate limiting
- Network issues
- Invalid request parameters

Errors are returned with appropriate HTTP status codes and descriptive messages.

## Testing

The service includes comprehensive tests for multi-provider functionality:

```bash
# Run all tests
yarn test

# Run only unit tests
yarn test:unit

# Run only integration tests
yarn test:int
```

## Security Considerations

- Store API keys securely in `config/local.yml` for local development
- Use environment variables for production deployments
- Never commit API keys to version control (`config/local.yml` is in .gitignore)
- Use different API keys for different environments (dev, staging, prod)
- Monitor API usage and costs across all providers
- Implement rate limiting as needed

## Provider-Specific Notes

### OpenAI
- Requires valid API key from OpenAI platform
- Supports function calling and tool use
- Rate limits vary by model and subscription tier

### Anthropic
- Requires API key from Anthropic Console
- Claude models have different context windows
- Supports system messages and tool use

### Vertex AI
- Requires Google Cloud project with Vertex AI API enabled
- Uses service account authentication or application default credentials
- Regional availability varies by model

## Troubleshooting

### Common Issues

1. **"Cannot read properties of undefined (reading 'apiKey')"**
   - Ensure all required environment variables are set
   - Check that the provider configuration is complete

2. **"Provider not supported"**
   - Verify the provider name is one of: "openai", "anthropic", "vertex"
   - Check spelling and case sensitivity

3. **"Model not available"**
   - Verify the model name is correct for the selected provider
   - Check if the model is available in your region (for Vertex AI)

4. **Authentication errors**
   - Verify API keys are correct and active
   - For Vertex AI, ensure proper Google Cloud authentication

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

This will provide detailed information about provider selection, model initialization, and request processing.