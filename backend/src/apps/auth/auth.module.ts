import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HttpModule } from "@nestjs/axios";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { User } from "./entities/user.entity";
import { Role } from "./entities/role.entity";
import { AuthSeedService } from "./auth-seed.service";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Role]),
    HttpModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m") as never }
      })
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSeedService],
  exports: [AuthService]
})
export class AuthModule {}
