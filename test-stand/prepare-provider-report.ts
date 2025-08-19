import * as fs from "fs";
import * as path from "path";

// Path to the JSON containing the probing results for each model provider
const RESULTS_FILENAME = "data/model-provider-results.json";

// Path where the rendered markdown report will be written
const REPORT_FILENAME = "data/provider-report.md";

// Resolve absolute paths (assuming the script lives in the same directory as the data file)
const resultsFilePath = path.resolve(__dirname, RESULTS_FILENAME);
const reportFilePath = path.resolve(__dirname, REPORT_FILENAME);

// 1. Read & parse the JSON file ------------------------------------------------
let raw: string;
try {
  raw = fs.readFileSync(resultsFilePath, "utf-8");
} catch (err) {
  console.error(`❌  Failed to read ${resultsFilePath}:`, err);
  process.exit(1);
}

let parsed: Record<string, Array<any>>;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(`❌  ${RESULTS_FILENAME} is not valid JSON:`, err);
  process.exit(1);
}

// 2. Build the markdown report -------------------------------------------------
let md: string[] = [];
md.push("# Working Model Providers Report\n");
md.push(
  "This report lists all *working* providers for each model found in the results file along with the `completion` price (in USD per token) and their supported **context length**. Generated automatically by `prepare-provider-report.ts`.\n\n"
);

for (const [modelName, providers] of Object.entries(parsed)) {
  const working = (providers as Array<any>).filter((p) => p.working);
  if (working.length === 0) continue; // Skip models with no working providers

  md.push(`## ${modelName}\n`);
  md.push(`| Provider | Completion price | Ctx length |
| -------- | ---------------- | ---------- |`);

  for (const p of working) {
    const price = p.pricing?.completion ?? "N/A";
    const ctx = p.context_length ?? "N/A";
    md.push(`| ${p.provider_name} | ${price} | ${ctx} |`);
  }

  // Add JSON list of provider names
  const providerNames = working.map((p) => p.provider_name);
  md.push("```json");
  md.push(JSON.stringify(providerNames, null, 2));
  md.push("```");

  md.push("\n");
}

const markdownContent = md.join("\n");

// 3. Write the report ----------------------------------------------------------
try {
  fs.writeFileSync(reportFilePath, markdownContent);
  console.log(`✅  Report written to ${reportFilePath}`);
} catch (err) {
  console.error(`❌  Failed to write report to ${reportFilePath}:`, err);
  process.exit(1);
}

