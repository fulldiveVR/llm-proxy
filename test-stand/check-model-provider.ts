import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

/**
 * This script iterates through every model/provider combination defined in
 * `test-stand/model-providers.json` and performs a **minimal** chat completion
 * request with `response_format` enabled. If the request succeeds we mark the
 * provider as `working: true`, otherwise `working: false` and capture the
 * error message (truncated) for later inspection.
 *
 * Usage (bash):
 *   OPENROUTER_API_KEY="sk-..." ts-node test-stand/check-model-provider.ts
 *
 * The resulting file is written to `test-stand/model-provider-results.json`.
 */

interface EndpointInfo {
  provider_name: string;
  context_length: number;
  pricing: Record<string, string>;
  response_format: boolean;
  // Runtime-only fields (added by this script)
  working?: boolean;
  error?: string;
}

type ModelProvidersMap = Record<string, EndpointInfo[]>;

envAssert("OPENROUTER_API_KEY");
const apiKey = process.env.OPENROUTER_API_KEY as string;

const PRICE_THRESHOLD = 0.0000008; // USD per completion token

const openrouter = new OpenAI({
  apiKey,
  // NOTE: OpenRouter uses the same wire-format as OpenAI but at a different host
  baseURL: "https://openrouter.ai/api/v1",
});

async function testProvider(modelId: string, provider: EndpointInfo): Promise<void> {
  // We attempt a *very* small request to keep the cost negligible.
  console.log(`🔍 Testing model '${modelId}' with provider '${provider.provider_name}'...`);
  try {
    const resp = await openrouter.chat.completions.create({
      model: modelId,
      provider: {
        order: [provider.provider_name],
        allow_fallbacks: false,
      }, // force concrete provider
      messages: [
        {
          role: "user",
          content: "2+3",
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
              result: { type: "number", description: "" },
              explanation: { type: "string", description: "" },
            },
            required: ["result", "explanation"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
      structured_outputs: true
    } as any);

    const payload = JSON.parse(resp.choices[0].message.content || "{}");

    const hasResult = typeof payload?.result === "number";
    const hasExplanation = typeof payload?.explanation === "string";

    if (hasResult && hasExplanation) {
      provider.working = true;
      console.log(`✅ ${modelId} with provider ${provider.provider_name} works and returned structured data`);
    } else {
      provider.working = false;
      provider.error = "Structured response missing required fields";
      console.error(`❌ ${modelId} with provider ${provider.provider_name} produced invalid structured output`);
    }
  } catch (err: any) {
    provider.working = false;
    provider.error = (err?.message || String(err)).substring(0, 200);
    console.error(`❌ ${modelId} with provider ${provider.provider_name} failed: ${provider.error}`);
  }
}

(async () => {
  const dataPath = path.join(__dirname, "data/model-providers.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const modelMap: ModelProvidersMap = JSON.parse(raw);

  // ----------------------------------
  // Filter providers exceeding price threshold
  // ----------------------------------

  for (const [model, providers] of Object.entries(modelMap)) {
    for (const provider of providers) {
      await testProvider(model, provider);
      // Delay slightly to be nice with rate limits
      await delay(250);
    }
  }

  const outPath = path.join(__dirname, "data/model-provider-results.json");
  fs.writeFileSync(outPath, JSON.stringify(modelMap, null, 2));
  console.log(`\n✅ Results written to ${outPath}`);
})();

function envAssert(name: string) {
  if (!process.env[name]) {
    console.error(`Environment variable '${name}' is required.`);
    process.exit(1);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

