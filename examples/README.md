# LLM Proxy Examples

This directory contains examples of how to use the llm-proxy service with different clients and providers.

## Node.js Example

The `nodejs-client.js` file demonstrates how to use the OpenAI SDK to connect to your llm-proxy and specify different providers.

### Setup

1. Install dependencies:
```bash
cd examples
npm install
```

2. Update the configuration in `nodejs-client.js`:
   - Set the correct `baseURL` for your llm-proxy instance
   - Set your API key

3. Run the examples:
```bash
npm start
```

### Features Demonstrated

1. **Provider Specification in Request Body**: How to specify the provider (`openai`, `anthropic`, `openrouter`) in the request body
2. **Auto Provider Detection**: How the proxy can automatically detect the provider based on the model name
3. **Streaming Responses**: How to handle streaming chat completions
4. **X-Provider Header**: How to override the provider using the `X-Provider` header

### Provider Examples

#### OpenAI
```javascript
const response = await client.chat.completions.create({
  model: 'gpt-3.5-turbo',
  provider: 'openai', // Specify provider
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

#### OpenRouter
```javascript
const response = await client.chat.completions.create({
  model: 'anthropic/claude-3-haiku',
  provider: 'openrouter', // Use OpenRouter
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

#### Anthropic
```javascript
const response = await client.chat.completions.create({
  model: 'claude-3-sonnet-20240229',
  provider: 'anthropic', // Use Anthropic directly
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

#### X-Provider Header Override
```javascript
// Using fetch directly to demonstrate header usage
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-api-key',
    'X-Provider': 'openrouter' // This overrides the provider in the body
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    provider: 'openai', // This will be overridden by the header
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});
```

## Configuration

Make sure your llm-proxy is configured with the appropriate API keys for each provider:

- `OPENAI_API_KEY` for OpenAI
- `ANTHROPIC_API_KEY` for Anthropic
- `OPENROUTER_API_KEY` for OpenRouter

## Notes

- The OpenAI SDK doesn't natively support custom fields like `provider`, but the llm-proxy accepts them in the request body
- The `X-Provider` header takes precedence over the `provider` field in the request body
- Auto-detection works by analyzing the model name patterns
- Streaming is supported for all providers