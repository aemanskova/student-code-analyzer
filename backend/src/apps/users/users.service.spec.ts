import { ConflictException, NotFoundException } from "@nestjs/common";
import { User } from "../auth/entities/user.entity";
import { UsersService } from "./users.service";

type UserRepoMock = {
  findOne: jest.Mock;
  save: jest.Mock;
};

const createUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    email: "teacher@example.com",
    password: "hash",
    name: "Ada",
    surname: "Lovelace",
    github: "ada",
    isActive: true,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    refreshTokenHash: null,
    refreshTokenExpiresAt: null,
    role: { id: 2, name: "преподаватель", users: [] },
    ...overrides
  }) as User;

describe("UsersService", () => {
  const createService = (repo: Partial<UserRepoMock> = {}) => {
    const userRepo: UserRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((user: User) => Promise.resolve(user)),
      ...repo
    };
    return {
      service: new UsersService(userRepo as never),
      userRepo
    };
  };

  it("returns current user profile without sensitive fields", async () => {
    const user = createUser();
    const { service } = createService({
      findOne: jest.fn().mockResolvedValue(user)
    });

    await expect(service.getMe(1)).resolves.toEqual({
      id: 1,
      email: "teacher@example.com",
      name: "Ada",
      surname: "Lovelace",
      github: "ada",
      isActive: true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: { id: 2, name: "преподаватель" }
    });
  });

  it("throws when current user does not exist", async () => {
    const { service } = createService({
      findOne: jest.fn().mockResolvedValue(null)
    });

    await expect(service.getMe(404)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates profile fields and checks email/github uniqueness", async () => {
    const user = createUser();
    const { service, userRepo } = createService({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
    });

    const result = await service.updateMe(1, {
      email: "new@example.com",
      github: null,
      name: "Grace",
      surname: "Hopper"
    });

    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        github: null,
        name: "Grace",
        surname: "Hopper"
      })
    );
    expect(result).toMatchObject({
      email: "new@example.com",
      github: null,
      name: "Grace",
      surname: "Hopper"
    });
  });

  it("rejects conflicting email or github", async () => {
    const user = createUser();
    const existing = createUser({ id: 2, email: "taken@example.com", github: "taken" });

    const emailCase = createService({
      findOne: jest.fn().mockResolvedValueOnce(user).mockResolvedValueOnce(existing)
    });
    await expect(
      emailCase.service.updateMe(1, { email: "taken@example.com" })
    ).rejects.toBeInstanceOf(ConflictException);

    const githubCase = createService({
      findOne: jest.fn().mockResolvedValueOnce(user).mockResolvedValueOnce(existing)
    });
    await expect(githubCase.service.updateMe(1, { github: "taken" })).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});
