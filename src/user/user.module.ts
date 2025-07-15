import { Global, Module } from "@nestjs/common"

import { RMQModule } from "../infrastructure"

import { IUserService, UserService } from "./user.service"
import { UserRepository } from "./user.repository"
import { UserController } from "./user.controller"
import { IUserParser, UserParser } from "./user.parser"

@Module({
  imports: [RMQModule],
  providers: [
    UserRepository,
    UserService,
    { provide: IUserService, useExisting: UserService },
    { provide: IUserParser, useClass: UserParser },
  ],
  controllers: [UserController],
  exports: [IUserService],
})
@Global()
export class UserModule {}
