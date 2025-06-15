import { expect } from 'chai';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenAnalyticsService } from '../../src/token-analytics/token-analytics.service';
import { TokenAnalyticsParser } from '../../src/token-analytics/token-analytics.parser';
import Langfuse from 'langfuse';

describe('TokenAnalyticsService', () => {
  let service: TokenAnalyticsService;
  let mockLangfuse: any;

  beforeEach(async () => {
    mockLangfuse = {
      trace: () => ({
        generation: () => ({ end: () => {} }),
        update: () => {},
      }),
      shutdownAsync: async () => {},
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenAnalyticsService,
        TokenAnalyticsParser,
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

    service = module.get<TokenAnalyticsService>(TokenAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).to.be.ok;
  });

  it('should start a session', async () => {
    const request = {
      traceName: 'test-trace',
      generationName: 'test-generation',
      userId: 'user-1',
      model: 'gpt-4',
      input: [{ role: 'user', content: 'Hello' }],
    };

    const result = await service.startSession(request);

    expect(result).to.have.property('trace');
    expect(result).to.have.property('generation');
  });

  it('should end a session', async () => {
    const mockTrace = { update: () => {} };
    const mockGeneration = { end: () => {} };

    const response = {
      output: 'Hello there!',
      usage: { totalTokens: 10 },
    };

    // Should not throw
    await service.endSession(mockTrace as any, mockGeneration as any, response);
  });
});