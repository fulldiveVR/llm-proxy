import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";
import { DomainCredits } from "../domain";
import { ICredits } from "./credits.models";
import { IUserService, UserService } from "../user/user.service";

@Injectable()
export class CreditsService {
  private readonly logger: Logger;

  constructor(private readonly userService: IUserService) {
    this.logger = new Logger(CreditsService.name);
  }

  @RabbitSubscribe({
    exchange: "fanout.billing.credits.updated",
    routingKey: "",
    queue: "queue.llm-proxy.credits.updated",
  })
  async handleCreditsUpdated(domainCredits: DomainCredits) {
    try {
      this.logger.log(`handleCreditsUpdated for user ${domainCredits.userId} total: ${domainCredits.totalCredits}`)
      const credits = CreditsService.mapDomainCreditsToICredits(domainCredits)
      await this.userService.updateCredits(domainCredits.userId, credits)
    } catch (error) {
      this.logger.error("Failed to update credits:", error)
    }
  }

  private static mapDomainCreditsToICredits(credits: DomainCredits): ICredits {
    return {
      planCredits: credits.planCredits,
      purchasedCredits: credits.purchasedCredits,
      totalCredits: credits.totalCredits,
      expires: credits.expiresAt ? new Date(credits.expiresAt) : new Date()
    }
  }
}
