import * as fs from "fs";
import * as path from "path";
import OpenAI from "openai";

interface StandConfig {
  /** Optional name for the test case */
  name?: string;
  /** Path to data file (array of objects) */
  dataFile: string;
  /** Prompt template with placeholders like `${field}` */
  prompt: string;
  /** LLM model id */
  model: string;
  /** Temperature for generation */
  temperature: number;
  /** Optional response format forwarded to OpenAI */
  response_format?: Record<string, any>;
  /** Optional evaluation prompt template. It receives variables `request` and `response` */
  evaluationPrompt?: string;
  /** Optional evaluation model (defaults to `model`) */
  evaluationModel?: string;
  /** Optional evaluation temperature (defaults to 0) */
  evaluationTemperature?: number;
  /** Output file where all results will be aggregated */
  outputFile?: string;
}

/**
 * Resolve value from object using dotted path (e.g. "user.name")
 */
function getValueByPath(obj: Record<string, any>, keyPath: string): any {
  return keyPath.split(".").reduce((acc: any, part) => (acc ? acc[part] : undefined), obj);
}

/**
 * Very small template engine – replaces `${key}` placeholders with values from `data`.
 * Supports dotted paths.
 */
function compilePrompt(template: string, data: Record<string, any>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const value = getValueByPath(data, key.trim());
    return value !== undefined && value !== null ? String(value) : "";
  });
}

