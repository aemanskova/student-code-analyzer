import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit
} from "@nestjs/common";
import { createReadStream, createWriteStream } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";
import * as unzipper from "unzipper";
import {
  CompleteMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Like, Repository } from "typeorm";
import { DuckdbService } from "../database/duckdb/duckdb.service";
import { MetricsService } from "../metrics/metrics.service";
import { PathParserService } from "../utils/path-parser/path-parser.service";
import { RunAnalysisDto } from "./dto/run-analysis.dto";
import { AnalysisResponse, AnalysisRow, GitAnalysisRow } from "./analysis.types";
import { HtmlCssFullAnalyzerService } from "./html-css-full-analyzer.service";
import { AnalysisGitResult } from "./entities/analysis-git-result.entity";
import { AnalysisJob, AnalysisJobStatus } from "./entities/analysis-job.entity";
import { AnalysisResult } from "./entities/analysis-result.entity";
import { AnalysisUpload } from "./entities/analysis-upload.entity";

interface ZipAnalysisInput {
  userId: number;
  archive: { originalname?: string; buffer?: Buffer; path?: string; size?: number };
  cleanupArchivePath?: boolean;
  sourceFingerprint?: string;
  onProgress?: (stage: string, progressPercent: number) => Promise<void> | void;
  direction: string;
  metrics?: string[];
  group?: string;
  student?: string;
  r?: boolean;
  depth?: number;
  includeGitMetrics?: boolean;
}

interface QueuedZipJob {
  jobId: string;
  input: ZipAnalysisInput;
  onSuccess?: () => Promise<void>;
  onError?: (message: string) => Promise<void>;
}

interface QueuedS3Job {
  jobId: string;
  input: {
    userId: number;
    key: string;
    direction: string;
    metrics?: string[];
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
  };
}

type QueuedJob = QueuedZipJob | QueuedS3Job;

type RunFilterKind = "metrics" | "git";

type RunFilterInput = {
  kind: RunFilterKind;
  depth?: number;
  selectedLevels?: string[][];
};

