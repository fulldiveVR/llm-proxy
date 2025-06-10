import { Record } from "../lib"
import { TemplateDocument } from "./template.repository"

export class TemplateCreatedEvent extends Record<{
  template: TemplateDocument
}>() {}

export enum TemplateEventName {
  CREATED = "template.created",
}
