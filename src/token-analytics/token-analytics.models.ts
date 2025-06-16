import { ChatMessageContent } from "../llm-proxy";

export interface ITokenAnalyticsInputRequest {
  traceName: string;
  generationName: string;
  userId: string;
  model: string;
  input?: IRequestMessage[];
  temperature?: number;
}

export interface ITokenAnalyticsInputResponse {
  output: any;
  usage: { totalTokens: number; };
}

export interface IRequestMessage {
  role: string;
  content: ChatMessageContent;
}

export interface ITraceInputData {
  name: string;
  userId: string;
  tags: string[];
  input?: IRequestMessage[];
}

export interface ITraceOutputData {
  output: any;
}

export interface IGenerationInputData {
  name: string;
  startTime: Date;
  model: string;
  modelParameters: {
    temperature?: number;
  };
  input?: IRequestMessage[];
}

export interface IGenerationOutputData {
  output: any;
  usage: { totalTokens: number; };
}

export interface ITokenAnalyticsParser {
  mapModuleInputToTraceData(request: ITokenAnalyticsInputRequest): ITraceInputData;
  mapModuleInputToGenerationData(request: ITokenAnalyticsInputRequest): IGenerationInputData;
  mapModuleInputResponseToTraceOutput(response: ITokenAnalyticsInputResponse): ITraceOutputData;
  mapModuleInputResponseToGenerationOutput(response: ITokenAnalyticsInputResponse): IGenerationOutputData;
}