import { Body, Controller, Post, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Регистрация пользователя' })
  registerUser(@Body() dto: RegisterDto): Promise<object> {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Вход пользователя (access + refresh tokens)' })
  loginUser(@Body() dto: LoginDto): Promise<object> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Обновление access token по refresh token' })
  refreshTokens(@Body() dto: RefreshTokenDto): Promise<object> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Выход пользователя (инвалидация refresh token)' })
  logout(@Req() req: { user?: { sub?: number | string } }): Promise<object> {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return this.authService.logout(userId);
  }
}
