import { Collection, Db, Document, ObjectId } from "mongodb"

/* eslint-disable @typescript-eslint/no-explicit-any */

export abstract class RepositoryBase<TPublicId, TDocumentId, TDocument extends Document & { _id?: TDocumentId }> {
  protected constructor(protected readonly collectionName: string, protected readonly db: Db) {}

  public getById(id: TPublicId | TDocumentId): Promise<TDocument | null> {
    return this.collection.findOne({ _id: this.mapDocumentId(id) } as any) as any
  }

  public async getByIdOrThrow(id: TPublicId | TDocumentId): Promise<TDocument> {
    const entity = await this.getById(id)

    if (!entity) {
      throw new Error(`Entity with id "${id}" was not found in collection "${this.collectionName}"`)
    }

    return entity
  }

  public async insert(document: Omit<TDocument, "_id"> & { _id?: TDocument["_id"] }): Promise<TDocument> {
    await this.collection.insertOne(document as any)

    return document as TDocument // mongodb inserts the _id property in the original object
  }

  public async update(id: TPublicId | TDocumentId, document: Partial<TDocument>, upsert = false): Promise<TDocument> {
    const result = await this.collection.findOneAndUpdate(
      { _id: this.mapDocumentId(id) } as any,
      { $set: document },
      { returnDocument: "after", upsert },
    )

    if (!result.ok) {
      throw new Error(`Failed to update entity with id "${id}" in collection "${this.collectionName}"`)
    }

    return result.value as TDocument
  }

  public async delete(id: TPublicId): Promise<void> {
    await this.collection.deleteOne({ _id: this.mapDocumentId(id) } as any)
  }

  protected abstract mapDocumentId(publicId: TPublicId | TDocumentId): TDocumentId

  protected get collection(): Collection<TDocument> {
    return this.db.collection(this.collectionName)
  }
}

export class ObjectIdRepositoryBase<TDocument extends Document & { _id: ObjectId }> extends RepositoryBase<
  string,
  ObjectId,
  TDocument
> {
  protected mapDocumentId(publicId: string | ObjectId): ObjectId {
    return publicId instanceof ObjectId ? publicId : new ObjectId(publicId)
  }
}

export class StringIdRepositoryBase<TDocument extends Document & { _id: string }> extends RepositoryBase<
  string,
  string,
  TDocument
> {
  protected mapDocumentId(publicId: string): string {
    return publicId
  }
}
