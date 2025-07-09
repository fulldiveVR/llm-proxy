import { IUser } from "../domain"

// move me to credits module
export interface ICredits {
  planCredits: number
  purchasedCredits: number
  totalCredits: number
  expires: Date
}

export interface User extends IUser {
  credits?: ICredits
}

export type CreatedUserMessage = User
export type UpdatedUserMessage = User
