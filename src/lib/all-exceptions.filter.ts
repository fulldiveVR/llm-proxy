import { BaseExceptionFilter } from "@nestjs/core"
import { ArgumentsHost, HttpException } from "@nestjs/common"
import { DomainError } from "./errors"

export class AllExceptionsFilter extends BaseExceptionFilter {
  public override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof DomainError) {
      const httpException = new HttpException(
        {
          code: exception.code,
          message: exception.message,
        },
        exception.status,
      )

      super.catch(httpException, host)
      return
    }

    super.catch(exception, host)
  }
}
