import { Test, TestingModule } from '@nestjs/testing';
import { expect } from 'chai';
import { LLMProxyService } from '../../src/llm-proxy/llm-proxy.service';
import { LLMProxyController } from '../../src/llm-proxy/llm-proxy.controller';
import { TokenAnalyticsService } from '../../src/token-analytics/token-analytics.service';
import { TokenAnalyticsParser } from '../../src/token-analytics/token-analytics.parser';
import { LLMProxyConfig } from '../../src/llm-proxy/llm-proxy.config';
import { TokenAnalyticsConfig } from '../../src/token-analytics/token-analytics.config';
import Langfuse from 'langfuse';

describe('LLM Proxy Integration Tests', () => {
  let controller: LLMProxyController;
  let service: LLMProxyService;

  before(async () => {
    const mockLLMConfig = {
      openai: {
        apiKey: 'test-key',
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
    };

    const mockAnalyticsConfig = {
      langfuse: {
        secretKey: 'test-secret',
        publicKey: 'test-public',
        baseUrl: 'https://test.langfuse.com',
      },
    };

    const mockLangfuse = {
      trace: () => ({
        generation: () => ({ end: () => {} }),
        update: () => {},
      }),
      shutdownAsync: async () => {},
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LLMProxyController],
      providers: [
        LLMProxyService,
        TokenAnalyticsService,
        TokenAnalyticsParser,
        {
          provide: LLMProxyConfig,
          useValue: mockLLMConfig,
        },
        {
          provide: TokenAnalyticsConfig,
          useValue: mockAnalyticsConfig,
        },
        {
          provide: Langfuse,
          useValue: mockLangfuse,
        },
        {
          provide: 'ITokenAnalyticsParser',
          useClass: TokenAnalyticsParser,
        },
      ],
    }).compile();

    controller = moduleFixture.get<LLMProxyController>(LLMProxyController);
    service = moduleFixture.get<LLMProxyService>(LLMProxyService);
  });

  it('should have controller and service defined', () => {
    expect(controller).to.be.ok;
    expect(service).to.be.ok;
  });

  it('should have proper module structure', () => {
    expect(controller).to.be.instanceOf(LLMProxyController);
    expect(service).to.be.instanceOf(LLMProxyService);
  });
});