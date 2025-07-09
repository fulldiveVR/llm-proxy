import { Module } from "@nestjs/common";
import { CreditsService } from "./credits.service";
import { RMQModule } from "../infrastructure";

@Module({
  imports: [RMQModule],
  controllers: [],
  providers: [
    CreditsService
  ],
  exports: [CreditsService],
})
export class CreditsModule {}