import { Global, Module } from "@nestjs/common"
import * as config from "config"

import { IConfig } from "./config"

@Module({
  providers: [
    { provide: IConfig, useValue: config },
  ],
  exports: [IConfig],
})
@Global()
export class InfrastructureModule {}
