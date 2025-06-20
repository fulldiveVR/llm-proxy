/**
 * Example of using llm-proxy with OpenAI SDK for Node.js
 * 
 * This example shows how to use the OpenAI SDK to connect to our llm-proxy
 * and specify different providers in the request body.
 */

const OpenAI = require('openai');

// Initialize OpenAI client with our proxy URL
const client = new OpenAI({
  baseURL: 'http://localhost:3000/v1/chat', // Your llm-proxy URL
  apiKey: 'your-api-key-here', // Your API key for the proxy
});

async function exampleWithOpenAI() {
  try {
    console.log('🤖 Testing OpenAI provider...');
    
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      provider: 'openai', // Specify provider in request body
      messages: [
        {
          role: 'user',
          content: 'Hello! Can you tell me a short joke?'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    console.log('✅ OpenAI Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ OpenAI Error:', error.message);
  }
}

async function exampleWithOpenRouter() {
  try {
    console.log('🚀 Testing OpenRouter provider...');
    
    const response = await client.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      provider: 'openrouter', // Specify OpenRouter provider
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France?'
        }
      ],
      max_tokens: 50,
      temperature: 0.3
    });

    console.log('✅ OpenRouter Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ OpenRouter Error:', error.message);
  }
}

async function exampleWithAnthropic() {
  try {
    console.log('🧠 Testing Anthropic provider...');
    
    const response = await client.chat.completions.create({
      model: 'claude-3-sonnet-20240229',
      provider: 'anthropic', // Specify Anthropic provider
      messages: [
        {
          role: 'user',
          content: 'Explain quantum computing in one sentence.'
        }
      ],
      max_tokens: 100,
      temperature: 0.5
    });

    console.log('✅ Anthropic Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ Anthropic Error:', error.message);
  }
}

async function exampleWithAutoDetection() {
  try {
    console.log('🔍 Testing auto provider detection...');
    
    const response = await client.chat.completions.create({
      model: 'gpt-4', // Provider will be auto-detected from model name
      // No provider specified - will be auto-detected
      messages: [
        {
          role: 'user',
          content: 'What is machine learning?'
        }
      ],
      max_tokens: 150,
      temperature: 0.6
    });

    console.log('✅ Auto-detected Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ Auto-detection Error:', error.message);
  }
}

async function exampleWithStreaming() {
  try {
    console.log('📡 Testing streaming response...');
    
    const stream = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      messages: [
        {
          role: 'user',
          content: 'Write a short poem about coding.'
        }
      ],
      max_tokens: 200,
      temperature: 0.8,
      stream: true // Enable streaming
    });

    console.log('✅ Streaming Response:');
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log('\n');
  } catch (error) {
    console.error('❌ Streaming Error:', error.message);
  }
}

// Example with X-Provider header (using fetch directly)
async function exampleWithXProviderHeader() {
  try {
    console.log('📋 Testing X-Provider header...');
    
    const response = await fetch('http://localhost:3000/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-api-key-here',
        'X-Provider': 'openrouter' // Override provider via header
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Model suggests OpenAI
        provider: 'openai', // Body says OpenAI
        // But X-Provider header will override to use OpenRouter
        messages: [
          {
            role: 'user',
            content: 'Hello from header override!'
          }
        ],
        max_tokens: 50
      })
    });

    const data = await response.json();
    console.log('✅ X-Provider Header Response:', data.choices[0].message.content);
  } catch (error) {
    console.error('❌ X-Provider Header Error:', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  console.log('🚀 Starting llm-proxy examples...\n');
  
  await exampleWithOpenAI();
  console.log('');
  
  await exampleWithOpenRouter();
  console.log('');
  
  await exampleWithAnthropic();
  console.log('');
  
  await exampleWithAutoDetection();
  console.log('');
  
  await exampleWithStreaming();
  console.log('');
  
  await exampleWithXProviderHeader();
  console.log('');
  
  console.log('✨ All examples completed!');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  exampleWithOpenAI,
  exampleWithOpenRouter,
  exampleWithAnthropic,
  exampleWithAutoDetection,
  exampleWithStreaming,
  exampleWithXProviderHeader
};