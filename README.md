# LLM Proxy Service - OpenAI API Compatible

This implementation provides a comprehensive LLM proxy service with analytics tracking using Langfuse, built on NestJS framework with the Vercel AI SDK. **The service is fully compatible with the OpenAI API format**, making it a drop-in replacement for direct OpenAI API calls.

## Features

### 🚀 OpenAI API Compatible LLM Proxy
- **OpenAI API Endpoints**: Full compatibility with `/v1/chat/completions` endpoint
- **Drop-in Replacement**: Works seamlessly with any OpenAI API client
- **Streaming Support**: Server-Sent Events streaming compatible with OpenAI format
- **Multi-Provider Support**: OpenAI, Anthropic (Claude), and Google Vertex AI integration
- **Transparent Proxying**: Routes requests to appropriate providers while maintaining OpenAI API format
- **Authentication**: Bearer token authentication compatible with OpenAI API

### 📊 Analytics & Tracking
- **Langfuse Integration**: Complete session tracking with traces and generations
- **Token Usage Monitoring**: Tracks prompt, completion, and total tokens in OpenAI format
- **User Tracking**: Associates requests with user IDs for analytics
- **Environment Tagging**: Automatic environment tagging

## Architecture

This is a NestJS application that acts as an OpenAI API compatible proxy, routing requests to multiple LLM providers while maintaining a consistent API interface.

```
Client (OpenAI API format) → llm-proxy (/v1/chat/completions) → LLM Providers → OpenAI API format response
```

### Modules

#### 1. Token Analytics Module (`src/token-analytics/`)
- **TokenAnalyticsService**: Manages Langfuse sessions and tracking
- **TokenAnalyticsParser**: Maps data between internal models and Langfuse format
- **Models & Interfaces**: Type definitions for analytics data

#### 2. LLM Proxy Module (`src/llm-proxy/`)
- **LLMProxyService**: Core service handling AI model interactions with OpenAI API format responses
- **LLMProxyController**: OpenAI compatible REST endpoints (`/v1/chat/completions`)
- **LLMProxyConfig**: Configuration management for OpenAI, Anthropic, and Vertex AI settings
- **Models & DTOs**: OpenAI API compatible request/response models

#### 3. Infrastructure Module (`src/infrastructure/`)
- **ConfigModule**: Configuration management using node-config
- **Simplified setup**: No database or message queue dependencies

## API Endpoints

### POST `/v1/chat/completions`
**OpenAI API compatible endpoint** for chat completions with support for both streaming and non-streaming responses.

**Headers:**
```
Authorization: Bearer your-api-key
Content-Type: application/json
```

**Request Body (OpenAI API format):**
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2048,
  "stream": false,
  "user": "user-123"
}
```

**Supported Models:**
- **OpenAI**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, etc.
- **Anthropic**: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, etc.
- **Vertex AI**: `gemini-1.5-pro`, `gemini-1.5-flash`, etc.

**Non-Streaming Response (OpenAI API format):**
```json
{
  "id": "chatcmpl-123456789",
  "object": "chat.completion",
  "created": 1699000000,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

**Streaming Response (OpenAI API format):**
When `stream: true`, the response is sent as Server-Sent Events:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1699000000,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1699000000,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","created":1699000000,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

## Client Integration

### OpenAI Python Client
```python
import openai

client = openai.OpenAI(
    api_key="your-api-key",
    base_url="http://localhost:3000/v1"
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello, world!"}
    ]
)
```

### OpenAI Node.js Client
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: 'your-api-key',
    baseURL: 'http://localhost:3000/v1',
});

const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello, world!' }],
});
```

### LiteLLM Integration
```python
import litellm

# Configure LiteLLM to use the proxy
response = litellm.completion(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
    api_base="http://localhost:3000/v1",
    api_key="your-api-key"
)
```

### ai-wize-code Integration
```python
from openhands.core.config.llm_config import LLMConfig

config = LLMConfig(
    model="gpt-4",
    base_url="http://localhost:3000/v1",
    api_key="your-api-key",
    temperature=0.7,
    max_output_tokens=2000,
)
```

## Provider Selection

The proxy automatically determines the provider based on the model name:

- **OpenAI Models**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, etc.
- **Anthropic Models**: `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, etc.
- **Vertex AI Models**: `gemini-1.5-pro`, `gemini-1.5-flash`, etc.

You can also specify the provider explicitly using a custom header:
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "X-Provider: anthropic" \
  -H "Authorization: Bearer your-api-key" \
  -d '{"model": "claude-3-sonnet", "messages": [...]}'
```

## Configuration

The service uses YAML configuration files located in the `config/` directory:

- `config/default.yml`: Default configuration with all settings
- `config/custom-environment-variables.yml`: Environment variable mappings for production
- `config/local.yml`: Local development configuration (create this file for local secrets)

#### Local Development Setup

For local development, create a `config/local.yml` file with your API keys:

```yaml
# config/local.yml (create this file locally, not committed to git)
llmProxy:
  openai:
    apiKey: "your-openai-api-key-here"
  anthropic:
    apiKey: "your-anthropic-api-key-here"
  vertexAI:
    projectId: "your-gcp-project-id"
    location: "us-central1"
    # For local development, set up Application Default Credentials
    # or provide service account key path

langfuse:
  secretKey: "your-langfuse-secret-key-here"
  publicKey: "your-langfuse-public-key-here"
  baseUrl: "https://cloud.langfuse.com"

app:
  port: 54011
  host: "0.0.0.0"
