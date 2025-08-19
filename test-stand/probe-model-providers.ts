import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

// ------------------------------------------------------------------------------------------------
// Types & Helpers
// ------------------------------------------------------------------------------------------------

interface EndpointInfo {
  provider_name: string;
  context_length: number;
  pricing: Record<string, string>;
  response_format: boolean;
  // Runtime-only fields
  working?: boolean;
  error?: string;
}

type ModelProvidersMap = Record<string, EndpointInfo[]>;

function envAssert(name: string) {
  if (!process.env[name]) {
    console.error(`Environment variable '${name}' is required.`);
    process.exit(1);
  }
}

async function fetchModelEndpoints(modelId: string, apiKey: string): Promise<EndpointInfo[]> {
  const [author, slug] = modelId.split("/");
  if (!author || !slug) throw new Error(`Invalid model identifier: ${modelId}`);

  const url = `https://openrouter.ai/api/v1/models/${author}/${slug}/endpoints`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${modelId}: ${res.status} ${res.statusText}`);
  }

  const json: any = await res.json();
  const endpoints: any[] = json?.data?.endpoints ?? [];
  return endpoints.map((ep) => ({
    provider_name: ep.tag,
    context_length: ep.context_length,
    pricing: ep.pricing ?? {},
    response_format: Array.isArray(ep.supported_parameters)
      ? ep.supported_parameters.includes("response_format")
      : false,
  }));
}

async function testProvider(modelId: string, provider: EndpointInfo, client: OpenAI): Promise<void> {
  console.log(`🔍 Testing model '${modelId}' with provider '${provider.provider_name}'...`);
  try {
    const resp = await (client as any).chat.completions.create({
      model: modelId,
      provider: {
        order: [provider.provider_name],
        allow_fallbacks: false,
      },
      messages: [{ role: "user", content: "2+3" }],
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
      structured_outputs: true,
    });

    const payload = JSON.parse((resp as any).choices[0].message.content || "{}");
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateMarkdownReport(modelMap: ModelProvidersMap): string {
  const md: string[] = [];
  md.push("# Working Model Providers Report\n");
  md.push(
    "This report lists all *working* providers for each model along with the `completion` price (USD per token) and their supported **context length**. Generated automatically by `probe-model-providers.ts`.\n\n",
  );

  for (const [modelName, providers] of Object.entries(modelMap)) {
    const working = providers.filter((p) => p.working);
    if (working.length === 0) continue;

    md.push(`## ${modelName}\n`);
    md.push(`| Provider | Completion price | Ctx length |
| -------- | ---------------- | ---------- |`);

    for (const p of working) {
      const price = p.pricing?.completion ?? "N/A";
      const ctx = p.context_length ?? "N/A";
      md.push(`| ${p.provider_name} | ${price} | ${ctx} |`);
    }

    const providerNames = working.map((p) => p.provider_name);
    md.push("```json");
    md.push(JSON.stringify(providerNames, null, 2));
    md.push("```");
    md.push("\n");
  }

  return md.join("\n");
}

// ------------------------------------------------------------------------------------------------
// Main CLI entrypoint
// ------------------------------------------------------------------------------------------------

(async () => {
  const models = process.argv.slice(2);
  if (models.length === 0) {
    console.log("Usage: yarn probe:providers <author/slug> [author/slug ...]\n");
    console.log("Example: yarn probe:providers meta-llama/llama-4-maverick openai/gpt-oss-20b\n");
    return;
  }

  envAssert("OPENROUTER_API_KEY");
  const apiKey = process.env.OPENROUTER_API_KEY as string;

  const modelMap: ModelProvidersMap = {};
  for (const modelId of models) {
    try {
      const endpoints = await fetchModelEndpoints(modelId, apiKey);
      modelMap[modelId] = endpoints;
    } catch (err: any) {
      console.error(err.message || err);
      modelMap[modelId] = [];
    }
  }

  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });

  for (const [model, providers] of Object.entries(modelMap)) {
    for (const provider of providers) {
      await testProvider(model, provider, client);
      // Be gentle with rate limits
      await delay(250);
    }
  }

  const resultsDir = path.resolve(__dirname, "data", "results");
  fs.mkdirSync(resultsDir, { recursive: true });

  const jsonPath = path.join(resultsDir, "model-provider-results.json");
  fs.writeFileSync(jsonPath, JSON.stringify(modelMap, null, 2));
  console.log(`\n✅ Results written to ${jsonPath}`);

  const markdownPath = path.join(resultsDir, "provider-report.md");
  fs.writeFileSync(markdownPath, generateMarkdownReport(modelMap));
  console.log(`✅ Report written to ${markdownPath}`);
})();
