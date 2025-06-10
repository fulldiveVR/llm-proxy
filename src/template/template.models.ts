import { IsMongoId, IsOptional, IsString } from "class-validator"

export class TemplateParams {
  @IsString()
  @IsMongoId()
  id: string
}

export class TemplateQuery {
  @IsString()
  @IsOptional()
  search?: string
}

export class Template {
  readonly id: string
  readonly name: string
}
