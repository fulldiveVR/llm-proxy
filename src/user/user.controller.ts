import { Controller, Logger } from "@nestjs/common"
import { ApiExcludeController } from "@nestjs/swagger"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq"

import { UserService } from "./user.service"
import { UserCreatedEvent, UserEventName } from "./user.events"
import { CreatedUserMessage, UpdatedUserMessage } from "./user.models"
import { IUserParser } from "./user.parser"

@Controller()
@ApiExcludeController()
export class UserController {
  private readonly logger = new Logger(UserController.name)

  public constructor(
    private readonly userService: UserService,
    private readonly userParser: IUserParser,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @RabbitSubscribe({
    exchange: "fanout.auth.user.created",
    routingKey: "user.createed",
    queue: "queue.template.user.created", // <--- Change the queue name, replace template with service name
  })
  protected async handleUserCreated(message: CreatedUserMessage): Promise<void> {
    this.logger.debug(`Received new user: ${JSON.stringify({ userId: message.id })}`)

    const user = this.userParser.modifyUserAfterTransport(message)
    const created = await this.userService.createUser(user)

    this.eventEmitter.emit(UserEventName.CREATED, new UserCreatedEvent({ user: created }))
  }

  @RabbitSubscribe({
    exchange: "fanout.auth.user.updated",
    routingKey: "user.updated",
    queue: "queue.template.user.updated", // <--- Change the queue name, replace template with service name
  })
  protected async handleUserUpdated(message: UpdatedUserMessage): Promise<void> {
    this.logger.debug(`Received updated user: ${JSON.stringify({ userId: message.id })}`)

    const user = this.userParser.modifyUserAfterTransport(message)
    const updated = await this.userService.updateUser(user.id, user)

    this.eventEmitter.emit(UserEventName.UPDATED, new UserCreatedEvent({ user: updated }))
  }
}
