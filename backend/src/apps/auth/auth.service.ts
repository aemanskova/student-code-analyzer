import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { HttpService } from "@nestjs/axios";
import * as bcrypt from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { User } from "./entities/user.entity";
import { Role } from "./entities/role.entity";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || "super_secret_jwt_for_development";
  private readonly accessTtl = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  private readonly refreshTtl = process.env.JWT_REFRESH_EXPIRES_IN || "30d";

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private httpService: HttpService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const { name, surname, email, password, github } = dto;
    const salt = "$2b$10$1234567890123456789012";

    const localEmail = email;
    const isExisting = await this.userRepo.findOne({ where: { email } });
    if (isExisting) {
      return { message: "User already exists" };
    }
    if (github) {
      const isExistingGithub = await this.userRepo.findOne({ where: { github } });
      if (isExistingGithub) {
        return { message: "User already exists" };
      }
    }

    let isGithubExisting = false;

    if (github) {
      try {
        const response = await this.httpService.axiosRef.get(
          `https://api.github.com/users/${github}`
        );
        isGithubExisting = response.status === 200;
      } catch {
        isGithubExisting = false;
      }
    }

    if (github && !isGithubExisting) {
      return { message: "Github page does not exist" };
    }

    const passwordHash = await bcrypt.hash(password, salt);

    const professorRoleEntity = await this.roleRepo.findOne({
      where: { name: "Преподаватель" }
    });
    if (!professorRoleEntity) {
      return { message: "Ошибка подключения к базе таблице ролей" };
    }

    const user = this.userRepo.create({
      email: localEmail,
      password: passwordHash,
      name,
      surname,
      role: professorRoleEntity,
      github: github || null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await this.userRepo.save(user);
    return { message: "Пользователь зарегистрирован" };
  }

  async login(dto: LoginDto) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const { identifier, password } = dto;
    let user: User | null = null;

    if (emailRegex.test(identifier)) {
      user = await this.userRepo.findOne({ where: [{ email: identifier }] });
    } else {
      user = await this.userRepo.findOne({ where: [{ github: identifier }] });
    }

    const role = user?.role?.name;

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("User is not active");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueTokens(user, role);
  }

  async verifyAccessToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, { secret: this.jwtSecret }) as {
        sub?: number;
        tokenType?: string;
      };
      if (!payload?.sub || payload.tokenType !== "access") {
        throw new UnauthorizedException("Invalid access token");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: this.jwtSecret }) as {
        sub?: number;
        tokenType?: string;
      };
      if (!payload?.sub || payload.tokenType !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("Invalid refresh token");
      }
      if (!user.refreshTokenHash || !user.refreshTokenExpiresAt) {
        throw new UnauthorizedException("Invalid refresh token");
      }
      if (new Date(user.refreshTokenExpiresAt).getTime() <= Date.now()) {
        throw new UnauthorizedException("Refresh token expired");
      }

      const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!valid) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      return this.issueTokens(user, user.role?.name);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("Invalid user");
    }

    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    user.updatedAt = new Date();
    await this.userRepo.save(user);

    return { message: "Вы успешно вышли из системы" };
  }

  private async issueTokens(user: User, roleName?: string) {
    const role = roleName || user.role?.name || null;
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role,
        username: `${user.name} ${user.surname}`,
        tokenType: "access"
      },
      {
        secret: this.jwtSecret,
        expiresIn: this.accessTtl as never
      }
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        tokenType: "refresh"
      },
      {
        secret: this.jwtSecret,
        expiresIn: this.refreshTtl as never
      }
    );

    user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    user.refreshTokenExpiresAt = this.extractTokenExpiryDate(refreshToken);
    user.updatedAt = new Date();
    await this.userRepo.save(user);

    return {
      accessToken,
      refreshToken
    };
  }

  private extractTokenExpiryDate(token: string): Date | null {
    try {
      const decoded = this.jwtService.decode(token) as { exp?: number } | null;
      if (!decoded?.exp || !Number.isFinite(decoded.exp)) {
        return null;
      }
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }
}
