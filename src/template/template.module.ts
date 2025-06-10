import { Module } from "@nestjs/common"
import { TemplateController } from "./template.controller"
import { ConfigModule, RMQModule } from "../infrastructure"
import { ITemplateService, TemplateService } from "./template.service"
import { TemplateRepository } from "./template.repository"
import { TemplateConfig } from "./template.config"

@Module({
  imports: [
    // This way we can register RMQModule which will be bound to the "rmq" config section
    // It allow us to receive the RMQ messages in the TemplateController
    // And send messages back to RMQ from the TemplateModule
    RMQModule,
    // The same way we can register TemplateConfig which will be bound to the "template" config section
    // It also can be injected in any service without @Inject decorator
    ConfigModule.forFeature(TemplateConfig, "template"),
  ],
  controllers: [TemplateController],
  providers: [
    TemplateRepository,
    TemplateService,
    // Here we register an implementation of the ITemplateService interface with the TemplateService class
    { provide: ITemplateService, useExisting: TemplateService },
  ],
  // Export the interface, so it can be injected in other modules (while the implementation is not exported)
  exports: [ITemplateService],
})
export class TemplateModule {}
