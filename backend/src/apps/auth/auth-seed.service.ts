import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "./entities/role.entity";

@Injectable()
export class AuthSeedService implements OnModuleInit {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>
  ) {}

  async onModuleInit() {
    const roleNames = ["студент", "преподаватель"];

    for (const roleName of roleNames) {
      const exists = await this.roleRepo.findOne({ where: { name: roleName } });
      if (!exists) {
        await this.roleRepo.save(this.roleRepo.create({ name: roleName }));
      }
    }
  }
}
