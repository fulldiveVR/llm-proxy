import { IUser } from "../domain"

export interface TokenPayload {
  readonly id: string
  readonly roles: string[]
}

export type AuthorizedUser = IUser
