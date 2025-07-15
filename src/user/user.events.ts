import { Record } from "../lib"

import { User } from "./user.models"

export class UserCreatedEvent extends Record<{
  user: User
}>() {}

export enum UserEventName {
  CREATED = "user.created",
  UPDATED = "user.updated",
}
