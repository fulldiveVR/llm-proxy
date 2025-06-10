import { ObjectIdRepositoryBase } from "../lib"
import { Db, ObjectId } from "mongodb"
import { Injectable } from "@nestjs/common"

export interface TemplateDocument {
  _id: ObjectId
  userId: string

  templateField: string
  templateField2: string
}

@Injectable()
export class TemplateRepository extends ObjectIdRepositoryBase<TemplateDocument> {
  constructor(db: Db) {
    super("template", db)
  }
}
