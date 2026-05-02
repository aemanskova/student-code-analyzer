import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import { CurrentUserId } from "./current-user-id.decorator";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
@ApiTags("Auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: "Регистрация пользователя" })
  registerUser(@Body() dto: RegisterDto): Promise<object> {
    return this.authService.register(dto);
  }

  @Post("login")
  @Throttle({ default: { limit: 25, ttl: 60_000 } })
  @ApiOperation({ summary: "Вход пользователя (access + refresh tokens)" })
  loginUser(@Body() dto: LoginDto): Promise<object> {
    return this.authService.login(dto);
  }

  @Post("refresh")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Обновление access token по refresh token" })
  refreshTokens(@Body() dto: RefreshTokenDto): Promise<object> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post("logout")
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Выход пользователя (инвалидация refresh token)" })
  logout(@CurrentUserId() userId: number): Promise<object> {
    return this.authService.logout(userId);
  }
}
