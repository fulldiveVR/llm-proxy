import { Db, ObjectId } from "mongodb"
import { Injectable } from "@nestjs/common"

import { ObjectIdRepositoryBase } from "../lib"
import { User } from "./user.models"
import { ICredits } from "../credits/credits.models"

export type UserDocument = User & { _id: ObjectId }

@Injectable()
export class UserRepository extends ObjectIdRepositoryBase<UserDocument> {
  public constructor(db: Db) {
    super("users", db)
  }

  public override async getById(id: string): Promise<UserDocument | null> {
    return await this.collection.findOne({ id })
  }

  public async getByEmail(email: string): Promise<UserDocument | null> {
    return await this.collection.findOne({ "provider.email.id": email })
  }

  public override async update(id: string, document: Partial<UserDocument>, upsert?: boolean): Promise<UserDocument> {
    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: document },
      { returnDocument: "after", upsert },
    )

    if (!result.ok) {
      throw new Error(`Failed to update entity with id "${id}" in collection "${this.collectionName}"`)
    }

    return result.value as UserDocument
  }

  public override async delete(id: string): Promise<void> {
    await this.collection.deleteOne({ id })
  }

  public async updateCredits(id: string, credits: ICredits): Promise<void> {
    await this.collection.findOneAndUpdate({ id }, { $set: { credits } })
  }
}
