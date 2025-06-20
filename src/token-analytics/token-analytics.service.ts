import { Injectable, OnApplicationShutdown, Inject, Logger } from "@nestjs/common";
import Langfuse, { LangfuseGenerationClient, LangfuseTraceClient } from "langfuse";
import { ITokenAnalyticsParser } from "./token-analytics.models";
import { ITokenAnalyticsInputRequest, ITokenAnalyticsInputResponse } from "./token-analytics.models";

@Injectable()
export class TokenAnalyticsService implements OnApplicationShutdown {
  private readonly logger = new Logger(TokenAnalyticsService.name);

  constructor(
    private readonly analyticsClient: Langfuse,
    @Inject('ITokenAnalyticsParser') private readonly parser: ITokenAnalyticsParser
  ) {}

  public async startSession(request: ITokenAnalyticsInputRequest): Promise<{ trace: LangfuseTraceClient; generation: LangfuseGenerationClient }> {
    try {
      const traceData = this.parser.mapModuleInputToTraceData(request);
      
      const trace = this.analyticsClient.trace(traceData);

      const generationData = this.parser.mapModuleInputToGenerationData(request);
      
      const generation = trace.generation(generationData);
      return { trace, generation };
    } catch (error) {
      this.logger.error(`Error starting analytics session: ${error.message}`);
      throw error;
    }
  }

  public async endSession(trace: LangfuseTraceClient, generation: LangfuseGenerationClient, input: ITokenAnalyticsInputResponse): Promise<void> {
    try {
      const traceOutput = this.parser.mapModuleInputResponseToTraceOutput(input);
      const generationOutput = this.parser.mapModuleInputResponseToGenerationOutput(input);
      
      generation.end(generationOutput);
      trace.update(traceOutput);
    } catch (error) {
      this.logger.error(`Error ending analytics session: ${error.message}`);
      throw error;
    }
  }

  public async updateTrace(trace: LangfuseTraceClient, name: string): Promise<void> {
    try {
      trace.update({ name });
    } catch (error) {
      this.logger.error(`Error updating trace: ${error.message}`);
      throw error;
    }
  }

  public async onApplicationShutdown(): Promise<void> {
    try {
      await this.analyticsClient.shutdownAsync();
    } catch (error) {
      this.logger.error(`Error during Langfuse shutdown: ${error.message}`);
    }
  }
}