```

#### Production Configuration

In production, environment variables will be automatically mapped via `custom-environment-variables.yml`:

- `OPENAI_API_KEY` → OpenAI API key
- `ANTHROPIC_API_KEY` → Anthropic API key  
- `VERTEX_AI_PROJECT_ID` → Google Cloud project ID
- `LANGFUSE_SECRET_KEY` → Langfuse secret key
- `LANGFUSE_PUBLIC_KEY` → Langfuse public key
- `PORT` → Application port
- `HOST` → Application host

## Installation & Setup

1. **Install dependencies:**
   ```bash
   yarn install
   ```

2. **Set up local configuration:**
   ```bash
   # Create local configuration file with your API keys
   cp config/default.yml config/local.yml
   # Edit config/local.yml with your actual API keys
   ```

3. **Build the application:**
   ```bash
   yarn build
   ```

4. **Start the application:**
   ```bash
   yarn start:dev
   ```

## Usage Examples

### Basic Text Generation

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing in simple terms"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 2048,
    "user": "user-123"
  }'
```

### Streaming Response

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {
        "role": "user",
        "content": "Write a short story about AI"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 2048,
    "stream": true,
    "user": "user-123"
  }'
```

## Analytics Dashboard

Access your Langfuse dashboard to view:
- Request traces and generations
- Token usage analytics
- User metrics
- Performance monitoring
- Cost tracking

## Security Features

- **Input validation**: All requests validated using Zod schemas
- **Error handling**: Comprehensive error handling with proper HTTP status codes
- **Environment isolation**: Environment-based configuration
- **API key security**: Secure handling of OpenAI and Langfuse credentials

## Testing

Run the test suite:

```bash
# Unit tests
yarn test:unit

# Integration tests
yarn test:int

# All tests
yarn test

# Test coverage
yarn test:cov
```

## Dependencies

### Core Dependencies
- `@nestjs/common`: NestJS framework
- `ai`: Vercel AI SDK for LLM interactions
- `@ai-sdk/openai`: OpenAI provider for Vercel AI SDK
- `langfuse`: Analytics and observability platform
- `zod`: Schema validation
- `config`: Configuration management

### Development Dependencies
- `@nestjs/testing`: Testing utilities
- `mocha`: Testing framework
- `supertest`: HTTP testing
- `eslint`: Code linting

### Removed Dependencies
This implementation has removed the following dependencies for simplification:
- `mongodb`: Database functionality removed
- `@golevelup/nestjs-rabbitmq`: Message queue functionality removed
- `@nestjs/jwt`: Authentication simplified
- `@nestjs/microservices`: Microservices support removed
- `@nestjs/event-emitter`: Event handling removed

## Monitoring & Observability

The service provides comprehensive monitoring through:

1. **Langfuse Analytics**: Detailed traces, generations, and usage metrics
2. **NestJS Logging**: Structured application logs
3. **Error Tracking**: Comprehensive error handling and reporting
4. **Performance Metrics**: Request timing and token usage tracking

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new features
3. Update documentation for API changes
4. Ensure all tests pass before submitting

## License

This project is part of the AI-Wayz template and follows the same licensing terms.

## Migration from Custom Format

### ⚠️ Breaking Changes

This version introduces **breaking changes** to achieve full OpenAI API compatibility:

#### API Endpoints
- **Old**: `POST /llm-proxy/generate` and `POST /llm-proxy/stream`
- **New**: `POST /v1/chat/completions` (handles both streaming and non-streaming)

#### Request Format
- **Old**: Custom format with `provider`, `maxTokens`, `userId` fields
- **New**: OpenAI API format with `max_tokens`, `user`, `stream` fields

#### Response Format
- **Old**: Custom format with `content`, `usage.totalTokens` structure
- **New**: OpenAI API format with `choices[].message.content`, `usage.total_tokens` structure

#### Authentication
- **Old**: No authentication or custom headers
- **New**: Bearer token authentication via `Authorization` header

### Migration Guide

#### 1. Update API Endpoints
```bash
# Old
curl -X POST http://localhost:3000/llm-proxy/generate

# New  
curl -X POST http://localhost:3000/v1/chat/completions
```

#### 2. Update Request Format
```json
// Old format
{
  "messages": [...],
  "provider": "openai",
  "model": "gpt-4",
  "maxTokens": 2048,
  "userId": "user-123"
}

// New format (OpenAI API compatible)
{
  "model": "gpt-4",
  "messages": [...],
  "max_tokens": 2048,
  "user": "user-123",
  "stream": false
}
```

#### 3. Update Response Handling
```javascript
// Old response format
{
  "content": "Response text",
  "usage": {
    "totalTokens": 25,
    "promptTokens": 10,
    "completionTokens": 15
  }
}

// New response format (OpenAI API compatible)
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant", 
      "content": "Response text"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "total_tokens": 25,
    "prompt_tokens": 10,
    "completion_tokens": 15
  }
}
```

#### 4. Add Authentication
```bash
# Add Authorization header
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json"
```

### Benefits of Migration

1. **Universal Compatibility**: Works with any OpenAI API client
2. **Zero Integration Effort**: Drop-in replacement for OpenAI API
3. **Ecosystem Support**: Compatible with LiteLLM, LangChain, and other tools
4. **Future-Proof**: Follows industry standard API format

## Troubleshooting

### Common Issues

1. **404 Not Found**: Make sure you're using `/v1/chat/completions` endpoint
2. **401 Unauthorized**: Add `Authorization: Bearer your-api-key` header
3. **400 Bad Request**: Ensure request body follows OpenAI API format
4. **Model Not Supported**: Check that the model name is supported by the target provider

### Debug Steps

1. Check service logs: `docker logs llm-proxy` or console output
2. Verify endpoint: `curl http://localhost:3000/health`
3. Test with OpenAI client: Use official OpenAI SDK with proxy base URL
4. Validate request format: Ensure JSON matches OpenAI API specification