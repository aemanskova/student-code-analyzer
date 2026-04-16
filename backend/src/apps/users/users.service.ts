import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../auth/entities/user.entity";
import { UpdateMeDto } from "./dto/update-me.dto";

export type UserProfileResponse = {
  id: number;
  email: string;
  name: string;
  surname: string;
  github: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: {
    id: number;
    name: string;
  } | null;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {}

  findById(id: number) {
    return this.userRepo.findOne({ where: { id } });
  }

  async getMe(userId: number): Promise<UserProfileResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    return this.toUserProfile(user);
  }

  async updateMe(userId: number, dto: UpdateMeDto): Promise<UserProfileResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    if (dto.email && dto.email !== user.email) {
      const existingByEmail = await this.userRepo.findOne({ where: { email: dto.email } });
      if (existingByEmail && existingByEmail.id !== userId) {
        throw new ConflictException("Email уже используется");
      }
      user.email = dto.email;
    }

    if (dto.github !== undefined && dto.github !== user.github) {
      if (dto.github) {
        const existingByGithub = await this.userRepo.findOne({ where: { github: dto.github } });
        if (existingByGithub && existingByGithub.id !== userId) {
          throw new ConflictException("Github уже используется");
        }
      }
      user.github = dto.github ?? null;
    }

    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    if (dto.surname !== undefined) {
      user.surname = dto.surname;
    }

    user.updatedAt = new Date();
    const updatedUser = await this.userRepo.save(user);
    return this.toUserProfile(updatedUser);
  }

  private toUserProfile(user: User): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      github: user.github,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role ? { id: user.role.id, name: user.role.name } : null
    };
  }
}
