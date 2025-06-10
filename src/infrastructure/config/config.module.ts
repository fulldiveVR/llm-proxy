import { DynamicModule, Module } from "@nestjs/common"
import { IConfig } from "./config.utils"

@Module({})
export class ConfigModule {
  public static forFeature<T>(type: abstract new () => T, key: string): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        {
          provide: type,
          inject: [IConfig],
          useFactory: (config: IConfig): T => config.get(key),
        },
      ],
      exports: [type],
    }
  }
}
