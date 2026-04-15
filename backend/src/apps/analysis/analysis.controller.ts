import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AnalysisService } from "./analysis.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("analysis")
@UseGuards(JwtAuthGuard)
@ApiTags("Analysis")
@ApiBearerAuth("bearer")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post("run/s3/async")
  @ApiOperation({ summary: "Асинхронный запуск анализа по ключу объекта в S3/MinIO" })
  async runFromS3Async(
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.enqueueRunFromS3Object({
      userId,
      key: String(body.key || ""),
      direction: String(body.direction || ""),
      metrics: this.parseMetrics(body.metrics),
      group: body.group ? String(body.group) : undefined,
      student: body.student ? String(body.student) : undefined,
      r: this.parseBoolean(body.r),
      depth: this.parseNumber(body.depth),
      includeGitMetrics: this.parseBoolean(body.includeGitMetrics) ?? true
    });
  }

  @Get("jobs/:jobId")
  @ApiOperation({ summary: "Статус фоновой задачи анализа" })
  async getAnalysisJobStatus(
    @Param("jobId") jobId: string,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.getAnalysisJobStatus(userId, String(jobId || ""));
  }

  @Get("jobs")
  @ApiOperation({ summary: "Список фоновых задач анализа" })
  async getAnalysisJobs(
    @Query("status") statusValue: string | undefined,
    @Query("limit") limitValue: string | undefined,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }

    const statuses = this.parseJobStatuses(statusValue);
    const limit = this.parsePaginationValue(limitValue, 100);
    return this.analysisService.getAnalysisJobs(userId, statuses, limit);
  }

  @Get("results")
  @ApiOperation({ summary: "Получить сохраненные результаты по path и direction" })
  async getSavedResults(
    @Query("path") pathValue: string,
    @Query("direction") direction: string,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.getSavedResults(userId, direction, pathValue);
  }

  @Get("results/run/:runId")
  @ApiOperation({ summary: "Получить результаты по runId" })
  async getSavedResultsByRunId(
    @Param("runId") runId: string,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.getSavedResultsByRunId(userId, runId);
  }

  @Get("results/run/:runId/select-options")
  @ApiOperation({ summary: "Получить справочники селектов для фильтрации результатов runId" })
  async getRunSelectOptions(
    @Param("runId") runId: string,
    @Query() query: Record<string, unknown>,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
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
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.getRunView(userId, runId, {
      kind: this.parseFilterKind(query.kind),
      depth: this.parseNumber(query.depth),
      selectedLevels: this.parseSelectedLevels(query)
    });
  }

  @Get("list")
  @ApiOperation({ summary: "Список запусков анализа с пагинацией" })
  async getSavedAnalysisList(
    @Query("page") pageValue: string | undefined,
    @Query("size") sizeValue: string | undefined,
    @Query("path") pathValue: string | undefined,
    @Query("direction") directionValue: string | undefined,
    @Query("dateFrom") dateFromValue: string | undefined,
    @Query("dateTo") dateToValue: string | undefined,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    const page = this.parsePaginationValue(pageValue, 1);
    const size = this.parsePaginationValue(sizeValue, 20);
    return this.analysisService.getSavedAnalysisList(userId, page, size, {
      path: this.parseText(pathValue),
      direction: this.parseText(directionValue),
      dateFrom: this.parseDate(dateFromValue, "start"),
      dateTo: this.parseDate(dateToValue, "end")
    });
  }

  @Delete("results/run/:runId")
  @ApiOperation({ summary: "Удалить сохраненный отчет анализа по runId" })
  async deleteSavedRun(
    @Param("runId") runId: string,
    @Req() req: { user?: { sub?: number | string } }
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException("Invalid token payload");
    }
    return this.analysisService.deleteSavedRun(userId, runId);
  }

  private parseMetrics(value: unknown): string[] | undefined {
    if (!value) {
      return undefined;
    }
    if (Array.isArray(value)) {
      return value.map((v) => String(v));
    }
    const text = String(value).trim();
    if (!text) {
      return undefined;
    }
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v));
        }
      } catch {
        return undefined;
      }
    }
    return text
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
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

  private parsePaginationValue(value: unknown, defaultValue: number): number {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return defaultValue;
    }
    const intValue = Math.trunc(parsed);
    return intValue > 0 ? intValue : defaultValue;
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
      const values = rawText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      selected[level - 1] = values;
    }

    return selected;
  }
}
