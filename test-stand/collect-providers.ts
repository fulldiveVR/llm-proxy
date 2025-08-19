import * as fs from "fs";
import * as path from "path";

/**
 * List of models to inspect. Each entry must follow the "author/slug" format
 * as required by the OpenRouter HTTP API.
 */
const models = [
  "meta-llama/llama-4-maverick",
  "meta-llama/llama-3.1-70b-instruct",
  "meta-llama/llama-4-scout",
  "qwen/qwen3-235b-a22b-2507",
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b"
] as const;

type EndpointInfo = {
  provider_name: string;
  context_length: number;
  pricing: Record<string, string>;
  response_format: boolean;
};

type ModelProvidersMap = Record<string, EndpointInfo[]>;

/**
 * Fetch provider information for a single model from the OpenRouter API.
 */
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

/**
 * Collect provider information for all models in the `models` array.
 */
export async function collectModelProviders(): Promise<ModelProvidersMap> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Environment variable OPENROUTER_API_KEY is not set");
  }

  const result: ModelProvidersMap = {};

  await Promise.all(
    models.map(async (modelId) => {
      try {
        const endpoints = await fetchModelEndpoints(modelId, apiKey);
        result[modelId] = endpoints;
      } catch (err: any) {
        console.error(err.message || err);
      }
    }),
  );

  return result;
}

if (require.main === module) {
  // When executed directly, fetch data and print/save it
  (async () => {
    try {
      const data = await collectModelProviders();
      const outPath = path.join(__dirname, "data/model-providers.json");
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      console.log(`\n✅ Provider information saved to ${outPath}`);
    } catch (err: any) {
      console.error("❌ Error:", err.message || err);
      process.exit(1);
    }
  })();
}