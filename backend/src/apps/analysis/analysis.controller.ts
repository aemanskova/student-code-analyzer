import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalysisService } from './analysis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('analysis')
@UseGuards(JwtAuthGuard)
@ApiTags('Analysis')
@ApiBearerAuth('bearer')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post('run/s3/async')
  @ApiOperation({ summary: 'Асинхронный запуск анализа по ключу объекта в S3/MinIO' })
  async runFromS3Async(
    @Body() body: Record<string, unknown>,
    @Req() req: { user?: { sub?: number | string } },
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return this.analysisService.enqueueRunFromS3Object({
      userId,
      key: String(body.key || ''),
      direction: String(body.direction || ''),
      metrics: this.parseMetrics(body.metrics),
      group: body.group ? String(body.group) : undefined,
      student: body.student ? String(body.student) : undefined,
      r: this.parseBoolean(body.r),
      depth: this.parseNumber(body.depth),
    });
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Статус фоновой задачи анализа' })
  async getAnalysisJobStatus(
    @Param('jobId') jobId: string,
    @Req() req: { user?: { sub?: number | string } },
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return this.analysisService.getAnalysisJobStatus(userId, String(jobId || ''));
  }

  @Get('results')
  @ApiOperation({ summary: 'Получить сохраненные результаты по path и direction' })
  async getSavedResults(
    @Query('path') pathValue: string,
    @Query('direction') direction: string,
    @Req() req: { user?: { sub?: number | string } },
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return this.analysisService.getSavedResults(userId, direction, pathValue);
  }

  @Get('results/run/:runId')
  @ApiOperation({ summary: 'Получить результаты по runId' })
  async getSavedResultsByRunId(
    @Param('runId') runId: string,
    @Req() req: { user?: { sub?: number | string } },
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return this.analysisService.getSavedResultsByRunId(userId, runId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Список запусков анализа с пагинацией' })
  async getSavedAnalysisList(
    @Query('page') pageValue: string | undefined,
    @Query('size') sizeValue: string | undefined,
    @Req() req: { user?: { sub?: number | string } },
  ) {
    const userId = Number(req.user?.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid token payload');
    }
    const page = this.parsePaginationValue(pageValue, 1);
    const size = this.parsePaginationValue(sizeValue, 10);
    return this.analysisService.getSavedAnalysisList(userId, page, size);
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
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v));
        }
      } catch {
        return undefined;
      }
    }
    return text.split(',').map((part) => part.trim()).filter(Boolean);
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const text = String(value).toLowerCase();
    return text === 'true' || text === '1' || text === 'yes';
  }

  private parseNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return Math.trunc(parsed);
  }

  private parsePaginationValue(value: unknown, defaultValue: number): number {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return defaultValue;
    }
    const intValue = Math.trunc(parsed);
    return intValue > 0 ? intValue : defaultValue;
  }
}
