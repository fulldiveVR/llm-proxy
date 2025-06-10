import { IUtil, IConfig as IConfigCore } from "config"

export abstract class IConfig implements IConfigCore {
  public abstract util: IUtil

  public abstract get<T>(setting: string): T

  public abstract has(setting: string): boolean
}
