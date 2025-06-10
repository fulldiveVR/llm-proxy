import { Module } from "@nestjs/common"
import { EventEmitterModule } from "@nestjs/event-emitter"

import { InfrastructureModule } from "./infrastructure"
import { AuthModule } from "./auth"
import { UserModule } from "./user"
import { TemplateModule } from "./template"

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    InfrastructureModule,
    AuthModule,
    UserModule,

    // Application modules go here
    TemplateModule,
  ],
})
export class AppModule {}
