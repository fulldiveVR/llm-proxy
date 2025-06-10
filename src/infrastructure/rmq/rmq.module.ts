import { Module } from "@nestjs/common"
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq"

import { ConfigModule } from "../config"

import { RMQConfig } from "./rmq.config"

@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule.forFeature(RMQConfig, "rmq")],
      inject: [RMQConfig],
      useFactory: (config: RMQConfig) => ({
        exchanges: config.exchanges,
        uri: config.uri,
        enableControllerDiscovery: true,
        connectionInitOptions: { wait: false },
        connectionManagerOptions: {
          connectionOptions: {
            clientProperties: {
              connection_name: "template-api", // <--- Replace this with your service name
            },
          },
        },
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class RMQModule {}
