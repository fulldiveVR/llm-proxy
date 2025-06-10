import { Injectable } from "@nestjs/common"

import { UserNotFoundError } from "../lib"

import { User } from "./user.models"
import { UserRepository, UserDocument } from "./user.repository"

export abstract class IUserService {
  public abstract getUser(userId: string): Promise<User>
  public abstract getUserByEmail(email: string): Promise<User | null>
}

@Injectable()
export class UserService implements IUserService {
  public constructor(private readonly userRepository: UserRepository) {}

  public async createUser(user: User): Promise<UserDocument> {
    return await this.userRepository.insert(user)
  }

  public async updateUser(userId: string, user: Partial<User>): Promise<UserDocument> {
    return await this.userRepository.update(userId, user)
  }

  public async getUser(userId: string): Promise<UserDocument> {
    const document = await this.userRepository.getById(userId)
    if (!document) {
      throw new UserNotFoundError(userId)
    }
    return document
  }

  public async getUserByEmail(email: string): Promise<UserDocument | null> {
    return await this.userRepository.getByEmail(email)
  }
}
