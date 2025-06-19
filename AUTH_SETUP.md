# Authentication Setup

This document describes the authentication middleware implemented for the LLM Proxy service.

## Overview

The LLM Proxy service now includes API key authentication for all endpoints. All requests must include a valid API key in the Authorization header.

## Configuration

### Environment Variable

Set the `AUTH_API_KEY` environment variable with your desired API key:

```bash
export AUTH_API_KEY="your-secret-api-key-here"
```

### Configuration File

The API key is automatically loaded from the environment variable through the configuration system defined in `config/custom-environment-variables.yml`:

```yaml
auth:
  apiKey: AUTH_API_KEY
```

## Usage

### Making Authenticated Requests

Include the API key in the Authorization header using one of these formats:

#### Option 1: Bearer Token (Recommended)
```bash
curl -H "Authorization: Bearer your-secret-api-key-here" \
     http://localhost:3000/v1/chat/health
```

#### Option 2: Direct API Key
```bash
curl -H "Authorization: your-secret-api-key-here" \
     http://localhost:3000/v1/chat/health
```

### Example with Chat Completion

```bash
curl -X POST \
  -H "Authorization: Bearer your-secret-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }' \
  http://localhost:3000/v1/chat/completions
```

## Protected Endpoints

All endpoints in the LLM Proxy controller are now protected:

- `GET /v1/chat/health` - Health check endpoint
- `POST /v1/chat/completions` - Chat completion endpoint

## Error Responses

### 401 Unauthorized

If authentication fails, the API returns a 401 status code with an error message:

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

Common causes for 401 errors:
- Missing Authorization header
- Invalid API key
- AUTH_API_KEY environment variable not configured

## Swagger Documentation

The API documentation is available at `/api` and includes authentication information:

- Bearer authentication is configured in Swagger
- All endpoints show the required authentication
- You can test authenticated endpoints directly from the Swagger UI

## Security Considerations

1. **Keep your API key secure**: Never commit API keys to version control
2. **Use environment variables**: Always set AUTH_API_KEY as an environment variable
3. **Use HTTPS in production**: Ensure all API communication is encrypted
4. **Rotate keys regularly**: Consider implementing key rotation policies

## Implementation Details

The authentication is implemented using:

- **AuthGuard**: A NestJS guard that validates the Authorization header
- **Configuration**: Uses the existing config system to load the API key
- **Logging**: Includes appropriate logging for security events
- **Error Handling**: Provides clear error messages for authentication failures

## Testing

You can test the authentication implementation by running:

```bash
npx ts-node src/auth/auth.guard.test.ts
```

This will run unit tests that verify:
- Missing authorization header handling
- Invalid API key rejection
- Valid API key acceptance
- Both Bearer token and direct API key formats