export interface RMQExchange {
  name: string
  type: string
}

export interface RMQConnection {
  name: string
  uri: string
}
export abstract class RMQConfig {
  public abstract connection: RMQConnection
  public abstract exchanges: RMQExchange[]
}