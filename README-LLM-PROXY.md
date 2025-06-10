# LLM Proxy Service with Langfuse Analytics

This implementation provides a comprehensive LLM proxy service with analytics tracking using Langfuse, built on NestJS framework with the Vercel AI SDK.

## Features

### 🚀 LLM Proxy Service
- **Non-streaming responses**: `/llm-proxy/generate` endpoint for standard text generation
- **Streaming responses**: `/llm-proxy/stream` endpoint for real-time streaming
- **Multi-Provider Support**: OpenAI, Anthropic (Claude), and Google Vertex AI integration
- **Flexible model support**: Configurable model selection across all providers
- **Request validation**: Comprehensive input validation using Zod schemas
- **Provider Selection**: Dynamic provider switching based on request parameters

### 📊 Analytics & Tracking
- **Langfuse Integration**: Complete session tracking with traces and generations
- **Token Usage Monitoring**: Tracks prompt, completion, and total tokens
- **User Tracking**: Associates requests with user IDs for analytics
- **Environment Tagging**: Automatic environment tagging

## Architecture

This is a simplified NestJS application focused solely on LLM proxy functionality. All authentication, database, and message queue dependencies have been removed for a lightweight implementation.

### Modules

#### 1. Token Analytics Module (`src/token-analytics/`)
- **TokenAnalyticsService**: Manages Langfuse sessions and tracking
- **TokenAnalyticsParser**: Maps data between internal models and Langfuse format
- **Models & Interfaces**: Type definitions for analytics data

#### 2. LLM Proxy Module (`src/llm-proxy/`)
- **LLMProxyService**: Core service handling AI model interactions across multiple providers
- **LLMProxyController**: REST endpoints for generation and streaming
- **LLMProxyConfig**: Configuration management for OpenAI, Anthropic, and Vertex AI settings
- **Models & DTOs**: Request/response models with validation and provider selection

#### 3. Infrastructure Module (`src/infrastructure/`)
- **ConfigModule**: Configuration management using node-config
- **Simplified setup**: No database or message queue dependencies

## API Endpoints

### POST `/llm-proxy/generate`
Generate a non-streaming response from the LLM.

**Request Body:**
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
  "maxTokens": 2048,
  "userId": "user-123"
}
```

**Supported Providers:**
- `openai`: GPT-4, GPT-3.5-turbo, etc.
- `anthropic`: Claude 3.5 Sonnet, Claude 3 Opus, etc.
- `vertex`: Gemini 1.5 Pro, Gemini 1.5 Flash, etc.

**Response:**
```json
{
  "content": "Hello! I'm doing well, thank you for asking...",
  "usage": {
    "totalTokens": 25,
    "promptTokens": 10,
    "completionTokens": 15
  }
}
```

### POST `/llm-proxy/stream`
Generate a streaming response from the LLM.

**Request Body:** Same as `/generate`

**Response:** Server-Sent Events (SSE) stream with real-time content chunks.

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
curl -X POST http://localhost:3000/llm-proxy/generate \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Explain quantum computing in simple terms"
      }
    ],
    "model": "gpt-4",
    "userId": "user-123"
  }'
```

### Streaming Response

```bash
curl -X POST http://localhost:3000/llm-proxy/stream \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Write a short story about AI"
      }
    ],
    "model": "gpt-4",
    "userId": "user-123"
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