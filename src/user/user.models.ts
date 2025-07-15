import { ICredits } from "../credits/credits.models"
import { IUser } from "../domain"

export interface User extends IUser {
  credits?: ICredits
}

export type CreatedUserMessage = User
export type UpdatedUserMessage = User
