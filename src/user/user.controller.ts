import { Controller, Logger } from "@nestjs/common"
import { ApiExcludeController } from "@nestjs/swagger"
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq"

import { UserService } from "./user.service"
import { CreatedUserMessage, UpdatedUserMessage } from "./user.models"
import { IUserParser } from "./user.parser"

@Controller()
@ApiExcludeController()
export class UserController {
  private readonly logger = new Logger(UserController.name)

  public constructor(
    private readonly userService: UserService,
    private readonly userParser: IUserParser,
  ) {}

  @RabbitSubscribe({
    exchange: "fanout.auth.user.created",
    routingKey: "",
    queue: "queue.llm-proxy.user.created",
  })
  protected async handleUserCreated(message: CreatedUserMessage): Promise<void> {
    try {
      this.logger.debug(`Received new user: ${JSON.stringify({ userId: message.id })}`)

      const user = this.userParser.modifyUserAfterTransport(message)
      const created = await this.userService.createUser(user)
    } catch (e) {
      this.logger.log("@OnEvent(UserEventName.CREATED) controller", e)
    }
  }

  @RabbitSubscribe({
    exchange: "fanout.auth.user.updated",
    routingKey: "",
    queue: "queue.llm-proxy.user.updated",
  })
  protected async handleUserUpdated(message: UpdatedUserMessage): Promise<void> {
    try {
      this.logger.debug(`Received updated user: ${JSON.stringify({ userId: message.id })}`)

      const user = this.userParser.modifyUserAfterTransport(message)
      const updated = await this.userService.updateUser(user.id, user)
    } catch (e) {
      this.logger.log("@OnEvent(UserEventName.UPDATED) controller", e)
    }
  }
}
