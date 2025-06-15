import { expect } from 'chai';
import { Test, TestingModule } from '@nestjs/testing';
import { LLMProxyService } from '../../src/llm-proxy/llm-proxy.service';
import { TokenAnalyticsService } from '../../src/token-analytics';
import { LLMProxyConfig } from '../../src/llm-proxy/llm-proxy.config';

describe('LLMProxyService', () => {
  let service: LLMProxyService;
  let mockTokenAnalytics: any;
  let mockConfig: LLMProxyConfig;

  beforeEach(async () => {
    mockTokenAnalytics = {
      startSession: async () => ({
        trace: { update: () => {} },
        generation: { end: () => {} },
      }),
      endSession: async () => {},
      updateTrace: async () => {},
    };

    mockConfig = {
      openai: {
        apiKey: 'test-api-key',
        defaultModel: 'gpt-4',
        maxTokens: 2048,
      },
      anthropic: {
        apiKey: 'test-anthropic-key',
        defaultModel: 'claude-3-5-sonnet-20241022',
        maxTokens: 2048,
      },
      vertex: {
        projectId: 'test-project',
        location: 'us-central1',
        defaultModel: 'gemini-1.5-pro',
        maxTokens: 2048,
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMProxyService,
        {
          provide: TokenAnalyticsService,
          useValue: mockTokenAnalytics,
        },
        {
          provide: LLMProxyConfig,
          useValue: mockConfig,
        },
      ],
    }).compile();

    service = module.get<LLMProxyService>(LLMProxyService);
  });

  it('should be defined', () => {
    expect(service).to.be.ok;
  });

  // Note: Full integration tests would require actual OpenAI API calls
  // These are basic structure tests
});