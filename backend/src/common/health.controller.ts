import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

@Controller("health")
@ApiTags("Health")
export class HealthController {
  @Get()
  @ApiOperation({ summary: "Проверка доступности backend" })
  getHealth() {
    return {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime())
    };
  }
}
