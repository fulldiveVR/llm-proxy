import { expect } from "chai";
import OpenAI from "openai";

const BASE_URL = process.env.LLM_PROXY_BASE_URL ?? "http://localhost:8080";
const API_KEY  = process.env.LLM_PROXY_API_KEY  ?? "test-key"; // user's token
const MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
// We explicitly test against two OSS GPT models – no env override.

// NOTE: We **don't** pull the model name from process.env in order to ensure
// these specific models are always exercised.

// ---------------------------------------------------------------------------
// Helper to run the same test logic for each model --------------------------
// ---------------------------------------------------------------------------

function forEachModel(cb: (model: string) => void) {
  MODELS.forEach(cb);
}

// The OpenAI SDK automatically prepends the path segment for each
// endpoint (e.g. "/chat/completions"), so we include "/v1" in the base URL.
const openai = new OpenAI({
  baseURL: `${BASE_URL.replace(/\/$/, "")}/v1`,
  apiKey: API_KEY,
  // Disable strict key validation – the proxy might return additional fields.
  dangerouslyAllowBrowser: true as any,
});

describe("LLM Proxy – end-to-end", function () {
  // LLMs might take a while to respond – increase Mocha's default timeout.
  this.timeout(30_000);

  forEachModel((MODEL) => {
    describe(`model: ${MODEL}`, () => {
      it("streams chat completion chunks", async () => {
        const stream = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "user", content: "Say hello in two words" },
          ],
          stream: true,
        });

        let chunkCount = 0;
        for await (const chunk of stream) {
          expect(chunk).to.have.property("choices");
          chunkCount += 1;
          // We just need to know that streaming works – a few chunks are enough.
          if (chunkCount >= 2) break;
        }

        expect(chunkCount).to.be.greaterThan(0);
      });

      it("returns structured output when response_format is json_schema", async () => {
        const response = await openai.chat.completions.create({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: "What is 2 + 2? Please respond with JSON matching the schema.",
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "math_response",
              description: "A mathematical calculation result",
              schema: {
                type: "object",
                properties: {
                  result: { type: "number" },
                  explanation: { type: "string" },
                },
                required: ["result", "explanation"],
                additionalProperties: false,
              },
              strict: true,
            },
          } as any, // SDK typings do not yet expose the json_schema variant
        });

        // Basic structural assertions – we are mainly interested that the proxy accepted
        // the request and produced a JSON payload respecting the schema.
        expect(response).to.have.property("choices");
        const content = response.choices?.[0]?.message?.content;
        expect(content).to.be.a("string");

        let parsed: any;
        try {
          parsed = JSON.parse(content as string);
        } catch (e) {
          // If parsing fails we want the test to fail – rethrow.
          throw new Error(`Response content is not valid JSON: ${content}`);
        }

        expect(parsed).to.be.an("object");
        expect(parsed).to.have.property("result").that.is.a("number");
        expect(parsed).to.have.property("explanation").that.is.a("string");
      });
    });
  });
});
