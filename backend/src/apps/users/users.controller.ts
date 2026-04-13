import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UsersService } from "./users.service";
import { UpdateMeDto } from "./dto/update-me.dto";

@Controller("users")
@ApiTags("Users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Информация о текущем пользователе" })
  async getMe(@Req() req: { user?: { sub?: number | string } }) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.usersService.getMe(userId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Обновление профиля текущего пользователя" })
  async updateMe(@Req() req: { user?: { sub?: number | string } }, @Body() dto: UpdateMeDto) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.usersService.updateMe(userId, dto);
  }
}
