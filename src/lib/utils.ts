export interface SerializedError {
  message: string
  stack?: string
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack }
  }

  return { message: String(error) }
}

export type RecordClass<T> = Readonly<T> & (new (data: T) => Readonly<T>)

export function Record<T>(): RecordClass<T> {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  return class Record {
    public constructor(data: T) {
      Object.assign(this, data)
    }
  } as RecordClass<T>
}
