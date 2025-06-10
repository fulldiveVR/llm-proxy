import { filter, fromEvent, map } from "rxjs"
import { Controller, Get, Logger, Param, Post, Query, Sse } from "@nestjs/common"
import { ApiOperation } from "@nestjs/swagger"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { AmqpConnection, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq"

import { ApiSseOperation, SseObservable, mapToSseFrame } from "../lib"
import { AuthUser, AuthorizedUser, UseAuthGuard } from "../auth"
import { TemplateService } from "./template.service"
import { Template, TemplateParams, TemplateQuery } from "./template.models"
import { TemplateCreatedEvent, TemplateEventName } from "./template.events"
import { TemplateDocument } from "./template.repository"

@Controller({ version: "1" })
export class TemplateController {
  private readonly logger = new Logger(TemplateController.name)

  constructor(
    private readonly templateService: TemplateService,
    private readonly eventEmitter: EventEmitter2,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Get("hello")
  @ApiOperation({ summary: "Get a greeting for the current user" })
  @UseAuthGuard()
  async getHello(@AuthUser() user: AuthorizedUser): Promise<string> {
    this.logger.debug(`User ${user.userName} requested a greeting`)
    return `Hello, ${user.userName}!`
  }

  @Post("templates")
  @ApiOperation({ summary: "Create something" })
  @UseAuthGuard()
  async doSomethingPrivate(@AuthUser() user: AuthorizedUser): Promise<void> {
    await this.templateService.createTemplate(user.id)
  }

  @Sse("templates/changes")
  @ApiSseOperation({ type: Template, summary: "Subscribe to changes in something" })
  @UseAuthGuard()
  subscribeToTemplateChanges(@AuthUser() user: AuthorizedUser): SseObservable<Template> {
    return fromEvent(this.eventEmitter, TemplateEventName.CREATED).pipe(
      // cast to TemplateCreatedEvent
      map(event => event as TemplateCreatedEvent),
      // filter out events that are not for the current user
      filter(event => event.template.userId === user.id),
      // map to the model
      map(event => TemplateController.mapDocumentToTemplate(event.template)),
      // map to sse frame
      map(mapToSseFrame),
    )

    // if you need to subscribe to multiple events, you can use merge:
    // return merge(
    //   fromEvent(this.eventEmitter, TemplateEventName.CREATED),
    //   fromEvent(this.eventEmitter, TemplateEventName.UPDATED),
    // ).pipe(
    //   ...
    // )
  }

  @Get("templates/:id")
  @ApiOperation({ summary: "Get something" })
  @UseAuthGuard()
  async getTemplate(
    @Param() { id }: TemplateParams,
    @Query() { search }: TemplateQuery,
    @AuthUser() user: AuthorizedUser,
  ): Promise<Template> {
    const template = await this.templateService.getTemplate(user.id, id)

    return TemplateController.mapDocumentToTemplate(template)
  }

  @RabbitSubscribe({
    exchange: "topic.from.service-name", // <--- `topic.billing.service-name` for example
    routingKey: "something.happened",
    queue: "queue.to.something.happened", // <--- `queue.service-name.something.happened` for example
  })
  async handleSomthingHappened(message: any): Promise<void> {
    this.logger.debug(`Received message from somewhere: ${JSON.stringify(message, null, 2)}`)

    await this.amqpConnection.publish("topic.service-name.to", "something-else.happened", { origin: message })
  }

  private static mapDocumentToTemplate(document: TemplateDocument): Template {
    return { id: document._id.toString(), name: document.templateField }
  }
}