async function processTestCase(
  testCase: StandConfig,
  configDir: string,
  openai: OpenAI,
): Promise<{ name: string; model: string; medianScore: number | null; errorCount: number }> {
  const dataPath = path.isAbsolute(testCase.dataFile)
    ? testCase.dataFile
    : path.join(configDir, testCase.dataFile);

  if (!fs.existsSync(dataPath)) {
    console.error(`Data file not found: ${dataPath}`);
    return { name: testCase.name || testCase.prompt.slice(0, 30), model: testCase.model, medianScore: null, errorCount: 0 };
  }

  const data: unknown[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  if (!Array.isArray(data)) {
    console.error(`Data file ${dataPath} must contain an array.`);
    return { name: testCase.name || testCase.prompt.slice(0, 30), model: testCase.model, medianScore: null, errorCount: 0 };
  }

  const outputFile = testCase.outputFile
    ? path.isAbsolute(testCase.outputFile)
      ? testCase.outputFile
      : path.join(configDir, testCase.outputFile)
    : path.join(configDir, `${testCase.name || path.basename(dataPath, path.extname(dataPath))}-results.json`);

  // Load existing results if any
  let results: any[] = [];
  if (fs.existsSync(outputFile)) {
    try {
      results = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
      if (!Array.isArray(results)) results = [];
    } catch (_) {
      results = [];
    }
  }

  console.log(`\n▶️  Running test "${testCase.name || testCase.prompt.slice(0, 30)}" on ${data.length} items...`);
  const entries = Array.from(data.entries());
  for (const [index, item] of entries) {
    try {
      const requestPrompt = compilePrompt(testCase.prompt, item as any);

      // 1. Main completion call
      const completionResponse = await openai.chat.completions.create({
        model: testCase.model,
        temperature: testCase.temperature,
        stream: false,
        messages: [{ role: "user", content: requestPrompt }],
        ...(testCase.response_format && { response_format: testCase.response_format }),
      } as any);

      const assistantMessage = completionResponse.choices[0].message.content ?? "";

      // If a JSON schema response format was requested, validate the assistant response.
      // Instead of throwing on failure, we will record score 0 with an explanatory comment and skip LLM evaluation.
      let validationError: string | null = null;
      if (testCase.response_format?.type === "json_schema") {
        let parsed: any;
        try {
          parsed = JSON.parse(assistantMessage);
        } catch (err: any) {
          validationError = `Assistant response is not valid JSON: ${err.message || err}`;
        }

        if (!validationError) {
          const requiredFields: string[] | undefined =
            (testCase.response_format as any).json_schema?.schema?.required;

          if (Array.isArray(requiredFields) && requiredFields.length > 0) {
            const missing = requiredFields.filter((field) => !(field in parsed));
            if (missing.length) {
              validationError = `Assistant response missing required field(s): ${missing.join(", ")}`;
            }
          }
        }
      }

      if (!testCase.evaluationPrompt) {
        console.log("No evaluation prompt, skipping evaluation");
        throw new Error("No evaluation prompt");
      }

      let evaluationData: { usage?: any; score: number | null; comment: string | null };

      if (validationError) {
        // Skip LLM evaluation and record the validation error
        evaluationData = {
          usage: null,
          score: null,
          comment: validationError,
        };
      } else {
        // 2. Evaluation call
        const evaluationPrompt = compilePrompt(testCase.evaluationPrompt, {
          request: requestPrompt,
          response: assistantMessage,
        });

        const evaluationResponse = await openai.chat.completions.create({
          model: testCase.evaluationModel || testCase.model,
          temperature: testCase.evaluationTemperature ?? 0,
          stream: false,
          // Enforce structured JSON output with required "score" and "comment" fields
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "evaluation_result",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  score: {
                    type: "number",
                    minimum: 1,
                    maximum: 10,
                    description: "Overall quality score from 1 (worst) to 10 (best)"
                  },
                  comment: {
                    type: "string",
                    description: "Brief explanation for the given score"
                  }
                },
                required: ["score", "comment"],
                additionalProperties: false
              }
            }
          },
          messages: [{ role: "user", content: evaluationPrompt }],
        } as any);

        const evaluationMessage = evaluationResponse.choices[0].message.content ?? "";

        // Parse the JSON returned by the evaluator. Fallback gracefully if parsing fails.
        let parsedEval: any = {};
        try {
          parsedEval = JSON.parse(evaluationMessage);
        } catch (_) {
          parsedEval = {};
        }

        evaluationData = {
          usage: evaluationResponse.usage,
          score: parsedEval.score ?? null,
          comment: parsedEval.comment ?? parsedEval.comments ?? evaluationMessage,
        };
      }

      const record = {
        testCase: testCase.name || testCase.prompt.slice(0, 30),
        index,
        input: item,
        requestPrompt,
        completion: {
          id: completionResponse.id,
          model: completionResponse.model,
          usage: completionResponse.usage,
          content: assistantMessage,
        },
        evaluation: evaluationData,
        timestamp: new Date().toISOString(),
      };

      results.push(record);

      // Persist after each iteration to avoid data loss
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

      console.log(`[${testCase.name || "test"}] Processed ${index + 1}/${data.length}`);
    } catch (err: any) {
      console.error(`[${testCase.name || "test"}] Error on index ${index}:`, err.message);
      // Record the error in results with a null score so it does not affect aggregate statistics
      const errorRecord = {
        testCase: testCase.name || testCase.prompt.slice(0, 30),
        index,
        input: item,
        error: err.message,
        completion: null,
        evaluation: { usage: null, score: null, comment: err.message },
        timestamp: new Date().toISOString(),
      };
      results.push(errorRecord);
      // Persist immediately
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    }
  }

  console.log(`✅ Test "${testCase.name || testCase.prompt.slice(0, 30)}" finished. Results -> ${outputFile}`);

  // Generate a quick evaluation report aggregating median score and comments
  const scores = results
    .map((r) => r.evaluation?.score)
    .filter((s): s is number => typeof s === "number");

  let medianScore: number | null = null;
  if (scores.length > 0) {
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianScore =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
  }

  const evaluationRecords = results.filter((r: any) => !(r as any).summary);
  const errorCount = evaluationRecords.filter((r: any) => r.evaluation?.score === null).length;

  const comments = results
    .map((r) => r.evaluation?.comment)
    .filter((c): c is string => typeof c === "string" && c.trim().length > 0);

  console.log("\n📊 Evaluation summary:");
  console.log(`Model               : ${testCase.model}`);
  console.log(`Median score        : ${medianScore ?? "N/A"}`);
  console.log(`Errors              : ${errorCount}`);

  console.log("\n──────────────\n");

  // Save summary as the last element in the same results file
  const summaryRecord = {
    summary: true,
    model: testCase.model,
    medianScore,
    errorCount,
    comments,
    timestamp: new Date().toISOString(),
  } as const;

  if (results.length && (results as any)[results.length - 1]?.summary) {
    // Replace previous summary if exists
    results[results.length - 1] = summaryRecord;
  } else {
    results.push(summaryRecord);
  }

  // Persist with summary
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  // Return summary for aggregate reporting
  return {
    name: testCase.name || testCase.prompt.slice(0, 30),
    model: testCase.model,
    medianScore,
    errorCount,
  };
}

async function run() {
  const configPath = process.argv[2] || path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const testCases: StandConfig[] = Array.isArray(raw) ? raw : [raw];

  if (testCases.length === 0) {
    console.error("Config must contain at least one test case.");
    process.exit(1);
  }

  const openai = new OpenAI({
    apiKey: process.env.LLM_PROXY_API_KEY,
    baseURL: "http://localhost:8080/v1",
  });

  const configDir = path.dirname(configPath);

  const aggregate: { name: string; model: string; medianScore: number | null; errorCount: number }[] = [];

  for (const tc of testCases) {
    const summary = await processTestCase(tc, configDir, openai);
    aggregate.push(summary);
  }

  // Print aggregate median scores
  console.log("\n📈 Aggregate results:");
  for (const { name, model, medianScore, errorCount } of aggregate) {
    console.log(`- ${name} (${model}): median ${medianScore ?? "N/A"}, errors ${errorCount}`);
  }

  console.log("\n🎉 All test cases completed!");
}

run();
