import { Global, Module } from "@nestjs/common"
import * as config from "config"
import { Db } from "mongodb"

import { IConfig } from "./config"
import { DbDeclaration, MongoDbIgniter } from "./database"

@Module({
  providers: [
    { provide: IConfig, useValue: config },
    {
      provide: Db,
      inject: [IConfig],
      useFactory: (config: IConfig) => {
        const dbConfig = config.get<DbDeclaration>("mongodb")

        return MongoDbIgniter.initializeDb(dbConfig)
      },
    },
  ],
  exports: [IConfig, Db],
})
@Global()
export class InfrastructureModule {}