@Injectable()
export class AnalysisService implements OnModuleInit {
  private readonly runExecFile = promisify(execFile);
  private readonly logger = new Logger(AnalysisService.name);
  private readonly csvRoot = process.env.CSV_ROOT || "/app/csv";
  private readonly worksRoot = process.env.WORKS_ROOT || "/app/works";
  private readonly ignoredDirNames = new Set([
    ".git",
    ".github",
    ".vscode",
    "node_modules",
    "bootstrap",
    "images",
    "__MACOSX"
  ]);
  private readonly asyncConcurrency = Math.max(
    1,
    Number(process.env.ANALYSIS_ASYNC_CONCURRENCY || 1)
  );
  private readonly s3Bucket = String(process.env.S3_BUCKET || "").trim();
  private readonly s3Endpoint = String(process.env.S3_ENDPOINT || "").trim();
  private readonly s3PublicEndpoint = String(process.env.S3_PUBLIC_ENDPOINT || "").trim();
  private readonly s3Region = String(process.env.S3_REGION || "us-east-1").trim();
  private readonly s3AccessKeyId = String(process.env.S3_ACCESS_KEY_ID || "").trim();
  private readonly s3SecretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || "").trim();
  private readonly s3ForcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || "true") === "true";
  private s3Client: S3Client | null = null;
  private s3PresignClient: S3Client | null = null;
  private s3BucketEnsured = false;
  private readonly queuedJobs: QueuedJob[] = [];
  private runningJobs = 0;
  private readonly gitBinaryExtensions = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".svg",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".7z",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".wav",
    ".ppt",
    ".pptx",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".bin",
    ".dat",
    ".db",
    ".sqlite"
  ]);

  constructor(
    private readonly duckdbService: DuckdbService,
    private readonly metricsService: MetricsService,
    private readonly pathParserService: PathParserService,
    private readonly fullAnalyzer: HtmlCssFullAnalyzerService,
    @InjectRepository(AnalysisJob)
    private readonly analysisJobRepo: Repository<AnalysisJob>,
    @InjectRepository(AnalysisUpload)
    private readonly analysisUploadRepo: Repository<AnalysisUpload>,
    @InjectRepository(AnalysisGitResult)
    private readonly analysisGitResultRepo: Repository<AnalysisGitResult>,
    @InjectRepository(AnalysisResult)
    private readonly analysisResultRepo: Repository<AnalysisResult>
  ) {}

  async onModuleInit(): Promise<void> {
    await this.recoverStaleJobsAfterRestart();
  }

  private getDefaultFullMetrics(fullMetrics: string[]): string[] {
    return fullMetrics;
  }

  async run(dto: RunAnalysisDto): Promise<AnalysisResponse> {
    if (!this.metricsService.getSupportedDirections().includes(dto.direction)) {
      throw new BadRequestException(`Unsupported direction: ${dto.direction}`);
    }

    if (dto.depth !== undefined && dto.depth < 1) {
      throw new BadRequestException("depth must be >= 1");
    }

    const basicMetrics = this.metricsService.getSupportedMetrics(dto.direction);

    if (dto.rootPath && dto.direction === "html_css") {
      const fullMetrics = this.fullAnalyzer.supportedMetrics;
      const selectedMetrics = dto.metrics?.length
        ? dto.metrics
        : this.getDefaultFullMetrics(fullMetrics);
      const allAllowed = new Set([...basicMetrics, ...fullMetrics]);

      const invalidMetrics = selectedMetrics.filter((metric) => !allAllowed.has(metric));
      if (invalidMetrics.length > 0) {
        throw new BadRequestException(
          `Unsupported metrics for ${dto.direction}: ${invalidMetrics.join(", ")}`
        );
      }

      const useFullMetrics =
        !dto.metrics?.length || selectedMetrics.some((metric) => fullMetrics.includes(metric));

      if (useFullMetrics) {
        const fullResult = await this.runFromFolderFull(dto, selectedMetrics);
        return this.withOptionalGitData(fullResult, dto);
      }

      const basicResult = await this.runFromFolderBasic(dto, selectedMetrics);
      return this.withOptionalGitData(basicResult, dto);
    }

    const selectedMetrics = dto.metrics?.length ? dto.metrics : basicMetrics;

    if (!selectedMetrics.length) {
      throw new BadRequestException("No available metrics for selected direction");
    }

    const invalidMetrics = selectedMetrics.filter((metric) => !basicMetrics.includes(metric));
    if (invalidMetrics.length > 0) {
      throw new BadRequestException(
        `Unsupported metrics for ${dto.direction}: ${invalidMetrics.join(", ")}`
      );
    }

    if (dto.rootPath) {
      const folderResult = await this.runFromFolderBasic(dto, selectedMetrics);
      return this.withOptionalGitData(folderResult, dto);
    }

    return this.runFromCsv(dto, selectedMetrics);
  }

  async runAsCsv(dto: RunAnalysisDto): Promise<string> {
    const result = await this.run(dto);
    return this.toCsv(result.data, result.metrics);
  }

  async runFromZip(input: ZipAnalysisInput): Promise<AnalysisResponse> {
    if (!Number.isFinite(input.userId) || input.userId <= 0) {
      throw new BadRequestException("userId is required");
    }
    if (!input.archive) {
      throw new BadRequestException("archive is required");
    }
    if (!input.direction) {
      throw new BadRequestException("direction is required");
    }
    if (input.depth !== undefined && input.depth < 1) {
      throw new BadRequestException("depth must be >= 1");
    }
    const archiveName = (input.archive.originalname || "").toLowerCase();
    if (!archiveName.endsWith(".zip")) {
      throw new BadRequestException("archive must be a .zip file");
    }

    if (!input.archive.buffer && !input.archive.path) {
      throw new BadRequestException("archive content is empty");
    }

    const selectedMetrics = this.resolveSelectedMetrics(input.direction, input.metrics);
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "analysis-zip-"));
    let archivePath = input.archive.path;
    try {
      await input.onProgress?.("Подготовка данных", 3);
      if (!archivePath) {
        const tempZipFile = path.join(tempRoot, "upload.zip");
        await fs.writeFile(tempZipFile, input.archive.buffer as Buffer);
        archivePath = tempZipFile;
      }

      const cacheKey = await this.buildZipCacheKey(input, archivePath, selectedMetrics);
      const cached = await this.getCachedResultByKey(
        input.userId,
        input.direction,
        selectedMetrics,
        cacheKey
      );
      if (cached) {
        await input.onProgress?.("Кэш", 100);
        return cached;
      }

      const extractedFiles = await this.extractZipToDir(archivePath, tempRoot, (extractProgress) =>
        input.onProgress?.("Подготовка файлов к проверке", 5 + Math.floor(extractProgress * 0.45))
      );
      if (!extractedFiles) {
        throw new BadRequestException("zip archive is empty");
      }

      await input.onProgress?.("Запуск проверки работ", 55);
      const result = await this.run({
        direction: input.direction,
        metrics: selectedMetrics,
        group: input.group,
        student: input.student,
        rootPath: tempRoot,
        r: input.r,
        depth: input.depth,
        includeGitMetrics: input.includeGitMetrics,
        onAnalyzeProgress: async (completed, total, currentPath) => {
          if (!input.onProgress) {
            return;
          }
          const safeTotal = Math.max(1, total);
          const ratio = Math.max(0, Math.min(1, completed / safeTotal));
          const progress = 55 + Math.floor(ratio * 37);
          const workLabel = this.extractWorkLabel(currentPath);
          await input.onProgress(
            `Проверяем папку: ${workLabel} (${completed}/${safeTotal})`,
            progress
          );
        },
        onGitProgress: async (completed, total, currentRepoPath) => {
          if (!input.onProgress) {
            return;
          }
          const safeTotal = Math.max(1, total);
          const ratio = Math.max(0, Math.min(1, completed / safeTotal));
          const progress = 93 + Math.floor(ratio * 5);
          const repoLabel = this.extractWorkLabel(currentRepoPath);
          await input.onProgress(
            `Считаем Git-метрики: ${repoLabel} (${completed}/${safeTotal})`,
            progress
          );
        }
      });
      await input.onProgress?.("Сохраняем результаты", 99);
      const runId = await this.saveResultsForUser(input.userId, result, cacheKey);
      await input.onProgress?.("Готово", 100);
      return {
        ...result,
        runId
      };
    } finally {
      if (archivePath && input.cleanupArchivePath !== false) {
        await fs.rm(archivePath, { force: true });
      }
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }

  async enqueueRunFromZip(
    input: ZipAnalysisInput,
    callbacks?: { onSuccess?: () => Promise<void>; onError?: (message: string) => Promise<void> }
  ) {
    if (!input.archive?.path) {
      throw new BadRequestException("archive path is required for async processing");
    }
    const jobId = randomUUID();
    const created = this.analysisJobRepo.create({
      id: jobId,
      userId: input.userId,
      direction: input.direction,
      status: "queued",
      archiveName: input.archive.originalname || null,
      progressPercent: 0,
      stage: "Ожидание",
      errorMessage: null,
      requestPayload: {
        metrics: input.metrics || [],
        r: Boolean(input.r),
        depth: input.depth ?? null,
        includeGitMetrics: this.resolveIncludeGitMetrics(input.includeGitMetrics)
      },
      resultPayload: null,
      startedAt: null,
      finishedAt: null,
      heartbeatAt: null
    });
    await this.analysisJobRepo.save(created);

    this.queuedJobs.push({
      jobId,
      input,
      onSuccess: callbacks?.onSuccess,
      onError: callbacks?.onError
    });
    void this.processQueue();

    return {
      jobId,
      status: "queued" as AnalysisJobStatus,
      createdAt: created.createdAt
    };
  }

  async saveUploadedZip(
    userId: number,
    archive: { originalname?: string; path?: string; size?: number; mimetype?: string }
  ) {
    if (!archive.path) {
      throw new BadRequestException("archive path is required");
    }
    await this.ensureFileExists(archive.path);

    const originalName = String(archive.originalname || "").trim();
    if (!originalName.toLowerCase().endsWith(".zip")) {
      await fs.rm(archive.path, { force: true });
      throw new BadRequestException("archive must be a .zip file");
    }

    const upload = this.analysisUploadRepo.create({
      id: randomUUID(),
      userId,
      originalName,
      storedPath: archive.path,
      size: Number.isFinite(archive.size as number) ? Number(archive.size) : 0,
      mimeType: archive.mimetype ? String(archive.mimetype) : null,
      status: "uploaded",
      consumedAt: null
    });
    await this.analysisUploadRepo.save(upload);

    return {
      uploadId: upload.id,
      fileName: upload.originalName,
      size: upload.size,
      status: upload.status,
      createdAt: upload.createdAt
    };
  }

  async enqueueRunFromUpload(input: {
    userId: number;
    uploadId: string;
    direction: string;
    metrics?: string[];
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
  }) {
    const uploadId = String(input.uploadId || "").trim();
    if (!uploadId) {
      throw new BadRequestException("uploadId is required");
    }
    const upload = await this.analysisUploadRepo.findOne({
      where: { id: uploadId, userId: input.userId }
    });
    if (!upload) {
      throw new NotFoundException("Загруженный архив не найден");
    }
    if (upload.status === "processing") {
      throw new BadRequestException("Этот архив уже обрабатывается");
    }
    if (upload.status === "done") {
      throw new BadRequestException("Этот архив уже был обработан");
    }

    await this.ensureFileExists(upload.storedPath);
    upload.status = "processing";
    await this.analysisUploadRepo.save(upload);

    return this.enqueueRunFromZip(
      {
        userId: input.userId,
        archive: {
          originalname: upload.originalName,
          path: upload.storedPath,
          size: upload.size
        },
        cleanupArchivePath: true,
        direction: input.direction,
        metrics: input.metrics,
        group: input.group,
        student: input.student,
        r: input.r,
        depth: input.depth,
        includeGitMetrics: input.includeGitMetrics
      },
      {
        onSuccess: async () => {
          upload.status = "done";
          upload.consumedAt = new Date();
          await this.analysisUploadRepo.save(upload);
        },
        onError: async () => {
          upload.status = "failed";
          upload.consumedAt = new Date();
          await this.analysisUploadRepo.save(upload);
        }
      }
    );
  }

  async getUploadStatus(userId: number, uploadId: string) {
    const normalizedUploadId = String(uploadId || "").trim();
    if (!normalizedUploadId) {
      throw new BadRequestException("uploadId is required");
    }

    const upload = await this.analysisUploadRepo.findOne({
      where: { id: normalizedUploadId, userId }
    });
    if (!upload) {
      throw new NotFoundException("Загрузка не найдена");
    }

    return {
      uploadId: upload.id,
      fileName: upload.originalName,
      size: upload.size,
      mimeType: upload.mimeType,
      status: upload.status,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
      consumedAt: upload.consumedAt
    };
  }

  async initS3MultipartUpload(input: { userId: number; fileName: string; contentType?: string }) {
    await this.ensureS3BucketExists();
    const safeFileName = this.sanitizeObjectName(input.fileName || "archive.zip");
    const objectKey = `uploads/${input.userId}/${Date.now()}-${randomUUID()}-${safeFileName}`;

    const command = new CreateMultipartUploadCommand({
      Bucket: this.getS3Bucket(),
      Key: objectKey,
      ContentType: input.contentType || "application/zip"
    });
    const response = await this.getS3Client().send(command);

    if (!response.UploadId) {
      throw new BadRequestException("Не удалось инициализировать multipart upload");
    }

    return {
      bucket: this.getS3Bucket(),
      key: objectKey,
      uploadId: response.UploadId
    };
  }

  async getS3MultipartPartUrl(input: {
    userId: number;
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds?: number;
  }) {
    await this.ensureS3BucketExists();
    this.assertOwnedObjectKey(input.userId, input.key);
    if (!input.uploadId) {
      throw new BadRequestException("uploadId is required");
    }
    if (!Number.isFinite(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) {
      throw new BadRequestException("partNumber must be in range 1..10000");
    }

    const command = new UploadPartCommand({
      Bucket: this.getS3Bucket(),
      Key: input.key,
      UploadId: input.uploadId,
      PartNumber: Math.trunc(input.partNumber)
    });
    const url = await getSignedUrl(this.getS3PresignClient(), command, {
      expiresIn: Math.max(60, Math.min(3600, input.expiresInSeconds || 900))
    });

    return {
      url,
      key: input.key,
      uploadId: input.uploadId,
      partNumber: Math.trunc(input.partNumber),
      expiresInSeconds: Math.max(60, Math.min(3600, input.expiresInSeconds || 900))
    };
  }

  async completeS3MultipartUpload(input: {
    userId: number;
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string }>;
  }) {
    await this.ensureS3BucketExists();
    this.assertOwnedObjectKey(input.userId, input.key);
    if (!input.uploadId) {
      throw new BadRequestException("uploadId is required");
    }
    if (!Array.isArray(input.parts) || input.parts.length === 0) {
      throw new BadRequestException("parts are required");
    }

    const uniqueSortedParts = [...input.parts]
      .map((part) => ({
        PartNumber: Math.trunc(Number(part.partNumber)),
        ETag: String(part.etag || "").trim()
      }))
      .filter(
        (part) => Number.isFinite(part.PartNumber) && part.PartNumber > 0 && Boolean(part.ETag)
      )
      .sort((a, b) => a.PartNumber - b.PartNumber);

    if (!uniqueSortedParts.length) {
      throw new BadRequestException("parts are invalid");
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: this.getS3Bucket(),
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: { Parts: uniqueSortedParts }
    });
    const response = await this.getS3Client().send(command);

    return {
      bucket: this.getS3Bucket(),
      key: input.key,
      location: response.Location || null,
      etag: response.ETag || null
    };
  }

  async enqueueRunFromS3Object(input: {
    userId: number;
    key: string;
    direction: string;
    metrics?: string[];
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
  }) {
    await this.ensureS3BucketExists();
    const key = String(input.key || "").trim();
    if (!key) {
      throw new BadRequestException("key is required");
    }
    this.assertOwnedObjectKey(input.userId, key);
    const jobId = randomUUID();
    const created = this.analysisJobRepo.create({
      id: jobId,
      userId: input.userId,
      direction: input.direction,
      status: "queued",
      archiveName: path.basename(key),
      progressPercent: 0,
      stage: "Ожидание",
      errorMessage: null,
      requestPayload: {
        key,
        metrics: input.metrics || [],
        r: Boolean(input.r),
        depth: input.depth ?? null,
        includeGitMetrics: this.resolveIncludeGitMetrics(input.includeGitMetrics)
      },
      resultPayload: null,
      startedAt: null,
      finishedAt: null,
      heartbeatAt: null
    });
    await this.analysisJobRepo.save(created);

    this.queuedJobs.push({
      jobId,
      input: {
        userId: input.userId,
        key,
        direction: input.direction,
        metrics: input.metrics,
        group: input.group,
        student: input.student,
        r: input.r,
        depth: input.depth,
        includeGitMetrics: input.includeGitMetrics
      }
    });
    void this.processQueue();

    return {
      jobId,
      status: "queued" as AnalysisJobStatus,
      createdAt: created.createdAt
    };
  }

  async enqueueRunFromZipPath(input: {
    userId: number;
    zipPath: string;
    direction: string;
    metrics?: string[];
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
  }) {
    const zipPathRaw = String(input.zipPath || "").trim();
    if (!zipPathRaw) {
      throw new BadRequestException("zipPath is required");
    }
    const absoluteZipPath = path.isAbsolute(zipPathRaw)
      ? zipPathRaw
      : path.resolve(this.worksRoot, zipPathRaw);
    await this.ensureFileExists(absoluteZipPath);
    if (!absoluteZipPath.toLowerCase().endsWith(".zip")) {
      throw new BadRequestException("zipPath must point to a .zip file");
    }

    return this.enqueueRunFromZip({
      userId: input.userId,
      archive: {
        originalname: path.basename(absoluteZipPath),
        path: absoluteZipPath
      },
      cleanupArchivePath: false,
      direction: input.direction,
      metrics: input.metrics,
      group: input.group,
      student: input.student,
      r: input.r,
      depth: input.depth,
      includeGitMetrics: input.includeGitMetrics
    });
  }

  async getAnalysisJobStatus(userId: number, jobId: string) {
    const job = await this.analysisJobRepo.findOne({
      where: { id: jobId, userId }
    });
    if (!job) {
      throw new NotFoundException("Задача анализа не найдена");
    }

    const now = Date.now();
    const startedAtMs = job.startedAt ? new Date(job.startedAt).getTime() : null;
    const finishedAtMs = job.finishedAt ? new Date(job.finishedAt).getTime() : null;
    const elapsedSeconds =
      startedAtMs !== null
        ? Math.max(0, Math.floor(((finishedAtMs ?? now) - startedAtMs) / 1000))
        : 0;

    const historicalEstimate = await this.estimateJobDurationSeconds(job);
    const persistedProgress =
      job.progressPercent === null || job.progressPercent === undefined
        ? null
        : Math.max(0, Math.min(100, Math.trunc(job.progressPercent)));

    let estimatedTotalSeconds = historicalEstimate;
    if (
      estimatedTotalSeconds === null &&
      job.status === "running" &&
      persistedProgress !== null &&
      persistedProgress > 0 &&
      persistedProgress < 100 &&
      elapsedSeconds > 0
    ) {
      estimatedTotalSeconds = Math.max(1, Math.round((elapsedSeconds * 100) / persistedProgress));
    }

    const estimatedRemainingSeconds =
      job.status === "success"
        ? 0
        : estimatedTotalSeconds !== null
          ? Math.max(0, estimatedTotalSeconds - elapsedSeconds)
          : null;

    const progressPercent =
      job.status === "success"
        ? 100
        : persistedProgress !== null
          ? persistedProgress
          : job.status === "running" && estimatedTotalSeconds && estimatedTotalSeconds > 0
            ? Math.max(1, Math.min(95, Math.floor((elapsedSeconds / estimatedTotalSeconds) * 100)))
            : null;

    return {
      jobId: job.id,
      status: job.status,
      direction: job.direction,
      archiveName: job.archiveName,
      stage: job.stage,
      errorMessage: job.errorMessage,
      result: job.resultPayload,
      elapsedSeconds,
      estimatedTotalSeconds,
      estimatedRemainingSeconds,
      progressPercent,
      createdAt: job.createdAt,
      heartbeatAt: job.heartbeatAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt
    };
  }

  async getAnalysisJobs(
    userId: number,
    statuses?: AnalysisJobStatus[],
    limit = 100
  ): Promise<
    Array<{
      jobId: string;
      status: AnalysisJobStatus;
      direction: string;
      archiveName: string | null;
      stage: string | null;
      progressPercent: number | null;
      errorMessage: string | null;
      createdAt: Date;
      heartbeatAt: Date | null;
      startedAt: Date | null;
      finishedAt: Date | null;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(200, Math.trunc(Number(limit) || 100)));
    const allowedStatuses: AnalysisJobStatus[] = ["queued", "running", "success", "failed"];
    const effectiveStatuses =
      statuses && statuses.length
        ? statuses.filter((status) => allowedStatuses.includes(status))
        : (["queued", "running"] as AnalysisJobStatus[]);

    const jobs = await this.analysisJobRepo.find({
      where: {
        userId,
        status: In(effectiveStatuses)
      },
      order: { createdAt: "DESC" },
      take: safeLimit
    });

    return jobs.map((job) => ({
      jobId: job.id,
      status: job.status,
      direction: job.direction,
      archiveName: job.archiveName,
      stage: job.stage,
      progressPercent: job.progressPercent,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      heartbeatAt: job.heartbeatAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt
    }));
  }

  resultToCsv(result: AnalysisResponse): string {
    return this.toCsv(result.data, result.metrics);
  }

  async getSavedResults(userId: number, direction: string, pathValue: string) {
    const normalizedDirection = String(direction || "").trim();
    const normalizedPath = this.normalizePath(String(pathValue || "").trim()).replace(/^\/+/, "");
    if (!normalizedDirection) {
      throw new BadRequestException("direction query parameter is required");
    }
    if (!normalizedPath) {
      throw new BadRequestException("path query parameter is required");
    }

    const rows = await this.analysisResultRepo.find({
      where: {
        userId,
        direction: normalizedDirection,
        path: Like(`${normalizedPath}%`)
      },
      order: { createdAt: "DESC", id: "DESC" }
    });
    const gitRows = await this.analysisGitResultRepo.find({
      where: {
        userId,
        direction: normalizedDirection,
        path: Like(`${normalizedPath}%`)
      },
      order: { createdAt: "DESC", id: "DESC" }
    });
    const resolveYearFromGit = this.buildGitYearResolverFromGitRows(gitRows);
    const fallbackRootLabel = this.inferFallbackRootLabel([
      ...rows.map((row) => row.path),
      ...gitRows.map((row) => row.path)
    ]);

    return {
      direction: normalizedDirection,
      path: normalizedPath,
      data: rows.map((row) => ({
        runId: row.runId,
        createdAt: row.createdAt,
        path: this.normalizeResultPath(row.path, fallbackRootLabel),
        group: row.groupValue,
        student: row.studentValue,
        year:
          this.extractYearValue(row.metrics, row.path) || resolveYearFromGit(row.runId, row.path),
        ...row.metrics
      })),
      gitData: gitRows.map((row) => ({
        runId: row.runId,
        createdAt: row.createdAt,
        path: this.normalizeResultPath(row.path, fallbackRootLabel),
        group: row.groupValue,
        student: row.studentValue,
        branch: row.branch,
        hash: row.hash,
        date: row.date,
        message: row.message,
        author: row.author,
        filename: row.filename,
        filetype: row.filetype,
        extraMetadata: row.extraMetadata,
        changes: row.changes,
        added: row.added,
        deleted: row.deleted
      }))
    };
  }

  async getSavedResultsByRunId(userId: number, runId: string) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const rows = await this.analysisResultRepo.find({
      where: { userId, runId: normalizedRunId },
      order: { id: "ASC" }
    });
    const gitRows = await this.analysisGitResultRepo.find({
      where: { userId, runId: normalizedRunId },
      order: { id: "ASC" }
    });
    const resolveYearFromGit = this.buildGitYearResolverFromGitRows(gitRows);
    const fallbackRootLabel = this.inferFallbackRootLabel([
      ...rows.map((row) => row.path),
      ...gitRows.map((row) => row.path)
    ]);

    if (!rows.length && !gitRows.length) {
      throw new NotFoundException("Результаты запуска не найдены");
    }

    const direction = rows[0]?.direction || gitRows[0]?.direction || "";
    const pathValue = this.extractRunPath([
      ...rows.map((row) => row.path),
      ...gitRows.map((row) => row.path)
    ]);

    return {
      runId: normalizedRunId,
      direction,
      path: pathValue,
      data: rows.map((row) => ({
        runId: row.runId,
        createdAt: row.createdAt,
        path: this.normalizeResultPath(row.path, fallbackRootLabel),
        group: row.groupValue,
        student: row.studentValue,
        year:
          this.extractYearValue(row.metrics, row.path) || resolveYearFromGit(row.runId, row.path),
        ...row.metrics
      })),
      gitData: gitRows.map((row) => ({
        runId: row.runId,
        createdAt: row.createdAt,
        path: this.normalizeResultPath(row.path, fallbackRootLabel),
        group: row.groupValue,
        student: row.studentValue,
        branch: row.branch,
        hash: row.hash,
        date: row.date,
        message: row.message,
        author: row.author,
        filename: row.filename,
        filetype: row.filetype,
        extraMetadata: row.extraMetadata,
        changes: row.changes,
        added: row.added,
        deleted: row.deleted
      }))
    };
  }

  async getRunFilterOptions(userId: number, runId: string, input: RunFilterInput) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const sourceRows =
      input.kind === "git"
        ? await this.analysisGitResultRepo.find({
            select: { path: true },
            where: { userId, runId: normalizedRunId },
            order: { id: "ASC" }
          })
        : await this.analysisResultRepo.find({
            select: { path: true },
            where: { userId, runId: normalizedRunId },
            order: { id: "ASC" }
          });

    if (!sourceRows.length) {
      const runExistsInMetrics = await this.analysisResultRepo.exist({
        where: { userId, runId: normalizedRunId }
      });
      const runExistsInGit = await this.analysisGitResultRepo.exist({
        where: { userId, runId: normalizedRunId }
      });
      if (!runExistsInMetrics && !runExistsInGit) {
        throw new NotFoundException("Результаты запуска не найдены");
      }

      const depth = Math.max(1, Math.min(12, Math.trunc(input.depth || 1)));
      return {
        runId: normalizedRunId,
        kind: input.kind,
        depth,
        selectedLevels: this.normalizeSelectedLevels(input.selectedLevels || [], depth),
        levels: [],
        paths: []
      };
    }

    const rawSourcePaths = sourceRows.map((row) => row.path);
    const fallbackCandidates = [...rawSourcePaths];
    if (input.kind === "metrics") {
      const gitPathRows = await this.analysisGitResultRepo.find({
        select: { path: true },
        where: { userId, runId: normalizedRunId },
        order: { id: "ASC" }
      });
      fallbackCandidates.push(...gitPathRows.map((row) => row.path));
    }

    const fallbackRootLabel = this.inferFallbackRootLabel(fallbackCandidates);
    const sourcePaths = rawSourcePaths
      .map((pathValue) => this.normalizeResultPath(pathValue, fallbackRootLabel))
      .filter(Boolean);

    const pathSegments = sourcePaths
      .map((value) =>
        this.normalizePath(String(value || ""))
          .replace(/^\/+|\/+$/g, "")
          .split("/")
          .filter(Boolean)
      )
      .filter((segments) => segments.length > 0);

    const inferredDepth = pathSegments.reduce((acc, segments) => Math.max(acc, segments.length), 1);
    const depth = Math.max(1, Math.min(12, Math.trunc(input.depth || inferredDepth)));

    const selectedLevels = this.normalizeSelectedLevels(input.selectedLevels || [], depth);
    const levels: Array<{ level: number; multi: boolean; options: string[] }> = [];
    for (let level = 0; level < depth; level += 1) {
      const options = Array.from(
        new Set(pathSegments.map((segments) => segments[level]).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      if (!options.length) {
        break;
      }

      levels.push({
        level: level + 1,
        multi: level > 0,
        options
      });
    }

    if ((!selectedLevels[0] || !selectedLevels[0].length) && levels[0]?.options?.length) {
      selectedLevels[0] = [levels[0].options[0]];
    }

    for (let level = 0; level < levels.length; level += 1) {
      const options = levels[level]?.options || [];
      if (!options.length) {
        selectedLevels[level] = [];
        continue;
      }

      const selected = selectedLevels[level] || [];
      selectedLevels[level] = selected.filter((value) => options.includes(value));
    }

    return {
      runId: normalizedRunId,
      kind: input.kind,
      depth,
      selectedLevels,
      levels,
      paths: Array.from(
        new Set(
          sourcePaths
            .map((value) => this.normalizeResultPath(String(value || ""), fallbackRootLabel))
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))
    };
  }

  async getRunView(userId: number, runId: string, input: RunFilterInput) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const rows =
      input.kind === "metrics"
        ? await this.analysisResultRepo.find({
            where: { userId, runId: normalizedRunId },
            order: { id: "ASC" }
          })
        : [];
    const gitRows = await this.analysisGitResultRepo.find({
      where: { userId, runId: normalizedRunId },
      order: { id: "ASC" }
    });

    if (input.kind === "git" && !gitRows.length) {
      const runExistsInMetrics = await this.analysisResultRepo.exist({
        where: { userId, runId: normalizedRunId }
      });
      const runExistsInGit = await this.analysisGitResultRepo.exist({
        where: { userId, runId: normalizedRunId }
      });
      if (!runExistsInMetrics && !runExistsInGit) {
        throw new NotFoundException("Результаты запуска не найдены");
      }

      const depth = Math.max(1, Math.min(12, Math.trunc(input.depth || 1)));
      return {
        runId: normalizedRunId,
        kind: "git",
        depth,
        selectedLevels: this.normalizeSelectedLevels(input.selectedLevels || [], depth),
        rows: []
      };
    }

    if (!rows.length && !gitRows.length) {
      throw new NotFoundException("Результаты запуска не найдены");
    }

    const rawSourcePaths =
      input.kind === "git" ? gitRows.map((row) => row.path) : rows.map((row) => row.path);
    const fallbackRootLabel = this.inferFallbackRootLabel([
      ...rawSourcePaths,
      ...gitRows.map((row) => row.path)
    ]);
    const sourcePaths = rawSourcePaths
      .map((pathValue) => this.normalizeResultPath(pathValue, fallbackRootLabel))
      .filter(Boolean);
    const pathSegments = sourcePaths
      .map((value) =>
        this.normalizeResultPath(String(value || ""), fallbackRootLabel)
          .split("/")
          .filter(Boolean)
      )
      .filter((segments) => segments.length > 0);
    const inferredDepth = pathSegments.reduce((acc, segments) => Math.max(acc, segments.length), 1);
    const depth = Math.max(1, Math.min(12, Math.trunc(input.depth || inferredDepth)));
    const selectedLevels = this.normalizeSelectedLevels(input.selectedLevels || [], depth);

    if (!selectedLevels[0]?.length) {
      const level1 = Array.from(
        new Set(pathSegments.map((segments) => segments[0]).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
      if (level1.length) {
        selectedLevels[0] = [level1[0]];
      }
    }

    const matches = (pathValue: string) => {
      const segments = this.normalizeResultPath(String(pathValue || ""), fallbackRootLabel)
        .split("/")
        .filter(Boolean);
      return selectedLevels.every((values, level) => {
        if (!values.length) {
          return true;
        }
        return values.includes(segments[level] || "");
      });
    };

    const filteredRows = rows.filter((row) => matches(row.path));
    const filteredGitRows = gitRows.filter((row) => matches(row.path));
    const resolveYearFromGit = this.buildGitYearResolverFromGitRows(filteredGitRows);

    if (input.kind === "git") {
      return {
        runId: normalizedRunId,
        kind: "git",
        depth,
        selectedLevels,
        rows: filteredGitRows.map((row) => ({
          runId: row.runId,
          createdAt: row.createdAt,
          path: this.normalizeResultPath(row.path, fallbackRootLabel),
          group: row.groupValue,
          student: row.studentValue,
          branch: row.branch,
          hash: row.hash,
          date: row.date,
          message: row.message,
          author: row.author,
          filename: row.filename,
          filetype: row.filetype,
          extraMetadata: row.extraMetadata,
          changes: row.changes,
          added: row.added,
          deleted: row.deleted
        }))
      };
    }

    const metricSet = new Set<string>();
    for (const row of filteredRows) {
      for (const key of Object.keys(row.metrics || {})) {
        metricSet.add(key);
      }
    }
    const metrics = Array.from(metricSet).sort((a, b) => a.localeCompare(b));

    return {
      runId: normalizedRunId,
      kind: "metrics",
      depth,
      selectedLevels,
      metrics,
      rows: filteredRows.map((row) => ({
        runId: row.runId,
        createdAt: row.createdAt,
        path: this.normalizeResultPath(row.path, fallbackRootLabel),
        group: row.groupValue,
        student: row.studentValue,
        year:
          this.extractYearValue(row.metrics, row.path) || resolveYearFromGit(row.runId, row.path),
        ...row.metrics
      })),
      gitRows: filteredGitRows.map((row) => ({
        runId: row.runId,
        createdAt: row.createdAt,
        path: this.normalizeResultPath(row.path, fallbackRootLabel),
        group: row.groupValue,
        student: row.studentValue,
        branch: row.branch,
        hash: row.hash,
        date: row.date,
        message: row.message,
        author: row.author,
        filename: row.filename,
        filetype: row.filetype,
        extraMetadata: row.extraMetadata,
        changes: row.changes,
        added: row.added,
        deleted: row.deleted
      }))
    };
  }

  async getSavedAnalysisList(userId: number, page: number, size: number) {
    const rows = await this.analysisResultRepo.find({
      where: { userId },
      order: { createdAt: "DESC", id: "DESC" }
    });

    const byRun = new Map<
      string,
      { runId: string; direction: string; createdAt: Date; paths: string[] }
    >();

    for (const row of rows) {
      const existing = byRun.get(row.runId);
      if (!existing) {
        byRun.set(row.runId, {
          runId: row.runId,
          direction: row.direction,
          createdAt: row.createdAt,
          paths: [this.normalizePath(String(row.path || ""))]
        });
        continue;
      }
      existing.paths.push(this.normalizePath(String(row.path || "")));
      if (row.createdAt > existing.createdAt) {
        existing.createdAt = row.createdAt;
      }
    }

    const list = Array.from(byRun.values())
      .map((run) => ({
        runId: run.runId,
        path: this.extractRunPath(run.paths),
        date: run.createdAt.toISOString(),
        direction: run.direction
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const total = list.length;
    const start = (page - 1) * size;
    const data = list.slice(start, start + size);

    return {
      page,
      size,
      total,
      data
    };
  }

  private async withOptionalGitData(
    baseResult: AnalysisResponse,
    dto: RunAnalysisDto
  ): Promise<AnalysisResponse> {
    if (!this.resolveIncludeGitMetrics(dto.includeGitMetrics) || !dto.rootPath) {
      return baseResult;
    }

    try {
      const rootAbsolutePath = this.resolveRootPath(dto.rootPath);
      const gitData = await this.collectGitMetrics(rootAbsolutePath, {
        recursiveMode: true,
        onRepoProgress: dto.onGitProgress
      });
      return {
        ...baseResult,
        gitData
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown git metrics error";
      this.logger.warn(`Git metrics calculation failed: ${message}`);
      return baseResult;
    }
  }

  private async collectGitMetrics(
    rootAbsolutePath: string,
    options?: {
      recursiveMode?: boolean;
      allBranches?: boolean;
      onRepoProgress?: (
        completed: number,
        total: number,
        currentRepoPath: string
      ) => Promise<void> | void;
    }
  ): Promise<GitAnalysisRow[]> {
    const repoPaths = options?.recursiveMode
      ? await this.findGitRepos(rootAbsolutePath)
      : [rootAbsolutePath];
    const rootDisplayLabel = await this.inferRootDisplayLabel(rootAbsolutePath);
    const allRows: GitAnalysisRow[] = [];
    const totalRepos = Math.max(1, repoPaths.length);

    if (!repoPaths.length) {
      await options?.onRepoProgress?.(1, 1, rootAbsolutePath);
      return allRows;
    }

    for (let index = 0; index < repoPaths.length; index += 1) {
      const repoPath = repoPaths[index];
      const relativeRepoPath = this.normalizeResultPath(
        this.normalizePath(path.relative(rootAbsolutePath, repoPath) || "."),
        rootDisplayLabel
      );
      const parsed = this.pathParserService.parse(relativeRepoPath);
      const repoRows = await this.processGitRepo(repoPath, relativeRepoPath, parsed, {
        allBranches: Boolean(options?.allBranches)
      });
      allRows.push(...repoRows);
      await options?.onRepoProgress?.(index + 1, totalRepos, relativeRepoPath);
    }

    return allRows;
  }

  private async findGitRepos(rootPath: string): Promise<string[]> {
    const repos: string[] = [];

    const walk = async (currentPath: string): Promise<void> => {
      let entries: Array<{ name: string; isDirectory: () => boolean }>;
      try {
        entries = (await fs.readdir(currentPath, {
          withFileTypes: true
        })) as Array<{ name: string; isDirectory: () => boolean }>;
      } catch {
        return;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        if (entry.name === ".git") {
          try {
            await this.runGit(["rev-parse", "--is-inside-work-tree"], currentPath);
            repos.push(currentPath);
          } catch {
            // Not a valid repository.
          }
          return;
        }

        if (entry.name.startsWith(".") && entry.name !== ".git") {
          continue;
        }
        if (this.ignoredDirNames.has(entry.name)) {
          continue;
        }

        await walk(path.join(currentPath, entry.name));
      }
    };

    await walk(rootPath);
    repos.sort((a, b) => a.localeCompare(b));
    return repos;
  }

  private async processGitRepo(
    repoPath: string,
    relativeRepoPath: string,
    parsedRepoPath: { group: string | null; student: string | null },
    options: { allBranches: boolean }
  ): Promise<GitAnalysisRow[]> {
    const rows: GitAnalysisRow[] = [];

    const branchOutput = await this.runGit(["branch", "--format=%(refname:short)"], repoPath);
    const allBranches = branchOutput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!allBranches.length) {
      return rows;
    }

    const currentBranch = (await this.runGit(["branch", "--show-current"], repoPath)).trim();
    const branchesToProcess = options.allBranches || !currentBranch ? allBranches : [currentBranch];

    for (const branch of branchesToProcess) {
      const gitLogRaw = await this.runGit(
        [
          "log",
          branch,
          "--numstat",
          "--date=iso-strict",
          "--format=%H%x1f%an%x1f%aI%x1f%s%x1f%P%x1e"
        ],
        repoPath
      );
      const commitBlocks = gitLogRaw
        .split("\x1e")
        .map((chunk) => chunk.trim())
        .filter(Boolean);

      for (const block of commitBlocks) {
        const lines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (!lines.length) {
          continue;
        }

        const header = lines[0] || "";
        const [fullHash, author, isoDate, message, parentField] = header.split("\x1f");
        if (!fullHash) {
          continue;
        }
        const shortHash = fullHash.slice(0, 8);
        const parentHash = this.getFirstParent(parentField || "");

        for (let i = 1; i < lines.length; i += 1) {
          const line = lines[i];
          const match = line.match(/^(\d+|-)\s+(\d+|-)\s+(.+)$/);
          if (!match) {
            continue;
          }

          const added = match[1];
          const deleted = match[2];
          const filename = match[3];
          const binary = this.isBinaryGitFile(added, deleted, filename);

          let addedValue = 0;
          let deletedValue = 0;
          let changes = "";

          if (binary) {
            addedValue = await this.getBlobSize(repoPath, fullHash, filename);
            if (parentHash) {
              deletedValue = await this.getBlobSize(repoPath, parentHash, filename);
            }
            changes = String(addedValue - deletedValue);
          } else {
            addedValue = added === "-" ? 0 : Number(added);
            deletedValue = deleted === "-" ? 0 : Number(deleted);
            changes = `${addedValue}/${deletedValue}`;
          }

          const extraMetadata = this.getGitFileMetadata(parentHash, filename);

          rows.push({
            path: relativeRepoPath,
            group: parsedRepoPath.group,
            student: parsedRepoPath.student,
            branch,
            hash: shortHash,
            date: isoDate || new Date().toISOString(),
            message: (message || "").replace(/\n/g, " "),
            author: author || "",
            filename,
            filetype: binary ? "binary" : "text",
            extraMetadata,
            changes,
            added: addedValue,
            deleted: deletedValue
          });
        }
      }
    }

    return rows;
  }

  private getFirstParent(parentField: string): string | null {
    const value = String(parentField || "").trim();
    if (!value) {
      return null;
    }
    return value.split(" ")[0] || null;
  }

  private isBinaryGitFile(added: string, deleted: string, filePath: string): boolean {
    if (added === "-" && deleted === "-") {
      return true;
    }

    const extension = path.extname(filePath).toLowerCase();
    return this.gitBinaryExtensions.has(extension);
  }

  private async getBlobSize(
    repoPath: string,
    commitHash: string,
    filePath: string
  ): Promise<number> {
    try {
      const sizeRaw = await this.runGit(["cat-file", "-s", `${commitHash}:${filePath}`], repoPath);
      const parsed = Number(sizeRaw.trim());
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private getGitFileMetadata(parentHash: string | null, filePath: string): string {
    if (!parentHash) {
      return "added";
    }
    const normalizedPath = String(filePath || "").toLowerCase();
    if (normalizedPath.includes("=>")) {
      return "rename";
    }
    return "modified";
  }

  private async runGit(args: string[], repoPath: string): Promise<string> {
    const { stdout } = await this.runExecFile("git", ["-C", repoPath, ...args], {
      maxBuffer: 64 * 1024 * 1024
    });
    return String(stdout || "").trimEnd();
  }

  private async runFromCsv(
    dto: RunAnalysisDto,
    selectedMetrics: string[]
  ): Promise<AnalysisResponse> {
    const csvAbsolutePath = this.resolveCsvPath(dto.csvFile);
    await this.ensureFileExists(csvAbsolutePath);
    const escapedCsvPath = csvAbsolutePath.replace(/'/g, "''");

    const whereClauses: string[] = [];
    if (dto.group) {
      whereClauses.push(`split_part(path, '/', 1) = '${dto.group.replace(/'/g, "''")}'`);
    }
    if (dto.student) {
      whereClauses.push(`split_part(path, '/', 2) = '${dto.student.replace(/'/g, "''")}'`);
    }

    const query = `
      SELECT path
      FROM read_csv_auto('${escapedCsvPath}', header = true)
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      ORDER BY path;
    `;

    const rows = await this.duckdbService.all<{ path: string }>(query);
    const data: AnalysisRow[] = [];

    for (const row of rows) {
      const parsed = this.pathParserService.parse(row.path);
      const absoluteSubmissionPath = path.resolve(this.csvRoot, parsed.path);

      const metricValues = await this.safeComputeMetrics(
        dto.direction,
        selectedMetrics,
        absoluteSubmissionPath,
        parsed.path
      );

      data.push({
        path: parsed.path,
        group: parsed.group,
        student: parsed.student,
        ...metricValues
      });
    }

    return {
      direction: dto.direction,
      metrics: selectedMetrics,
      data
    };
  }

  private async runFromFolderFull(
    dto: RunAnalysisDto,
    selectedMetrics: string[]
  ): Promise<AnalysisResponse> {
    const rootAbsolutePath = this.resolveRootPath(dto.rootPath as string);
    const rootDisplayLabel = await this.inferRootDisplayLabel(rootAbsolutePath);
    await this.ensureDirectoryExists(rootAbsolutePath);

    const aggregates = await this.fullAnalyzer.analyzeRoot(rootAbsolutePath, {
      recursiveMode: Boolean(dto.r),
      depth: dto.depth,
      metrics: selectedMetrics,
      onWorkProgress: dto.onAnalyzeProgress
    });

    const data: AnalysisRow[] = [];
    for (const row of aggregates) {
      const normalizedPath = this.normalizeResultPath(String(row.path || ""), rootDisplayLabel);
      const parsed = this.pathParserService.parse(normalizedPath);

      if (dto.group && parsed.group !== dto.group) {
        continue;
      }
      if (dto.student && parsed.student !== dto.student) {
        continue;
      }

      const filteredMetrics: Record<string, string | number | null> = {};
      for (const metric of selectedMetrics) {
        const raw = row[metric];
        filteredMetrics[metric] =
          typeof raw === "boolean" ? (raw ? 1 : 0) : (raw as string | number | null);
      }

      data.push({
        path: normalizedPath,
        group: parsed.group,
        student: parsed.student,
        ...filteredMetrics
      });
    }

    return {
      direction: dto.direction,
      metrics: selectedMetrics,
      data
    };
  }

  private async runFromFolderBasic(
    dto: RunAnalysisDto,
    selectedMetrics: string[]
  ): Promise<AnalysisResponse> {
    const rootAbsolutePath = this.resolveRootPath(dto.rootPath as string);
    await this.ensureDirectoryExists(rootAbsolutePath);

    const workDirs = await this.collectWorkDirs(rootAbsolutePath, Boolean(dto.r));
    const data: AnalysisRow[] = [];

    for (const workDir of workDirs) {
      const htmlFiles = await this.collectFilesByExtension(workDir, [".html", ".htm"], dto.depth);

      for (const absoluteHtmlPath of htmlFiles) {
        const relativePath = this.normalizePath(path.relative(rootAbsolutePath, absoluteHtmlPath));
        if (!relativePath || relativePath.startsWith("..")) {
          continue;
        }

        const parsed = this.pathParserService.parse(relativePath);
        if (dto.group && parsed.group !== dto.group) {
          continue;
        }
        if (dto.student && parsed.student !== dto.student) {
          continue;
        }

        const metricValues = await this.safeComputeMetrics(
          dto.direction,
          selectedMetrics,
          absoluteHtmlPath,
          relativePath
        );

        data.push({
          path: relativePath,
          group: parsed.group,
          student: parsed.student,
          ...metricValues
        });
      }
    }

    return {
      direction: dto.direction,
      metrics: selectedMetrics,
      data
    };
  }

  private async safeComputeMetrics(
    direction: string,
    metrics: string[],
    absolutePath: string,
    relativePath: string
  ) {
    try {
      await this.ensureFileExists(absolutePath);
      return await this.metricsService.compute(
        direction,
        {
          absolutePath,
          relativePath
        },
        metrics
      );
    } catch {
      const empty: Record<string, null> = {};
      for (const metric of metrics) {
        empty[metric] = null;
      }
      return empty;
    }
  }

  private resolveCsvPath(csvFile?: string): string {
    const relative = csvFile || "submissions.csv";
    if (path.isAbsolute(relative)) {
      return relative;
    }
    return path.resolve(this.csvRoot, relative);
  }

  private resolveRootPath(rootPath: string): string {
    if (path.isAbsolute(rootPath)) {
      return rootPath;
    }
    return path.resolve(this.worksRoot, rootPath);
  }

  private async ensureFileExists(filePath: string) {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        throw new BadRequestException(`Not a file: ${filePath}`);
      }
    } catch {
      throw new BadRequestException(`File does not exist: ${filePath}`);
    }
  }

  private async ensureDirectoryExists(directoryPath: string) {
    try {
      const stat = await fs.stat(directoryPath);
      if (!stat.isDirectory()) {
        throw new BadRequestException(`Not a directory: ${directoryPath}`);
      }
    } catch {
      throw new BadRequestException(`Directory does not exist: ${directoryPath}`);
    }
  }

  private async collectWorkDirs(
    rootAbsolutePath: string,
    recursiveMode: boolean
  ): Promise<string[]> {
    if (!recursiveMode) {
      return [rootAbsolutePath];
    }

    const entries = await fs.readdir(rootAbsolutePath, { withFileTypes: true });
    const dirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => !this.ignoredDirNames.has(entry.name))
      .map((entry) => path.join(rootAbsolutePath, entry.name));

    const result: string[] = [];
    for (const dir of dirs) {
      if (await this.hasHtmlOrCssFiles(dir)) {
        result.push(dir);
      }
    }

    return result;
  }

  private async hasHtmlOrCssFiles(directoryPath: string): Promise<boolean> {
    const files = await this.collectFilesByExtension(directoryPath, [".html", ".htm", ".css"]);
    return files.length > 0;
  }

  private async collectFilesByExtension(
    rootDir: string,
    extensions: string[],
    maxDepth?: number
  ): Promise<string[]> {
    const extensionSet = new Set(extensions.map((ext) => ext.toLowerCase()));
    const files: string[] = [];

    const walk = async (currentDir: string, dirDepth: number) => {
      let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
      try {
        entries = (await fs.readdir(currentDir, {
          withFileTypes: true,
          encoding: "utf8"
        })) as Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) {
          continue;
        }
        if (entry.isDirectory() && this.ignoredDirNames.has(entry.name)) {
          continue;
        }

        const absolutePath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          const childDepth = dirDepth + 1;
          if (maxDepth === undefined || childDepth < maxDepth) {
            await walk(absolutePath, childDepth);
          }
          continue;
        }

        if (!entry.isFile()) {
          continue;
        }

        const fileDepth = dirDepth + 1;
        if (maxDepth !== undefined && fileDepth > maxDepth) {
          continue;
        }

        const extension = path.extname(entry.name).toLowerCase();
        if (extensionSet.has(extension)) {
          files.push(absolutePath);
        }
      }
    };

    await walk(rootDir, 0);
    files.sort((a, b) => a.localeCompare(b));
    return files;
  }

  private toCsv(data: AnalysisRow[], metrics: string[]): string {
    const headers = ["path", ...metrics];
    const rows = [headers.join(";")];

    for (const row of data) {
      const values = [
        this.escapeCsvValue(row.path),
        ...metrics.map((metric) => this.escapeCsvValue(row[metric]))
      ];
      rows.push(values.join(";"));
    }

    return `${rows.join("\n")}\n`;
  }

  private escapeCsvValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return "";
    }

    const text = String(value);
    if (/[;"\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  private normalizePath(value: string): string {
    return value.replace(/\\/g, "/");
  }

  private normalizeResultPath(pathValue: string, fallbackRootLabel?: string): string {
    const normalized = this.normalizePath(String(pathValue || "")).replace(/^\/+|\/+$/g, "");
    if (!normalized || normalized === ".") {
      if (!fallbackRootLabel) {
        return "";
      }
      return this.normalizePath(String(fallbackRootLabel || ""))
        .replace(/^\/+|\/+$/g, "")
        .trim();
    }
    return normalized;
  }

  private inferFallbackRootLabel(paths: string[]): string {
    const candidates = paths
      .map((pathValue) => this.normalizePath(String(pathValue || "")).replace(/^\/+|\/+$/g, ""))
      .filter((pathValue) => Boolean(pathValue) && pathValue !== ".");

    if (!candidates.length) {
      return "";
    }

    const withSegments = candidates.find((pathValue) => pathValue.includes("/"));
    if (withSegments) {
      return withSegments.split("/").filter(Boolean)[0] || "";
    }

    return candidates[0] || "";
  }

  private async inferRootDisplayLabel(rootAbsolutePath: string): Promise<string> {
    const fallback = path.basename(path.resolve(rootAbsolutePath));
    try {
      const entries = await fs.readdir(rootAbsolutePath, { withFileTypes: true });
      const dirs = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith("."))
        .filter((entry) => !this.ignoredDirNames.has(entry.name))
        .map((entry) => entry.name.trim())
        .filter(Boolean);

      if (dirs.length === 1) {
        return dirs[0] || fallback;
      }
    } catch {
      // Ignore and fallback to basename.
    }

    return fallback;
  }

  private resolveIncludeGitMetrics(value: boolean | undefined): boolean {
    return value !== false;
  }

  private parseYearValue(value: unknown): string | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      const year = Math.trunc(value);
      if (year >= 1900 && year <= 2100) {
        return String(year);
      }
    }

    if (typeof value === "string") {
      const match = value.match(/\b(19|20)\d{2}\b/);
      if (match) {
        return match[0] || null;
      }
    }

    return null;
  }

  private extractYearValue(
    metrics: Record<string, string | number | null>,
    pathValue: string
  ): string | null {
    const directYear = this.parseYearValue(metrics.year);
    if (directYear) {
      return directYear;
    }
    const directYearRu = this.parseYearValue((metrics as Record<string, unknown>)["год"]);
    if (directYearRu) {
      return directYearRu;
    }

    for (const [key, value] of Object.entries(metrics)) {
      if (!/year|год/i.test(key)) {
        continue;
      }
      const parsed = this.parseYearValue(value);
      if (parsed) {
        return parsed;
      }
    }

    const fromPath = this.parseYearValue(pathValue);
    return fromPath || null;
  }

  private parseYearFromDate(value: unknown): string | null {
    if (typeof value === "string") {
      const fromText = this.parseYearValue(value);
      if (fromText) {
        return fromText;
      }
      const parsedDate = new Date(value);
      if (!Number.isNaN(parsedDate.getTime())) {
        return String(parsedDate.getUTCFullYear());
      }
      return null;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return String(value.getUTCFullYear());
    }

    return this.parseYearValue(value);
  }

  private normalizeSelectedLevels(selectedLevels: string[][], depth: number): string[][] {
    const result: string[][] = [];
    for (let level = 0; level < depth; level += 1) {
      const rawValues = Array.isArray(selectedLevels[level]) ? selectedLevels[level] : [];
      const normalized = Array.from(
        new Set(
          rawValues
            .map((value) =>
              this.normalizePath(String(value || ""))
                .replace(/^\/+|\/+$/g, "")
                .trim()
            )
            .filter(Boolean)
        )
      );
      result[level] = normalized;
    }
    return result;
  }

  private buildGitYearResolverFromGitRows(
    gitRows: Array<{ runId?: string | null; path: string; date: string }>
  ): (runId: string | null | undefined, pathValue: string) => string | null {
    const yearCounts = new Map<string, Map<string, number>>();

    const toKey = (runId: string | null | undefined, pathValue: string) =>
      `${String(runId || "")}|${this.normalizePath(String(pathValue || "")).replace(/^\/+|\/+$/g, "")}`;

    const addCount = (key: string, year: string) => {
      const byYear = yearCounts.get(key) || new Map<string, number>();
      byYear.set(year, (byYear.get(year) || 0) + 1);
      yearCounts.set(key, byYear);
    };

    for (const row of gitRows) {
      const year = this.parseYearFromDate(row.date);
      if (!year) {
        continue;
      }

      const normalizedPath = this.normalizePath(String(row.path || "")).replace(/^\/+|\/+$/g, "");
      if (!normalizedPath) {
        continue;
      }

      const key = toKey(row.runId, normalizedPath);
      addCount(key, year);
    }

    const pickMostFrequent = (byYear: Map<string, number>): string | null => {
      let bestYear: string | null = null;
      let bestCount = -1;
      for (const [year, count] of byYear.entries()) {
        if (count > bestCount) {
          bestYear = year;
          bestCount = count;
        }
      }
      return bestYear;
    };

    return (runId: string | null | undefined, pathValue: string): string | null => {
      const normalizedPath = this.normalizePath(String(pathValue || "")).replace(/^\/+|\/+$/g, "");
      if (!normalizedPath) {
        return null;
      }

      const direct = yearCounts.get(toKey(runId, normalizedPath));
      if (direct) {
        return pickMostFrequent(direct);
      }

      const segments = normalizedPath.split("/").filter(Boolean);
      for (let end = segments.length - 1; end >= 1; end -= 1) {
        const candidatePath = segments.slice(0, end).join("/");
        const candidate = yearCounts.get(toKey(runId, candidatePath));
        if (candidate) {
          return pickMostFrequent(candidate);
        }
      }

      return null;
    };
  }

  private extractRunPath(paths: string[]): string {
    if (!paths.length) {
      return "";
    }

    const normalized = paths
      .map((value) => this.normalizePath(value).replace(/^\/+/, "").trim())
      .filter((value) => Boolean(value) && value !== ".");

    if (!normalized.length) {
      return "";
    }

    const splitPaths = normalized.map((value) => value.split("/").filter(Boolean));
    let prefix = splitPaths[0] || [];

    for (let i = 1; i < splitPaths.length; i += 1) {
      const next = splitPaths[i];
      let j = 0;
      while (j < prefix.length && j < next.length && prefix[j] === next[j]) {
        j += 1;
      }
      prefix = prefix.slice(0, j);
      if (prefix.length === 0) {
        break;
      }
    }

    if (prefix.length > 0) {
      return prefix.join("/");
    }

    return splitPaths[0]?.[0] || normalized[0];
  }

  private sanitizeRelativePath(rawPath: string, index: number): string {
    const normalized = this.normalizePath(String(rawPath || "")).replace(/^([A-Za-z]:)?\/+/, "");
    const parts = normalized
      .split("/")
      .map((part) => part.trim())
      .map((part) => part.replace(/[\u0000-\u001F\u007F]/g, ""))
      .map((part) => part.replace(/[<>:"|?*]/g, "_"))
      .map((part) => part.replace(/[^\x20-\x7E]/g, "_"))
      .map((part) => part.replace(/\s+/g, " "))
      .map((part) => part.replace(/\.+$/g, ""))
      .filter((part) => Boolean(part) && part !== "." && part !== "..");

    if (parts.length === 0) {
      return `file_${index}.html`;
    }
    return parts.join("/");
  }

  private async extractZipToDir(
    zipPath: string,
    outputRoot: string,
    onProgress?: (progressPercent: number) => Promise<void> | void
  ): Promise<number> {
    try {
      const zipStat = await fs.stat(zipPath);
      const zipSize = Math.max(1, zipStat.size);
      const sourceStream = createReadStream(zipPath);
      const zipStream = sourceStream.pipe(unzipper.Parse({ forceStream: true }));
      let extractedFiles = 0;
      let lastReported = 0;

      for await (const entry of zipStream) {
        const isDirectory = entry.type === "Directory";
        if (isDirectory) {
          entry.autodrain();
          continue;
        }

        const relativePath = this.sanitizeRelativePath(String(entry.path || ""), extractedFiles);
        const absolutePath = path.resolve(outputRoot, relativePath);
        const normalizedRoot = `${path.resolve(outputRoot)}${path.sep}`;
        if (!absolutePath.startsWith(normalizedRoot)) {
          entry.autodrain();
          continue;
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await pipeline(entry, createWriteStream(absolutePath));
        extractedFiles += 1;

        if (onProgress) {
          const ratio = Math.max(0, Math.min(1, sourceStream.bytesRead / zipSize));
          const percent = Math.floor(ratio * 100);
          if (percent >= lastReported + 2 || percent === 100) {
            lastReported = percent;
            await onProgress(percent);
          }
        }
      }

      return extractedFiles;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (
        message.includes("unexpected end of file") ||
        message.includes("invalid") ||
        message.includes("corrupt")
      ) {
        throw new BadRequestException(
          "ZIP-архив поврежден или загружен не полностью. Пересоздайте архив и повторите попытку."
        );
      }
      throw error;
    }
  }

  private async saveResultsForUser(
    userId: number,
    result: AnalysisResponse,
    cacheKey: string | null
  ): Promise<string | null> {
    if (!result.data?.length && !result.gitData?.length) {
      return null;
    }
    const runId = randomUUID();
    if (result.data?.length) {
      const entities = result.data.map((row) => {
        const metrics: Record<string, string | number | null> = {};
        for (const metric of result.metrics) {
          const value = row[metric];
          metrics[metric] = value === undefined ? null : (value as string | number | null);
        }
        return this.analysisResultRepo.create({
          userId,
          runId,
          direction: result.direction,
          path: this.normalizePath(String(row.path || "")),
          cacheKey,
          groupValue: row.group ?? null,
          studentValue: row.student ?? null,
          metrics
        });
      });
      await this.analysisResultRepo.save(entities);
    }

    if (result.gitData?.length) {
      const gitEntities = result.gitData.map((row) =>
        this.analysisGitResultRepo.create({
          userId,
          runId,
          direction: result.direction,
          path: this.normalizePath(String(row.path || "")),
          groupValue: row.group ?? null,
          studentValue: row.student ?? null,
          branch: row.branch,
          hash: row.hash,
          date: row.date,
          message: row.message,
          author: row.author,
          filename: row.filename,
          filetype: row.filetype,
          extraMetadata: row.extraMetadata,
          changes: row.changes,
          added: row.added,
          deleted: row.deleted
        })
      );
      await this.analysisGitResultRepo.save(gitEntities);
    }

    return runId;
  }

  private resolveSelectedMetrics(direction: string, requestedMetrics?: string[]): string[] {
    if (!this.metricsService.getSupportedDirections().includes(direction)) {
      throw new BadRequestException(`Unsupported direction: ${direction}`);
    }

    const basicMetrics = this.metricsService.getSupportedMetrics(direction);
    if (direction !== "html_css") {
      const selected = requestedMetrics?.length ? requestedMetrics : basicMetrics;
      const invalid = selected.filter((metric) => !basicMetrics.includes(metric));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Unsupported metrics for ${direction}: ${invalid.join(", ")}`
        );
      }
      return selected;
    }

    const fullMetrics = this.fullAnalyzer.supportedMetrics;
    const selected = requestedMetrics?.length
      ? requestedMetrics
      : this.getDefaultFullMetrics(fullMetrics);
    const allowed = new Set([...basicMetrics, ...fullMetrics]);
    const invalid = selected.filter((metric) => !allowed.has(metric));
    if (invalid.length > 0) {
      throw new BadRequestException(`Unsupported metrics for ${direction}: ${invalid.join(", ")}`);
    }
    return selected;
  }

  private async buildZipCacheKey(
    input: ZipAnalysisInput,
    archivePath: string,
    selectedMetrics: string[]
  ): Promise<string> {
    const stats = await fs.stat(archivePath);
    const metricsPart = [...selectedMetrics].sort().join(",");
    const requestPart = [
      `direction=${input.direction}`,
      `metrics=${metricsPart}`,
      `group=${input.group || ""}`,
      `student=${input.student || ""}`,
      `r=${input.r ? "1" : "0"}`,
      `depth=${input.depth ?? ""}`,
      `includeGitMetrics=${this.resolveIncludeGitMetrics(input.includeGitMetrics) ? "1" : "0"}`
    ].join("|");

    if (input.sourceFingerprint) {
      return `${input.sourceFingerprint}|${requestPart}`;
    }

    if (input.cleanupArchivePath === false) {
      const absolute = path.resolve(archivePath);
      return `path|${absolute}|size=${stats.size}|mtime=${stats.mtimeMs}|${requestPart}`;
    }

    const name = String(input.archive.originalname || "")
      .trim()
      .toLowerCase();
    const size = Number.isFinite(input.archive.size as number)
      ? Number(input.archive.size)
      : stats.size;
    return `upload|name=${name}|size=${size}|${requestPart}`;
  }

  private async getCachedResultByKey(
    userId: number,
    direction: string,
    selectedMetrics: string[],
    cacheKey: string
  ): Promise<AnalysisResponse | null> {
    const latest = await this.analysisResultRepo.findOne({
      where: {
        userId,
        direction,
        cacheKey
      },
      order: { createdAt: "DESC", id: "DESC" }
    });

    if (!latest?.runId) {
      return null;
    }

    const rows = await this.analysisResultRepo.find({
      where: {
        userId,
        direction,
        runId: latest.runId
      },
      order: { id: "ASC" }
    });

    const gitRows = await this.analysisGitResultRepo.find({
      where: {
        userId,
        direction,
        runId: latest.runId
      },
      order: { id: "ASC" }
    });
    const resolveYearFromGit = this.buildGitYearResolverFromGitRows(gitRows);

    if (!rows.length && !gitRows.length) {
      return null;
    }

    return {
      direction,
      metrics: selectedMetrics,
      runId: latest.runId,
      data: rows.map((row) => ({
        path: row.path,
        group: row.groupValue,
        student: row.studentValue,
        year:
          this.extractYearValue(row.metrics, row.path) || resolveYearFromGit(row.runId, row.path),
        ...row.metrics
      })),
      gitData: gitRows.map((row) => ({
        path: row.path,
        group: row.groupValue,
        student: row.studentValue,
        branch: row.branch,
        hash: row.hash,
        date: row.date,
        message: row.message,
        author: row.author,
        filename: row.filename,
        filetype: row.filetype,
        extraMetadata: row.extraMetadata,
        changes: row.changes,
        added: row.added,
        deleted: row.deleted
      }))
    };
  }

  private async processQueue(): Promise<void> {
    while (this.runningJobs < this.asyncConcurrency && this.queuedJobs.length > 0) {
      const next = this.queuedJobs.shift();
      if (!next) {
        return;
      }
      this.runningJobs += 1;
      void this.runQueuedJob(next).finally(() => {
        this.runningJobs -= 1;
        void this.processQueue();
      });
    }
  }

  private async recoverStaleJobsAfterRestart(): Promise<void> {
    const staleStatuses: AnalysisJobStatus[] = ["queued", "running"];
    const staleJobs = await this.analysisJobRepo.find({
      where: {
        status: In(staleStatuses)
      },
      order: { createdAt: "ASC" }
    });

    if (!staleJobs.length) {
      return;
    }

    const now = new Date();
    for (const job of staleJobs) {
      job.status = "failed";
      job.stage = "Ошибка";
      job.errorMessage = "Задача прервана из-за перезапуска сервиса. Запустите анализ повторно.";
      job.finishedAt = now;
      job.heartbeatAt = now;
      job.progressPercent = job.progressPercent ?? 0;
      await this.analysisJobRepo.save(job);
    }

    await this.analysisUploadRepo
      .createQueryBuilder()
      .update(AnalysisUpload)
      .set({ status: "failed", consumedAt: now })
      .where("status = :status", { status: "processing" })
      .execute();

    this.logger.warn(`Помечено как failed после рестарта: ${staleJobs.length} задач`);
  }

  private async runQueuedJob(job: QueuedJob): Promise<void> {
    const entity = await this.analysisJobRepo.findOne({ where: { id: job.jobId } });
    if (!entity) {
      return;
    }

    entity.status = "running";
    entity.startedAt = new Date();
    entity.heartbeatAt = new Date();
    entity.progressPercent = 1;
    entity.stage = "Запуск";
    entity.errorMessage = null;
    await this.analysisJobRepo.save(entity);

    const heartbeatTimer = setInterval(() => {
      void this.analysisJobRepo.update({ id: entity.id }, { heartbeatAt: new Date() });
    }, 10_000);

    let lastProgressWriteMs = 0;
    const writeProgress = async (stage: string, progressPercent: number) => {
      const normalizedPercent = Math.max(1, Math.min(99, Math.trunc(progressPercent)));
      const nowMs = Date.now();
      if (
        entity.stage === stage &&
        entity.progressPercent === normalizedPercent &&
        nowMs - lastProgressWriteMs < 1000
      ) {
        return;
      }
      entity.stage = stage;
      entity.progressPercent = normalizedPercent;
      entity.heartbeatAt = new Date();
      lastProgressWriteMs = nowMs;
      await this.analysisJobRepo.save(entity);
    };

    try {
      let result: AnalysisResponse;

      if ("archive" in job.input) {
        result = await this.runFromZip({
          ...job.input,
          onProgress: writeProgress
        });
      } else {
        await writeProgress("Подготовка данных", 2);
        const head = await this.getS3Client().send(
          new HeadObjectCommand({
            Bucket: this.getS3Bucket(),
            Key: job.input.key
          })
        );
        const objectSize = Number(head.ContentLength || 0);
        const objectEtag = String(head.ETag || "").replaceAll('"', "");
        const tempZipPath = path.join(os.tmpdir(), `analysis-s3-${randomUUID()}.zip`);

        await writeProgress("Получаем архив для проверки", 4);
        await this.downloadS3ObjectToFile(
          job.input.key,
          tempZipPath,
          objectSize,
          async (downloadPercent) => {
            const mappedProgress =
              4 + Math.floor((Math.max(0, Math.min(100, downloadPercent)) * 21) / 100);
            await writeProgress("Получаем архив для проверки", mappedProgress);
          }
        );

        result = await this.runFromZip({
          userId: job.input.userId,
          archive: {
            originalname: path.basename(job.input.key),
            path: tempZipPath,
            size: objectSize
          },
          cleanupArchivePath: true,
          sourceFingerprint: `s3|bucket=${this.getS3Bucket()}|key=${job.input.key}|etag=${objectEtag}|size=${objectSize}`,
          direction: job.input.direction,
          metrics: job.input.metrics,
          group: job.input.group,
          student: job.input.student,
          r: job.input.r,
          depth: job.input.depth,
          includeGitMetrics: job.input.includeGitMetrics,
          onProgress: writeProgress
        });
      }

      entity.status = "success";
      entity.finishedAt = new Date();
      entity.heartbeatAt = entity.finishedAt;
      entity.progressPercent = 100;
      entity.stage = "Готово";
      entity.resultPayload = {
        direction: result.direction,
        metrics: result.metrics,
        rowsTotal: result.data.length,
        gitRowsTotal: result.gitData?.length || 0,
        runId: result.runId || null
      };
      await this.analysisJobRepo.save(entity);
      if ("onSuccess" in job && job.onSuccess) {
        await job.onSuccess();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      entity.status = "failed";
      entity.finishedAt = new Date();
      entity.heartbeatAt = entity.finishedAt;
      entity.stage = "Ошибка";
      entity.errorMessage = message;
      entity.resultPayload = null;
      await this.analysisJobRepo.save(entity);
      if ("onError" in job && job.onError) {
        await job.onError(message);
      }
    } finally {
      clearInterval(heartbeatTimer);
    }
  }

  private async estimateJobDurationSeconds(job: AnalysisJob): Promise<number | null> {
    if (job.status === "success" && job.startedAt && job.finishedAt) {
      return Math.max(
        1,
        Math.floor((new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
      );
    }

    const signature = this.getJobSignature(job.direction, job.requestPayload);
    const candidates = await this.analysisJobRepo.find({
      where: {
        direction: job.direction,
        status: "success"
      },
      order: { finishedAt: "DESC" },
      take: 50
    });

    const durations: number[] = [];
    for (const item of candidates) {
      if (!item.startedAt || !item.finishedAt) {
        continue;
      }
      if (this.getJobSignature(item.direction, item.requestPayload) !== signature) {
        continue;
      }
      const seconds = Math.floor(
        (new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) / 1000
      );
      if (seconds > 0) {
        durations.push(seconds);
      }
      if (durations.length >= 10) {
        break;
      }
    }

    if (!durations.length) {
      return null;
    }
    const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return Math.max(1, Math.round(avg));
  }

  private getJobSignature(
    direction: string,
    requestPayload: Record<string, unknown> | null
  ): string {
    const metrics = Array.isArray(requestPayload?.metrics)
      ? [...(requestPayload.metrics as unknown[])]
          .map((item) => String(item))
          .sort()
          .join(",")
      : "";
    const recursive = requestPayload?.r ? "1" : "0";
    const depth =
      requestPayload?.depth === null || requestPayload?.depth === undefined
        ? ""
        : String(requestPayload.depth);
    const includeGitMetrics = requestPayload?.includeGitMetrics === false ? "0" : "1";

    return `${direction}|metrics=${metrics}|r=${recursive}|depth=${depth}|git=${includeGitMetrics}`;
  }

  private getS3Bucket(): string {
    const bucket = this.s3Bucket.trim();
    if (!bucket) {
      throw new BadRequestException("S3_BUCKET is not configured");
    }
    return bucket;
  }

  private getS3Client(): S3Client {
    if (this.s3Client) {
      return this.s3Client;
    }
    if (!this.s3AccessKeyId || !this.s3SecretAccessKey) {
      throw new BadRequestException("S3 credentials are not configured");
    }

    this.s3Client = new S3Client({
      region: this.s3Region || "us-east-1",
      endpoint: this.s3Endpoint || undefined,
      forcePathStyle: this.s3ForcePathStyle,
      credentials: {
        accessKeyId: this.s3AccessKeyId,
        secretAccessKey: this.s3SecretAccessKey
      }
    });
    return this.s3Client;
  }

  private getS3PresignClient(): S3Client {
    if (this.s3PresignClient) {
      return this.s3PresignClient;
    }
    if (!this.s3AccessKeyId || !this.s3SecretAccessKey) {
      throw new BadRequestException("S3 credentials are not configured");
    }

    this.s3PresignClient = new S3Client({
      region: this.s3Region || "us-east-1",
      endpoint: this.s3PublicEndpoint || this.s3Endpoint || undefined,
      forcePathStyle: this.s3ForcePathStyle,
      credentials: {
        accessKeyId: this.s3AccessKeyId,
        secretAccessKey: this.s3SecretAccessKey
      }
    });
    return this.s3PresignClient;
  }

  private sanitizeObjectName(value: string): string {
    const normalized = String(value || "")
      .trim()
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[<>:"|?*]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/\s+/g, "-");
    const fallback = normalized || `archive-${Date.now()}.zip`;
    return fallback.toLowerCase().endsWith(".zip") ? fallback : `${fallback}.zip`;
  }

  private assertOwnedObjectKey(userId: number, key: string): void {
    const prefix = `uploads/${userId}/`;
    if (!String(key || "").startsWith(prefix)) {
      throw new BadRequestException("Недопустимый key объекта");
    }
  }

  private async downloadS3ObjectToFile(
    key: string,
    destinationPath: string,
    expectedBytes?: number,
    onProgress?: (progressPercent: number) => Promise<void> | void
  ): Promise<void> {
    const response = await this.getS3Client().send(
      new GetObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: key
      })
    );

    const body = response.Body as NodeJS.ReadableStream | undefined;
    if (!body) {
      throw new BadRequestException("S3 object body is empty");
    }
    const output = createWriteStream(destinationPath);
    const totalBytes = Math.max(0, Number(expectedBytes || response.ContentLength || 0));
    let downloadedBytes = 0;
    let lastReported = 0;

    for await (const chunk of body as AsyncIterable<Buffer>) {
      if (!output.write(chunk)) {
        await once(output, "drain");
      }
      downloadedBytes += chunk.length;

      if (onProgress && totalBytes > 0) {
        const percent = Math.max(
          0,
          Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100))
        );
        if (percent >= lastReported + 2 || percent === 100) {
          lastReported = percent;
          await onProgress(percent);
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      output.end((error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private extractWorkLabel(currentPath: string): string {
    const normalized = this.normalizePath(String(currentPath || "")).trim();
    if (!normalized) {
      return "текущая работа";
    }

    const clean = normalized.replace(/^\/+/, "");
    const withoutFile = clean.includes("/") ? clean.slice(0, clean.lastIndexOf("/")) : clean;
    const value = withoutFile || clean;
    if (!value) {
      return "текущая работа";
    }

    const segments = value.split("/").filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1]}`;
    }
    return segments[0] || "текущая работа";
  }

  private async ensureS3BucketExists(): Promise<void> {
    if (this.s3BucketEnsured) {
      return;
    }

    const bucket = this.getS3Bucket();
    const client = this.getS3Client();

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      this.s3BucketEnsured = true;
      return;
    } catch {
      // continue to create
    }

    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (error) {
      const message =
        String((error as { name?: string; message?: string })?.name || "") +
        " " +
        String((error as { message?: string })?.message || "");
      if (
        !message.includes("BucketAlreadyOwnedByYou") &&
        !message.includes("BucketAlreadyExists")
      ) {
        throw error;
      }
    }

    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    this.s3BucketEnsured = true;
  }
}
