import { INestApplication, CanActivate, ExecutionContext } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { expect } from "chai";

import { LLMProxyController } from "../../src/llm-proxy/llm-proxy.controller";
import { LLMProxyService } from "../../src/llm-proxy/llm-proxy.service";
import { AuthGuard } from "../../src/auth/auth.guard";
import { CreditsByModelsGuard } from "../../src/credits/credits-by-models.guard";
import type { ILLMRequest, ChatCompletionResponseDto, ChatCompletionChunkDto } from "../../src/llm-proxy/llm-proxy.models";

// ---------------------------------------------------------------------------
// Mock implementations -------------------------------------------------------
// ---------------------------------------------------------------------------

class MockLLMProxyService {
  async generateResponse(req: ILLMRequest): Promise<ChatCompletionResponseDto> {
    return {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: Date.now() / 1000,
      model: req.model,
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "Hello world",
          },
        } as any,
      ],
    } as any;
  }

  generateStreamingResponse(req: ILLMRequest): AsyncGenerator<ChatCompletionChunkDto> {
    async function* generator() {
      yield {
        id: "chunk-1",
        object: "chat.completion.chunk",
        created: Date.now() / 1000,
        model: req.model,
        choices: [
          {
            index: 0,
            delta: { content: "Hello" },
            finish_reason: null,
          },
        ],
      } as any;
      yield {
        id: "chunk-2",
        object: "chat.completion.chunk",
        created: Date.now() / 1000,
        model: req.model,
        choices: [
          {
            index: 0,
            delta: { content: " world" },
            finish_reason: "stop",
          },
        ],
      } as any;
    }
    return generator();
  }
}

class PassThroughGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Attach a dummy user so that the @AuthUser decorator works.
    const req: any = _context.switchToHttp().getRequest();
    req.user = { id: "test-user", provider: { email: { id: "user@test.com" } } };
    return true;
  }
}

// ---------------------------------------------------------------------------
// Test suite ----------------------------------------------------------------
// ---------------------------------------------------------------------------

describe("LLMProxyController routes", () => {
  let app: INestApplication;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LLMProxyController],
      providers: [
        { provide: LLMProxyService, useClass: MockLLMProxyService },
        // Override guards so they always pass
        { provide: AuthGuard, useClass: PassThroughGuard },
        { provide: CreditsByModelsGuard, useClass: PassThroughGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it("GET /v1/chat/health returns service status", async () => {
    await request(app.getHttpServer())
      .get("/v1/chat/health")
      .expect(200)
      .expect((res) => {
        expect(res.body).to.have.property("status", "ok");
        expect(res.body).to.have.property("service", "llm-proxy");
      });
  });

  it("POST /v1/chat/completions returns a chat completion", async () => {
    await request(app.getHttpServer())
      .post("/v1/chat/completions")
      .set("Authorization", "Bearer test-token")
      .send({
        model: "gpt-4",
        messages: [
          { role: "user", content: "Hello" },
        ],
        stream: false,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).to.have.property("id");
        expect(res.body).to.have.property("choices").that.is.an("array");
      });
  });

  it("POST /v1/chat/completions supports streaming", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/chat/completions")
      .set("Authorization", "Bearer test-token")
      .send({
        model: "gpt-4",
        messages: [ { role: "user", content: "Hello" } ],
        stream: true,
      })
      .expect(200)
      .expect("content-type", /text\/event-stream/);

    // The entire body is a string containing multiple SSE events.
    const bodyStr = response.text || "";
    const events = bodyStr.split("\n\n").filter(Boolean); // split by double newline
    // Expect at least one data event and the DONE terminator
    expect(events.some((e) => e.startsWith("data: {"))).to.be.true;
    expect(events[events.length - 1]).to.equal("data: [DONE]");
  });
});
