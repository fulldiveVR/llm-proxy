import { Injectable, OnApplicationShutdown, Inject } from "@nestjs/common";
import Langfuse, { LangfuseGenerationClient, LangfuseTraceClient } from "langfuse";
import { ITokenAnalyticsParser } from "./token-analytics.models";
import { ITokenAnalyticsInputRequest, ITokenAnalyticsInputResponse } from "./token-analytics.models";

@Injectable()
export class TokenAnalyticsService implements OnApplicationShutdown {
  constructor(
    private readonly analyticsClient: Langfuse,
    @Inject('ITokenAnalyticsParser') private readonly parser: ITokenAnalyticsParser
  ) {}

  public async startSession(request: ITokenAnalyticsInputRequest): Promise<{ trace: LangfuseTraceClient; generation: LangfuseGenerationClient }> {
    const traceData = this.parser.mapModuleInputToTraceData(request);
    const trace = this.analyticsClient.trace(traceData);

    const generationData = this.parser.mapModuleInputToGenerationData(request);
    const generation = trace.generation(generationData);
    return { trace, generation };
  }

  public async endSession(trace: LangfuseTraceClient, generation: LangfuseGenerationClient, input: ITokenAnalyticsInputResponse): Promise<void> {
    const traceOutput = this.parser.mapModuleInputResponseToTraceOutput(input);
    const generationOutput = this.parser.mapModuleInputResponseToGenerationOutput(input);
    generation.end(generationOutput);
    trace.update(traceOutput);
  }

  public async updateTrace(trace: LangfuseTraceClient, name: string): Promise<void> {
    trace.update({ name });
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.analyticsClient.shutdownAsync();
  }
}