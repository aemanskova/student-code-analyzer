import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUserId } from "../auth/current-user-id.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ClusteringService } from "./clustering.service";

@Controller("clustering")
@UseGuards(JwtAuthGuard)
@ApiTags("Clustering")
@ApiBearerAuth("bearer")
export class ClusteringController {
  constructor(private readonly clusteringService: ClusteringService) {}

  @Get("run/:runId")
  @ApiOperation({ summary: "Получить DBSCAN-кластеры для html_css runId" })
  async getClusters(@Param("runId") runId: string, @CurrentUserId() userId: number) {
    return this.clusteringService.getClusters(userId, runId);
  }

  @Get("run/:runId/outliers")
  @ApiOperation({ summary: "Получить выбросы DBSCAN для html_css runId" })
  async getOutliers(@Param("runId") runId: string, @CurrentUserId() userId: number) {
    return this.clusteringService.getOutliers(userId, runId);
  }
}
