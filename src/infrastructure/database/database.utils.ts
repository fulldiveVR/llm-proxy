import {
  Collection,
  CreateCollectionOptions,
  CreateIndexesOptions,
  Db,
  IndexSpecification,
  MongoClient,
  MongoClientOptions,
} from "mongodb"

export interface DbDeclaration {
  connectionString: string
  dbName: string
  options?: MongoClientOptions
  collections: CollectionDeclaration[]
}

export interface CollectionDeclaration {
  name: string
  options?: CreateCollectionOptions
  indexes?: IndexDeclaration[]
}

export interface IndexDeclaration {
  keys: IndexSpecification
  options?: CreateIndexesOptions
}

export interface CollectionInitializationResult {
  collectionName: string
  indexNames?: string[]
}

export class MongoDbIgniter {
  public static async initializeConnection(dbDeclaration: DbDeclaration, purge = false): Promise<MongoClient> {
    if (!dbDeclaration.connectionString) {
      throw new Error('You must provide a "db" property in your DbDeclaration')
    }

    const dbConnection = await MongoClient.connect(dbDeclaration.connectionString, dbDeclaration.options)
    const db = dbConnection.db(dbDeclaration.dbName)

    const collectionInitializations = dbDeclaration.collections.map(collection =>
      MongoDbIgniter.initializeCollection(db, collection, purge),
    )

    await Promise.all(collectionInitializations)
    return dbConnection
  }

  public static async initializeDb(dbDeclaration: DbDeclaration, purge = false): Promise<Db> {
    const dbConnection = await MongoDbIgniter.initializeConnection(dbDeclaration, purge)

    return dbConnection.db(dbDeclaration.dbName)
  }

  public static async initializeCollection(
    db: Db,
    collectionDeclaration: CollectionDeclaration,
    purge: boolean,
  ): Promise<CollectionInitializationResult> {
    if (!collectionDeclaration.name) {
      throw new Error('You must provide a "name" property for each collection')
    }

    const collection = db.collection(collectionDeclaration.name, collectionDeclaration.options)

    const collectionInitializationResult: CollectionInitializationResult = {
      collectionName: collection.collectionName,
    }

    if (collectionDeclaration.indexes) {
      if (purge) {
        await collection.dropIndexes()
      }

      const indexInitializations = collectionDeclaration.indexes.map(index =>
        MongoDbIgniter.initializeIndex(collection, index),
      )
      collectionInitializationResult.indexNames = await Promise.all(indexInitializations)
    }

    return collectionInitializationResult
  }

  public static async initializeIndex(collection: Collection, index: IndexDeclaration): Promise<string> {
    if (!index.keys) {
      throw new Error('You must provide a "keys" property for each index')
    }

    return await collection.createIndex(index.keys, index.options)
  }
}
