export interface RMQExchange {
  name: string
  type: string
}
export abstract class RMQConfig {
  public abstract uri: string
  public abstract exchanges: RMQExchange[]
}
