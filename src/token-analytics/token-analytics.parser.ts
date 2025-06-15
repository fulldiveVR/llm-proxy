import { Injectable } from "@nestjs/common";
import {
  IGenerationInputData,
  IGenerationOutputData,
  ITokenAnalyticsInputRequest,
  ITokenAnalyticsInputResponse,
  ITokenAnalyticsParser,
  ITraceInputData,
  ITraceOutputData,
} from "./token-analytics.models";

@Injectable()
export class TokenAnalyticsParser implements ITokenAnalyticsParser {
  public mapModuleInputToTraceData(request: ITokenAnalyticsInputRequest): ITraceInputData {
    const tags = [process.env.DEPLOY_ENV ?? "local"];

    return {
      name: request.traceName,
      userId: request.userId,
      tags,
      input: request.input,
    };
  }

  public mapModuleInputToGenerationData(request: ITokenAnalyticsInputRequest): IGenerationInputData {
    return {
      name: request.generationName,
      startTime: new Date(),
      model: request.model,
      modelParameters: {
        temperature: request.temperature,
      },
      input: request.input,
    };
  }

  public mapModuleInputResponseToTraceOutput(response: ITokenAnalyticsInputResponse): ITraceOutputData {
    return {
      output: response.output,
    };
  }

  public mapModuleInputResponseToGenerationOutput(response: ITokenAnalyticsInputResponse): IGenerationOutputData {
    return {
      output: response.output,
      usage: response.usage,
    };
  }
}