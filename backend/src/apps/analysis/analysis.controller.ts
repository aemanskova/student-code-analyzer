import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUserId } from "../auth/current-user-id.decorator";
import { AnalysisService } from "./analysis.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import {
  AnalysisJobsQueryDto,
  RunFromS3AsyncDto,
  SavedAnalysisListQueryDto,
  SavedResultsQueryDto,
  StandaloneHeatmapBuildDto,
  StandaloneHeatmapListQueryDto
} from "./dto/analysis-requests.dto";

@Controller("analysis")
@UseGuards(JwtAuthGuard)
@ApiTags("Analysis")
@ApiBearerAuth("bearer")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post("run/s3/async")
  @ApiOperation({ summary: "Асинхронный запуск анализа по ключу объекта в S3/MinIO" })
  async runFromS3Async(@Body() body: RunFromS3AsyncDto, @CurrentUserId() userId: number) {
    return this.analysisService.enqueueRunFromS3Object({
      userId,
      key: body.key,
      direction: body.direction,
      metrics: body.metrics,
      eslintConfigText: body.eslintConfigText,
      eslintConfigFormat: body.eslintConfigFormat,
      r: body.r,
      depth: body.depth,
      includeGitMetrics: body.includeGitMetrics ?? true
    });
  }

  @Post("heatmap/validate-upload")
  @ApiOperation({ summary: "Проверка лимита работ для тепловой карты до запуска анализа" })
  async validateHeatmapUpload(
    @Body() body: Record<string, unknown>,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.validateS3HeatmapLimit({
      userId,
      key: String(body.key || ""),
      r: this.parseBoolean(body.r),
      depth: this.parseNumber(body.depth),
      selectedLevels: this.parseSelectedLevels(body)
    });
  }

  @Post("heatmap/build/async")
  @ApiOperation({ summary: "Асинхронно построить тепловую карту по отдельному архиву" })
  async buildStandaloneHeatmapAsync(
    @Body() body: StandaloneHeatmapBuildDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.enqueueStandaloneHeatmapBuild({
      userId,
      key: body.key,
      originalName: body.originalName,
      r: body.r,
      depth: body.depth
    });
  }

  @Get("heatmap/list")
  @ApiOperation({ summary: "Список построенных отдельных тепловых карт" })
  async getStandaloneHeatmapList(
    @Query() query: StandaloneHeatmapListQueryDto,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.getStandaloneHeatmapList(userId, {
      folder: this.parseText(query.folder),
      dateFrom: this.parseDate(query.dateFrom, "start"),
      dateTo: this.parseDate(query.dateTo, "end")
    });
  }

  @Get("heatmap/:jobId")
  @ApiOperation({ summary: "Детали отдельной тепловой карты" })
  async getStandaloneHeatmapDetails(
    @Param("jobId") jobId: string,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.getStandaloneHeatmapDetails(userId, String(jobId || ""));
  }

  @Delete("heatmap/:jobId")
  @ApiOperation({ summary: "Удалить построенную тепловую карту" })
  async deleteStandaloneHeatmap(@Param("jobId") jobId: string, @CurrentUserId() userId: number) {
    return this.analysisService.deleteStandaloneHeatmap(userId, String(jobId || ""));
  }

  @Get("jobs/:jobId")
  @ApiOperation({ summary: "Статус фоновой задачи анализа" })
  async getAnalysisJobStatus(@Param("jobId") jobId: string, @CurrentUserId() userId: number) {
    return this.analysisService.getAnalysisJobStatus(userId, String(jobId || ""));
  }

  @Get("jobs")
  @ApiOperation({ summary: "Список фоновых задач анализа" })
  async getAnalysisJobs(@Query() query: AnalysisJobsQueryDto, @CurrentUserId() userId: number) {
    const statuses = this.parseJobStatuses(query.status);
    const limit = query.limit ?? 100;
    return this.analysisService.getAnalysisJobs(userId, statuses, limit);
  }

  @Get("results")
  @ApiOperation({ summary: "Получить сохраненные результаты по path и direction" })
  async getSavedResults(@Query() query: SavedResultsQueryDto, @CurrentUserId() userId: number) {
    return this.analysisService.getSavedResults(userId, query.direction, query.path);
  }

  @Get("results/run/:runId")
  @ApiOperation({ summary: "Получить результаты по runId" })
  async getSavedResultsByRunId(@Param("runId") runId: string, @CurrentUserId() userId: number) {
    return this.analysisService.getSavedResultsByRunId(userId, runId);
  }

  @Get("results/run/:runId/select-options")
  @ApiOperation({ summary: "Получить справочники селектов для фильтрации результатов runId" })
  async getRunSelectOptions(
    @Param("runId") runId: string,
    @Query() query: Record<string, unknown>,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.getRunFilterOptions(userId, runId, {
      kind: this.parseFilterKind(query.kind),
      depth: this.parseNumber(query.depth),
      selectedLevels: this.parseSelectedLevels(query)
    });
  }

  @Get("results/run/:runId/view")
  @ApiOperation({ summary: "Получить данные для графиков и таблиц runId по фильтрам" })
  async getRunView(
    @Param("runId") runId: string,
    @Query() query: Record<string, unknown>,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.getRunView(userId, runId, {
      kind: this.parseFilterKind(query.kind),
      depth: this.parseNumber(query.depth),
      selectedLevels: this.parseSelectedLevels(query)
    });
  }

  @Get("results/run/:runId/heatmap/history")
  @ApiOperation({ summary: "Получить историю построенных тепловых карт по runId" })
  async getRunHeatmapHistory(@Param("runId") runId: string, @CurrentUserId() userId: number) {
    return this.analysisService.getRunHeatmapHistory(userId, runId);
  }

  @Post("results/run/:runId/heatmap/build")
  @ApiOperation({ summary: "Построить тепловую карту для выбранного среза runId" })
  async buildHeatmapForRunView(
    @Param("runId") runId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.buildPlagiarismHeatmapByRunFilters({
      userId,
      runId: String(runId || ""),
      depth: this.parseNumber(body.depth),
      selectedLevels: this.parseSelectedLevels(body)
    });
  }

  @Post("results/run/:runId/heatmap/build/async")
  @ApiOperation({ summary: "Асинхронно построить тепловую карту для выбранного среза runId" })
  async buildHeatmapForRunViewAsync(
    @Param("runId") runId: string,
    @Body() body: Record<string, unknown>,
    @CurrentUserId() userId: number
  ) {
    return this.analysisService.enqueueHeatmapBuildByRunFilters({
      userId,
      runId: String(runId || ""),
      depth: this.parseNumber(body.depth),
      selectedLevels: this.parseSelectedLevels(body)
    });
  }

  @Get("list")
  @ApiOperation({ summary: "Список запусков анализа с пагинацией" })
  async getSavedAnalysisList(
    @Query() query: SavedAnalysisListQueryDto,
    @CurrentUserId() userId: number
  ) {
    const page = query.page ?? 1;
    const size = query.size ?? 20;
    return this.analysisService.getSavedAnalysisList(userId, page, size, {
      path: this.parseText(query.path),
      direction: this.parseText(query.direction),
      dateFrom: this.parseDate(query.dateFrom, "start"),
      dateTo: this.parseDate(query.dateTo, "end")
    });
  }

  @Delete("results/run/:runId")
  @ApiOperation({ summary: "Удалить сохраненный отчет анализа по runId" })
  async deleteSavedRun(@Param("runId") runId: string, @CurrentUserId() userId: number) {
    return this.analysisService.deleteSavedRun(userId, runId);
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const text = String(value).toLowerCase();
    return text === "true" || text === "1" || text === "yes";
  }

  private parseNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return Math.trunc(parsed);
  }

  private parseText(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const text = String(value).trim();
    return text || undefined;
  }

  private parseDate(value: unknown, bound: "start" | "end"): Date | undefined {
    const text = this.parseText(value);
    if (!text) {
      return undefined;
    }

    const dayMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dayMatch) {
      const year = Number(dayMatch[1]);
      const month = Number(dayMatch[2]);
      const day = Number(dayMatch[3]);
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return undefined;
      }
      if (bound === "start") {
        return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      }
      return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    }

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed;
  }

  private parseJobStatuses(value: unknown): Array<"queued" | "running" | "success" | "failed"> {
    if (value === undefined || value === null || value === "") {
      return ["queued", "running"];
    }

    const allowed = new Set(["queued", "running", "success", "failed"]);
    const parsed = String(value)
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item));
    return parsed as Array<"queued" | "running" | "success" | "failed">;
  }

  private parseFilterKind(value: unknown): "metrics" | "git" {
    const text = String(value || "")
      .trim()
      .toLowerCase();
    return text === "git" ? "git" : "metrics";
  }

  private parseSelectedLevels(query: Record<string, unknown>): string[][] {
    const selected: string[][] = [];

    for (const [key, value] of Object.entries(query || {})) {
      const match = key.match(/^level(\d+)$/i);
      if (!match) {
        continue;
      }
      const level = Number(match[1] || 0);
      if (!Number.isFinite(level) || level < 1 || level > 12) {
        continue;
      }

      const rawText = Array.isArray(value) ? value.join(",") : String(value || "");
      selected[level - 1] = rawText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return selected;
  }
}
