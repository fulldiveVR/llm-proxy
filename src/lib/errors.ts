import { HttpStatus } from "@nestjs/common"

export abstract class DomainError extends Error {
  public abstract code: string
  public abstract status: HttpStatus
}

export class InvalidAccessTokenError extends DomainError {
  public readonly code = "auth/invalid-access-token"
  public readonly status = HttpStatus.UNAUTHORIZED

  public constructor() {
    super("Invalid access token")
  }
}

export class UserNotFoundError extends DomainError {
  public readonly code = "user/not-found"
  public readonly status = HttpStatus.UNAUTHORIZED

  public constructor(userId: string) {
    super(`User with id "${userId}" was not found`)
  }
}

export class TemplateNotFoundError extends DomainError {
  public readonly code = "template/not-found"
  public readonly status = HttpStatus.NOT_FOUND

  public constructor(templateId: string) {
    super(`Something with id "${templateId}" was not found`)
  }
}
