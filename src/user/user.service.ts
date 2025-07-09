import { Injectable } from "@nestjs/common"

import { UserNotFoundError } from "../lib"

import { User } from "./user.models"
import { UserRepository, UserDocument } from "./user.repository"
import { ICredits } from "../credits/credits.models"

export abstract class IUserService {
  public abstract getUser(userId: string): Promise<User>
  public abstract getUserByEmail(email: string): Promise<User | null>
  public abstract updateCredits(userId: string, credits: ICredits): Promise<void>
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

  public async updateCredits(userId: string, credits: ICredits): Promise<void> {
    await this.userRepository.updateCredits(userId, credits)
  }

  public static hasActiveCredits(user: User): boolean {
    if (user.organizationRoles?.length) return true

    if (!user.credits) return false

    const expires = new Date(user.credits.expires)

    if (expires < new Date()) return false

    return user.credits.totalCredits > 0
  }
}
