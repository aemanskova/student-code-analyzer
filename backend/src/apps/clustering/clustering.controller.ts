import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
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

  @Get("list")
  @ApiOperation({ summary: "Получить список выполненных кластеризаций" })
  async getClusterizationList(@CurrentUserId() userId: number) {
    return this.clusteringService.getClusterizationList(userId);
  }

  @Get("jobs/:jobId")
  @ApiOperation({ summary: "Получить сохраненную кластеризацию" })
  async getClusterizationDetails(@Param("jobId") jobId: string, @CurrentUserId() userId: number) {
    return this.clusteringService.getClusterizationDetails(userId, jobId);
  }

  @Post("run/:runId/build")
  @ApiOperation({ summary: "Выполнить и сохранить DBSCAN-кластеризацию для html_css runId" })
  async buildClusterization(@Param("runId") runId: string, @CurrentUserId() userId: number) {
    return this.clusteringService.buildClusterization(userId, runId);
  }

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
