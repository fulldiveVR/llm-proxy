import { Injectable } from "@nestjs/common"
import { TemplateDocument, TemplateRepository } from "./template.repository"
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter"
import { UserEventName } from "../user"
import { TemplateConfig } from "./template.config"
import { TemplateCreatedEvent, TemplateEventName } from "./template.events"
import { TemplateNotFoundError } from "../lib"

export abstract class ITemplateService {
  abstract doSomethingPublic(): Promise<void>
}

@Injectable()
export class TemplateService implements ITemplateService {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly templateConfig: TemplateConfig,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async doSomethingPublic(): Promise<void> {
    const updatedDocument = await this.templateRepository.update("test", {
      templateField: "test",
      templateField2: this.templateConfig.exampleConfigKey,
    })

    void updatedDocument
  }

  async createTemplate(userId: string): Promise<void> {
    const template = await this.templateRepository.insert({ userId, templateField: "test", templateField2: "test2" })

    this.eventEmitter.emit(TemplateEventName.CREATED, new TemplateCreatedEvent({ template }))
  }

  async getTemplate(userId: string, id: string): Promise<TemplateDocument> {
    const template = await this.templateRepository.getById(id)

    if (!template || template.userId !== userId) {
      throw new TemplateNotFoundError(id)
    }

    return template
  }

  @OnEvent(UserEventName.CREATED)
  protected async onUserCreated(userId: string): Promise<void> {
    // Here we can handle new user after it was received from the auth microservice and saved to the database
    // The user module emits local events for user creation, which can be handled in methods like this

    console.log("User created", userId)
  }
}
