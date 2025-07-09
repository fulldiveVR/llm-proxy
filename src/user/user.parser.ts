import { Injectable } from "@nestjs/common"
import { ObjectId } from "mongodb"
import { IUser } from "../domain"

export abstract class IUserParser {
  abstract modifyUserAfterTransport(userUpdated: IUser): IUser
}

@Injectable()
export class UserParser implements IUserParser {
  public modifyUserAfterTransport(userUpdated: IUser): IUser {
    let modifiedUser = { ...userUpdated }

    if (modifiedUser.created && typeof modifiedUser.created === "string") {
      modifiedUser = { ...modifiedUser, created: new Date(modifiedUser.created) }
    }

    if (modifiedUser.updated && typeof modifiedUser.updated === "string") {
      modifiedUser = { ...modifiedUser, updated: new Date(modifiedUser.updated) }
    }

    // @ts-ignore
    if (modifiedUser._id && typeof modifiedUser._id === "string") {
      // @ts-ignore
      modifiedUser = { ...modifiedUser, _id: new ObjectId(modifiedUser._id) }
    }

    return modifiedUser
  }
}
