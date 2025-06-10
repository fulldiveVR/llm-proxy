import { applyDecorators } from "@nestjs/common"
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger"
import { OperationObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface"
import { Observable } from "rxjs"

export interface SseFrame<T> {
  data: T
}

export type SseObservable<T> = Observable<SseFrame<T>>

export function mapToSseFrame<T>(data: T): SseFrame<T> {
  return { data }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function ApiSseOperation(options: Partial<OperationObject> & { type: Function }): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      ...options,
      description: `This endpoint must not be called directly, use SSE client instead.`,
      deprecated: true,
      externalDocs: {
        url: "https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events",
        description: "Server-sent events documentation",
      },
    }),
    ApiProduces("text/event-stream"),
    ApiOkResponse({
      description: "The stream of events",
      type: options.type,
    }),
  )
}
