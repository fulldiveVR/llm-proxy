import { Body, Controller, Headers, HttpStatus, Logger, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { LLMProxyService } from "./llm-proxy.service";
import { EmbeddingRequestDto, IEmbeddingRequest, ModelProvider } from "./llm-proxy.models";
import { AuthorizedUser, AuthUser } from "../auth";
import { UseAuthAndCreditsByModelsGuard } from "../credits";

@ApiTags("OpenAI API Compatible")
@Controller("v1")
export class EmbeddingsController {
  private readonly logger = new Logger(EmbeddingsController.name);

  constructor(private readonly llmProxyService: LLMProxyService) { }

  @Post("embeddings")
  @UseAuthAndCreditsByModelsGuard()
  @ApiOperation({ summary: "Create embeddings" })
  @ApiResponse({ status: 200, description: "Embeddings created successfully" })
  @ApiResponse({ status: 400, description: "Invalid request parameters" })
  @ApiResponse({ status: 401, description: "Unauthorized - Invalid or missing API key" })
  @ApiResponse({ status: 403, description: "Forbidden - User has no active credits or special user using disallowed model" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async createEmbeddings(
    @Body() requestDto: EmbeddingRequestDto,
    @Headers("x-provider") xProvider: ModelProvider | undefined,
    @Res() res: Response,
    @AuthUser() user: AuthorizedUser,
  ): Promise<void> {
    try {
      const effectiveProvider = xProvider || requestDto.provider;
      this.logger.log(`Incoming embedding request: user=${user.id}, model=${requestDto.model}, provider=${effectiveProvider || 'auto'}`);

      const request: IEmbeddingRequest = {
        ...requestDto,
        user: user.provider?.email?.id || user.id,
        provider: effectiveProvider,
      };

      const response = await this.llmProxyService.generateEmbeddings(request);
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: { message: error.message, type: "server_error" },
      });
    }
  }
} 