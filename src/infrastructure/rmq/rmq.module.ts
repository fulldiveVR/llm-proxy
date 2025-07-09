import { Module } from "@nestjs/common"
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq"

import { ConfigModule } from "../config"

import { RMQConfig } from "./rmq.config"

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule.forFeature(RMQConfig, "rmq")],
      inject: [RMQConfig],
      useFactory: (config: RMQConfig) => ({
        exchanges: config.exchanges,
        uri: config.connection.uri,
        enableControllerDiscovery: true,
        connectionInitOptions: { wait: false },
        connectionManagerOptions: {
          connectionOptions: {
            clientProperties: {
              connection_name: config.connection.name, // <--- Replace this with your service name
            },
          },
        },
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class RMQModule {}
