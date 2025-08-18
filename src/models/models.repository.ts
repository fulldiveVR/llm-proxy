import { Injectable } from "@nestjs/common"
import { Collection, Db } from "mongodb"

import { ModelProvider } from "../llm-proxy/llm-proxy.models"

export enum AvailabilityLevel {
  BOSS = "boss", // all trails, bossmode
  START = "start", // starter
  NONE = "none", // all expired, canceled starter
}

export interface IModel {
  id: string
  maxTokens: number
  ctxWindow: number
  systemMaxTokes: number
  provider: ModelProvider
  availability: AvailabilityLevel
  supportsFileUpload: boolean
  supportsImageUpload: boolean
  icon: string
  openrouterCustomProvider?: any
  default?: boolean
  includeReasoning?: boolean
  fallbackModels?: string[]
}

@Injectable()
export class ModelsRepository {
  public static collectionName = "models"

  constructor(private readonly db: Db) {}

  private collection(): Collection<IModel> {
    return this.db.collection<IModel>(ModelsRepository.collectionName)
  }

  /**
   * Insert a single model document
   */
  public async insert(model: IModel): Promise<void> {
    await this.collection().insertOne(model)
  }

  /**
   * Retrieve every model sorted by the optional "sortBy" field
   */
  public async getAll(): Promise<IModel[]> {
    return this.collection().find({}).sort({ sortBy: 1 }).toArray()
  }

  /**
   * Get single model by its id
   */
  public async getById(id: string): Promise<IModel | null> {
    return this.collection().findOne({ id })
  }

  /**
   * Get all models for particular provider
   */
  public async getByProvider(provider: ModelProvider): Promise<IModel[]> {
    return this.collection().find({ provider }).sort({ sortBy: 1 }).toArray()
  }

  /**
   * Ensure collection has at least a default set of documents
   */
  public async populateModels(defaultModels: IModel[]): Promise<void> {
    const existing = await this.getAll()
    if (!existing.length) {
      await this.collection().insertMany(defaultModels)
    }
  }
}
