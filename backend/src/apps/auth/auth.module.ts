import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { User } from "./entities/user.entity";
import { Role } from "./entities/role.entity";
import { AuthSeedService } from "./auth-seed.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role]),
    HttpModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "super_secret_jwt_for_development",
      signOptions: { expiresIn: "10h" }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSeedService],
  exports: [AuthService]
})
export class AuthModule {}
