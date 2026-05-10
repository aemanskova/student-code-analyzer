import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { Role } from "./entities/role.entity";
import { User } from "./entities/user.entity";
import { AuthService } from "./auth.service";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn()
}));

type RepoMock<T> = {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

const createRole = (): Role => ({ id: 1, name: "преподаватель", users: [] });

const createUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 7,
    email: "teacher@example.com",
    password: "stored-password-hash",
    name: "Ada",
    surname: "Lovelace",
    github: "ada",
    isActive: true,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    refreshTokenHash: "stored-refresh-hash",
    refreshTokenExpiresAt: new Date(Date.now() + 60_000),
    role: createRole(),
    ...overrides
  }) as User;

describe("AuthService", () => {
  const originalEnv = { ...process.env };
  const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

  const createService = (
    options: {
      userRepo?: Partial<RepoMock<User>>;
      roleRepo?: Partial<RepoMock<Role>>;
      githubStatus?: number;
      config?: Record<string, string | undefined>;
    } = {}
  ) => {
    const userRepo: RepoMock<User> = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn((user: User) => Promise.resolve(user)),
      ...options.userRepo
    };
    const roleRepo: RepoMock<Role> = {
      findOne: jest.fn().mockResolvedValue(createRole()),
      create: jest.fn((payload) => payload),
      save: jest.fn((role: Role) => Promise.resolve(role)),
      ...options.roleRepo
    };
    const httpService = {
      axiosRef: {
        get: jest.fn().mockResolvedValue({ status: options.githubStatus ?? 200 })
      }
    };
    const jwtService = {
      sign: jest.fn((payload: { tokenType: string }) => `${payload.tokenType}-token`),
      verify: jest.fn((token: string) => {
        if (token === "access-token") {
          return { sub: 7, tokenType: "access" };
        }
        if (token === "refresh-token") {
          return { sub: 7, tokenType: "refresh" };
        }
        throw new Error("invalid token");
      }),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    };
    const config: Record<string, string | undefined> = {
      JWT_SECRET: "test-secret",
      BCRYPT_ROUNDS: "10",
      ...options.config
    };
    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const value = config[key];
        if (value === undefined) {
          throw new Error(`Missing config ${key}`);
        }
        return value;
      }),
      get: jest.fn((key: string, fallback?: string) => config[key] ?? fallback)
    };

    return {
      service: new AuthService(
        userRepo as never,
        roleRepo as never,
        httpService as never,
        jwtService as never,
        configService as never
      ),
      userRepo,
      roleRepo,
      httpService,
      jwtService
    };
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    bcryptMock.hash.mockResolvedValue("hashed-value" as never);
    bcryptMock.compare.mockResolvedValue(true as never);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it("registers a new active professor after checking unique email/github", async () => {
    const { service, userRepo, httpService } = createService({
      userRepo: {
        findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      }
    });

    await expect(
      service.register({
        email: "new@example.com",
        password: "plain-password",
        name: "Grace",
        surname: "Hopper",
        github: "grace"
      })
    ).resolves.toEqual({ message: "Пользователь зарегистрирован" });

    expect(httpService.axiosRef.get).toHaveBeenCalledWith("https://api.github.com/users/grace");
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        password: "hashed-value",
        name: "Grace",
        surname: "Hopper",
        github: "grace",
        isActive: true
      })
    );
    expect(userRepo.save).toHaveBeenCalled();
  });

  it("does not register duplicate users or missing github accounts", async () => {
    const duplicate = createService({
      userRepo: {
        findOne: jest.fn().mockResolvedValueOnce(createUser())
      }
    });

    await expect(
      duplicate.service.register({
        email: "teacher@example.com",
        password: "plain-password",
        name: "Ada",
        surname: "Lovelace"
      })
    ).resolves.toEqual({ message: "User already exists" });

    const missingGithub = createService({
      userRepo: {
        findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      }
    });
    missingGithub.httpService.axiosRef.get.mockRejectedValueOnce(new Error("not found"));

    await expect(
      missingGithub.service.register({
        email: "new@example.com",
        password: "plain-password",
        name: "Grace",
        surname: "Hopper",
        github: "missing"
      })
    ).resolves.toEqual({ message: "Github page does not exist" });
  });

  it("blocks public registration when production registration is disabled", async () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_PUBLIC_REGISTRATION = "false";
    const { service } = createService();

    await expect(
      service.register({
        email: "new@example.com",
        password: "plain-password",
        name: "Grace",
        surname: "Hopper"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("logs in by email or github and stores a hashed refresh token", async () => {
    const user = createUser();
    const { service, userRepo, jwtService } = createService({
      userRepo: {
        findOne: jest.fn().mockResolvedValue(user)
      }
    });

    await expect(
      service.login({ identifier: "teacher@example.com", password: "plain-password" })
    ).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });

    expect(userRepo.findOne).toHaveBeenCalledWith({ where: [{ email: "teacher@example.com" }] });
    expect(jwtService.sign).toHaveBeenCalledTimes(2);
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTokenHash: "hashed-value",
        refreshTokenExpiresAt: expect.any(Date)
      })
    );
  });

  it("rejects login for missing, inactive, or invalid-password users", async () => {
    const missing = createService({
      userRepo: { findOne: jest.fn().mockResolvedValue(null) }
    });
    await expect(
      missing.service.login({ identifier: "missing@example.com", password: "plain-password" })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const inactive = createService({
      userRepo: { findOne: jest.fn().mockResolvedValue(createUser({ isActive: false })) }
    });
    await expect(
      inactive.service.login({ identifier: "teacher@example.com", password: "plain-password" })
    ).rejects.toThrow("User is not active");

    bcryptMock.compare.mockResolvedValueOnce(false as never);
    const invalidPassword = createService({
      userRepo: { findOne: jest.fn().mockResolvedValue(createUser()) }
    });
    await expect(
      invalidPassword.service.login({ identifier: "teacher@example.com", password: "wrong" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("verifies access tokens and refreshes valid refresh tokens", async () => {
    const user = createUser();
    const { service } = createService({
      userRepo: { findOne: jest.fn().mockResolvedValue(user) }
    });

    await expect(service.verifyAccessToken("access-token")).resolves.toEqual({
      sub: 7,
      tokenType: "access"
    });
    await expect(service.refreshTokens("refresh-token")).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });
  });

  it("logs out by clearing refresh token fields", async () => {
    const user = createUser();
    const { service, userRepo } = createService({
      userRepo: { findOne: jest.fn().mockResolvedValue(user) }
    });

    await expect(service.logout(7)).resolves.toEqual({ message: "Вы успешно вышли из системы" });
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        refreshTokenHash: null,
        refreshTokenExpiresAt: null
      })
    );
  });
});
