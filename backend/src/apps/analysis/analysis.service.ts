import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit
} from "@nestjs/common";
import { createReadStream, createWriteStream } from "node:fs";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as unzipper from "unzipper";
import * as yauzl from "yauzl";
import {
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CreateBucketCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListMultipartUploadsCommandOutput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  S3Client,
  UploadPartCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Like, Repository } from "typeorm";
import { DuckdbService } from "../database/duckdb/duckdb.service";
import { MetricsService } from "../metrics/metrics.service";
import { PathParserService } from "../utils/path-parser/path-parser.service";
import { PathOutsideRootError, resolvePathUnderRoot } from "../../common/path-security";
import { RunAnalysisDto } from "./dto/run-analysis.dto";
import { AnalysisResponse, AnalysisRow, GitAnalysisRow } from "./analysis.types";
import { HtmlCssFullAnalyzerService } from "./html-css-full-analyzer.service";
import { AnalysisGitResult } from "./entities/analysis-git-result.entity";
import { AnalysisJob, AnalysisJobStatus } from "./entities/analysis-job.entity";
import { AnalysisPlagiarism } from "./entities/analysis-plagiarism.entity";
import { AnalysisResult } from "./entities/analysis-result.entity";
import { AnalysisUpload } from "./entities/analysis-upload.entity";
import { PlagiarismHeatmapService } from "./plagiarism-heatmap.service";

interface ZipAnalysisInput {
  userId: number;
  archive: {
    originalname?: string;
    buffer?: Buffer;
    path?: string;
    stream?: NodeJS.ReadableStream;
    s3Key?: string;
    size?: number;
  };
  cleanupArchivePath?: boolean;
  sourceFingerprint?: string;
  onProgress?: (stage: string, progressPercent: number) => Promise<void> | void;
  direction: string;
  metrics?: string[];
  eslintConfigText?: string;
  eslintConfigFormat?: "js" | "mjs" | "cjs";
  group?: string;
  student?: string;
  r?: boolean;
  depth?: number;
  includeGitMetrics?: boolean;
  includePlagiarismHeatmap?: boolean;
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
    eslintConfigText?: string;
    eslintConfigFormat?: "js" | "mjs" | "cjs";
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
    includePlagiarismHeatmap?: boolean;
  };
}

const JAVASCRIPT_METRIC_ORDER = [
  "lines_of_code",
  "functions_count_user",
  "functions_count_all",
  "average_function_size",
  "files_count",
  "cyclomatic_complexity_avg",
  "cyclomatic_complexity_sum",
  "maximum_nesting_depth",
  "max_parameters_per_function",
  "halstead_volume",
  "halstead_difficulty",
  "halstead_effort",
  "cognitive_complexity",
  "eslint_errors_count",
  "eslint_warnings_count",
  "internal_similarity",
  "maintainability",
  "complex_methods_count",
  "long_parameter_list_count",
  "dead_code_count",
  "long_methods_count",
  "unused_parameters_count",
  "unused_variables_count",
  "undeclared_variables_count",
  "long_message_chains_count",
  "long_scope_chaining_count",
  "inner_html_usage_count",
  "switch_without_default_count"
];

const JAVASCRIPT_METRIC_ORDER_INDEX = new Map(
  JAVASCRIPT_METRIC_ORDER.map((metric, index) => [metric, index])
);

interface QueuedHeatmapJob {
  jobId: string;
  input: {
    userId: number;
    runId: string;
    depth?: number;
    selectedLevels?: string[][];
  };
}

interface QueuedStandaloneHeatmapJob {
  jobId: string;
  input: {
    userId: number;
    key: string;
    originalName?: string;
    r?: boolean;
    depth?: number;
  };
}

type QueuedJob = QueuedZipJob | QueuedS3Job | QueuedHeatmapJob | QueuedStandaloneHeatmapJob;

type RunFilterKind = "metrics" | "git";

type RunFilterInput = {
  kind: RunFilterKind;
  depth?: number;
  selectedLevels?: string[][];
};

type ZipEntryFilter = (relativePath: string) => boolean;
type FolderMetricUnit = {
  absolutePath: string;
  relativePath: string;
  targetKind: "directory" | "file";
};

const HEATMAP_MAX_WORKS = 100;
const HEATMAP_LIMIT_MESSAGE =
  "Построить тепловую карту списанных работ можно только для максимум 100 работ. Пожалуйста, запустите анализ без тепловой карты, а затем на странице архива анализа постройте карту для непосредственного нужного среза.";
const DEFAULT_HEATMAP_MAX_ARCHIVE_BYTES = 5000 * 1024 * 1024; // 5000 MB
const DEFAULT_ZIP_EXTRACT_CONCURRENCY = 8;
const DEFAULT_S3_ZIP_TAIL_SIZES = [
  1024 * 1024,
  4 * 1024 * 1024,
  16 * 1024 * 1024,
  64 * 1024 * 1024
];

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
  private readonly s3PresignConcurrency = Math.max(
    1,
    Math.min(64, Math.trunc(Number(process.env.S3_PRESIGN_CONCURRENCY || 16)))
  );
  private readonly s3MaxSockets = Math.max(
    8,
    Math.min(256, Math.trunc(Number(process.env.S3_MAX_SOCKETS || 64)))
  );
  private readonly uploadCleanupTtlHours = Math.max(
    1,
    Number(process.env.ANALYSIS_UPLOAD_CLEANUP_TTL_HOURS || 24)
  );
  private readonly sourceArchiveTtlHours = Math.max(
    1,
    Number(process.env.ANALYSIS_SOURCE_ARCHIVE_TTL_HOURS || 24)
  );
  private readonly heatmapMaxArchiveBytes = Math.max(
    1,
    Math.trunc(Number(process.env.HEATMAP_MAX_ARCHIVE_BYTES || DEFAULT_HEATMAP_MAX_ARCHIVE_BYTES))
  );
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
    @InjectRepository(AnalysisPlagiarism)
    private readonly analysisPlagiarismRepo: Repository<AnalysisPlagiarism>,
    @InjectRepository(AnalysisResult)
    private readonly analysisResultRepo: Repository<AnalysisResult>,
    private readonly plagiarismHeatmapService: PlagiarismHeatmapService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.recoverStaleJobsAfterRestart();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Не удалось восстановить статусы задач после рестарта: ${message}`);
    }

    try {
      await this.cleanupStaleLocalUploads();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Не удалось очистить старые upload-архивы: ${message}`);
    }

    try {
      await this.cleanupStaleS3Uploads();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Не удалось очистить старые S3-архивы: ${message}`);
    }
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
      if (dto.direction === "js") {
        const folderResult = await this.runFromFolderJs(dto, selectedMetrics);
        return this.withOptionalGitData(folderResult, dto);
      }
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

    if (
      !input.archive.buffer &&
      !input.archive.path &&
      !input.archive.stream &&
      !input.archive.s3Key
    ) {
      throw new BadRequestException("archive content is empty");
    }

    const selectedMetrics = this.resolveSelectedMetrics(input.direction, input.metrics);
    // Временный каталог должен быть внутри worksRoot, иначе не пройдёт security-проверку
    // `requirePathUnderRoot` в `run()` (см. SECURITY_FIXES §10 и resolveRootPath).
    await fs.mkdir(this.worksRoot, { recursive: true });
    const tempRoot = await fs.mkdtemp(path.join(this.worksRoot, "analysis-zip-"));
    let archivePath = input.archive.path;
    try {
      await input.onProgress?.("Подготовка данных", 3);
      if (!archivePath && input.archive.buffer) {
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

      const extractedFiles = input.archive.s3Key
        ? await this.extractS3ZipObjectToDir(input.archive.s3Key, tempRoot, {
            expectedBytes: Number(input.archive.size || 0),
            entryFilter: this.buildAnalysisZipEntryFilter(input.includeGitMetrics),
            onProgress: (extractProgress) =>
              input.onProgress?.(
                "Подготовка файлов к проверке",
                5 + Math.floor(extractProgress * 0.3)
              )
          })
        : input.archive.stream
          ? await this.extractZipReadableToDir(input.archive.stream, tempRoot, {
              expectedBytes: Number(input.archive.size || 0),
              entryFilter: this.buildAnalysisZipEntryFilter(input.includeGitMetrics),
              onProgress: (extractProgress) =>
                input.onProgress?.(
                  "Подготовка файлов к проверке",
                  5 + Math.floor(extractProgress * 0.3)
                )
            })
          : await this.extractZipToDir(
              archivePath as string,
              tempRoot,
              (extractProgress) =>
                input.onProgress?.(
                  "Подготовка файлов к проверке",
                  5 + Math.floor(extractProgress * 0.3)
                ),
              this.buildAnalysisZipEntryFilter(input.includeGitMetrics)
            );
      if (!extractedFiles) {
        throw new BadRequestException("zip archive is empty");
      }
      if (this.resolveIncludePlagiarismHeatmap(input.includePlagiarismHeatmap)) {
        await input.onProgress?.("Проверяем лимиты тепловой карты", 36);
        const heatmapFoldersCount = await this.plagiarismHeatmapService.countFromRoot(
          tempRoot,
          Boolean(input.r),
          input.depth
        );
        if (heatmapFoldersCount > HEATMAP_MAX_WORKS) {
          throw new BadRequestException(HEATMAP_LIMIT_MESSAGE);
        }
      }

      const eslintConfigPath = await this.writeEslintConfigIfNeeded(tempRoot, input);

      await input.onProgress?.("Запуск проверки работ", 40);
      const result = await this.run({
        runId: cacheKey,
        direction: input.direction,
        metrics: selectedMetrics,
        group: input.group,
        student: input.student,
        rootPath: tempRoot,
        eslintConfigPath,
        r: input.r,
        depth: input.depth,
        includeGitMetrics: input.includeGitMetrics,
        onAnalyzeProgress: async (completed, total, currentPath) => {
          if (!input.onProgress) {
            return;
          }
          const safeTotal = Math.max(1, total);
          const progress = this.mapProgressRange(40, 78, completed, safeTotal);
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
          const progress = this.mapProgressRange(79, 90, completed, safeTotal);
          const repoLabel = this.extractWorkLabel(currentRepoPath);
          await input.onProgress(
            `Считаем Git-метрики: ${repoLabel} (${completed}/${safeTotal})`,
            progress
          );
        }
      });
      await input.onProgress?.("Подготавливаем тепловую карту", 91);
      result.plagiarismHeatmap = await this.buildPlagiarismHeatmapIfNeeded(tempRoot, input);
      await input.onProgress?.("Сохраняем результаты", 98);
      const runId = await this.saveResultsForUser(input.userId, result, cacheKey);
      await input.onProgress?.("Готово", 100);
      return {
        ...result,
        runId
      };
    } finally {
      if (archivePath && input.cleanupArchivePath !== false) {
        try {
          await fs.rm(archivePath, { force: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Не удалось удалить временный архив ${archivePath}: ${message}`);
        }
      }
      try {
        await fs.rm(tempRoot, { recursive: true, force: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Не удалось удалить временную папку ${tempRoot}: ${message}`);
      }
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
        eslintConfigHash: this.hashOptionalText(input.eslintConfigText),
        eslintConfigFormat: this.resolveEslintConfigFormat(input.eslintConfigFormat),
        r: Boolean(input.r),
        depth: input.depth ?? null,
        includeGitMetrics: this.resolveIncludeGitMetrics(input.includeGitMetrics),
        includePlagiarismHeatmap: this.resolveIncludePlagiarismHeatmap(
          input.includePlagiarismHeatmap
        )
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
    void this.cleanupStaleLocalUploads();

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
    eslintConfigText?: string;
    eslintConfigFormat?: "js" | "mjs" | "cjs";
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
    includePlagiarismHeatmap?: boolean;
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
        eslintConfigText: input.eslintConfigText,
        eslintConfigFormat: input.eslintConfigFormat,
        group: input.group,
        student: input.student,
        r: input.r,
        depth: input.depth,
        includeGitMetrics: input.includeGitMetrics,
        includePlagiarismHeatmap: input.includePlagiarismHeatmap
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

  async getS3MultipartPartUrls(input: {
    userId: number;
    key: string;
    uploadId: string;
    partNumbers: number[];
    expiresInSeconds?: number;
  }) {
    await this.ensureS3BucketExists();
    this.assertOwnedObjectKey(input.userId, input.key);
    if (!input.uploadId) {
      throw new BadRequestException("uploadId is required");
    }

    const partNumbers = Array.from(
      new Set(
        (Array.isArray(input.partNumbers) ? input.partNumbers : [])
          .map((partNumber) => Math.trunc(Number(partNumber)))
          .filter((partNumber) => Number.isFinite(partNumber) && partNumber >= 1)
      )
    ).sort((a, b) => a - b);

    if (!partNumbers.length) {
      throw new BadRequestException("partNumbers are required");
    }
    if (partNumbers.length > 1000) {
      throw new BadRequestException("partNumbers batch is too large");
    }
    if (partNumbers.some((partNumber) => partNumber > 10000)) {
      throw new BadRequestException("partNumber must be in range 1..10000");
    }

    const expiresInSeconds = Math.max(60, Math.min(3600, input.expiresInSeconds || 1800));

    const startedAt = Date.now();
    const urls: Array<{ partNumber: number; url: string }> = [];

    for (let i = 0; i < partNumbers.length; i += this.s3PresignConcurrency) {
      const batch = partNumbers.slice(i, i + this.s3PresignConcurrency);
      const batchUrls = await Promise.all(
        batch.map(async (partNumber) => {
          const command = new UploadPartCommand({
            Bucket: this.getS3Bucket(),
            Key: input.key,
            UploadId: input.uploadId,
            PartNumber: partNumber
          });
          return {
            partNumber,
            url: await getSignedUrl(this.getS3PresignClient(), command, {
              expiresIn: expiresInSeconds
            })
          };
        })
      );
      urls.push(...batchUrls);
    }
    this.logger.debug(
      `Generated ${urls.length} S3 presigned upload URLs in ${Date.now() - startedAt}ms`
    );

    return {
      key: input.key,
      uploadId: input.uploadId,
      expiresInSeconds,
      urls
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
    void this.cleanupStaleS3Uploads();

    return {
      bucket: this.getS3Bucket(),
      key: input.key,
      location: response.Location || null,
      etag: response.ETag || null
    };
  }

  async abortS3MultipartUpload(input: { userId: number; key: string; uploadId: string }) {
    await this.ensureS3BucketExists();
    this.assertOwnedObjectKey(input.userId, input.key);
    if (!input.uploadId) {
      throw new BadRequestException("uploadId is required");
    }

    await this.getS3Client().send(
      new AbortMultipartUploadCommand({
        Bucket: this.getS3Bucket(),
        Key: input.key,
        UploadId: input.uploadId
      })
    );

    return {
      bucket: this.getS3Bucket(),
      key: input.key,
      aborted: true
    };
  }

  async deleteUploadedS3Object(input: { userId: number; key: string }) {
    await this.deleteS3ObjectIfOwned(input.userId, input.key);
    return {
      key: input.key,
      deleted: true
    };
  }

  async enqueueRunFromS3Object(input: {
    userId: number;
    key: string;
    direction: string;
    metrics?: string[];
    eslintConfigText?: string;
    eslintConfigFormat?: "js" | "mjs" | "cjs";
    group?: string;
    student?: string;
    r?: boolean;
    depth?: number;
    includeGitMetrics?: boolean;
    includePlagiarismHeatmap?: boolean;
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
        eslintConfigHash: this.hashOptionalText(input.eslintConfigText),
        eslintConfigFormat: this.resolveEslintConfigFormat(input.eslintConfigFormat),
        r: Boolean(input.r),
        depth: input.depth ?? null,
        includeGitMetrics: this.resolveIncludeGitMetrics(input.includeGitMetrics),
        includePlagiarismHeatmap: this.resolveIncludePlagiarismHeatmap(
          input.includePlagiarismHeatmap
        )
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
        eslintConfigText: input.eslintConfigText,
        eslintConfigFormat: input.eslintConfigFormat,
        group: input.group,
        student: input.student,
        r: input.r,
        depth: input.depth,
        includeGitMetrics: input.includeGitMetrics,
        includePlagiarismHeatmap: input.includePlagiarismHeatmap
      }
    });
    void this.processQueue();

    return {
      jobId,
      status: "queued" as AnalysisJobStatus,
      createdAt: created.createdAt
    };
  }

  async validateS3HeatmapLimit(input: {
    userId: number;
    key: string;
    r?: boolean;
    depth?: number;
    selectedLevels?: string[][];
  }) {
    await this.ensureS3BucketExists();
    const key = String(input.key || "").trim();
    if (!key) {
      throw new BadRequestException("key is required");
    }
    this.assertOwnedObjectKey(input.userId, key);
    const head = await this.headS3SourceArchive(key);
    const archiveBytes = Number(head.ContentLength || 0);
    if (
      Number.isFinite(archiveBytes) &&
      archiveBytes > 0 &&
      archiveBytes > this.heatmapMaxArchiveBytes
    ) {
      return {
        folderCount: null,
        maxAllowed: HEATMAP_MAX_WORKS,
        allowed: false,
        archiveTooLarge: true,
        message: this.buildHeatmapArchiveSizeLimitMessage(archiveBytes)
      };
    }

    const recursive = Boolean(input.r);
    const normalizedDepth =
      input.depth !== undefined && Number.isFinite(input.depth)
        ? Math.max(1, Math.trunc(input.depth))
        : undefined;

    let folderCount: number;
    if (recursive && normalizedDepth !== undefined) {
      folderCount = await this.countHeatmapFoldersFromZipEntriesFast(key, {
        recursive,
        depth: normalizedDepth,
        selectedLevels: input.selectedLevels || [],
        earlyStopLimit: HEATMAP_MAX_WORKS + 1
      });
    } else {
      folderCount = await this.withExtractedS3ObjectRoot(
        key,
        async (tempRoot) =>
          this.plagiarismHeatmapService.countFromRoot(
            tempRoot,
            recursive,
            normalizedDepth,
            input.selectedLevels
          ),
        undefined,
        this.buildSelectedLevelsZipEntryFilter(input.selectedLevels || [])
      );
    }

    return {
      folderCount,
      maxAllowed: HEATMAP_MAX_WORKS,
      allowed: folderCount <= HEATMAP_MAX_WORKS,
      archiveTooLarge: false,
      message: folderCount > HEATMAP_MAX_WORKS ? HEATMAP_LIMIT_MESSAGE : null
    };
  }

  async enqueueStandaloneHeatmapBuild(input: {
    userId: number;
    key: string;
    originalName?: string;
    r?: boolean;
    depth?: number;
  }) {
    await this.ensureS3BucketExists();
    const key = String(input.key || "").trim();
    if (!key) {
      throw new BadRequestException("key is required");
    }
    this.assertOwnedObjectKey(input.userId, key);
    await this.assertHeatmapArchiveSizeAllowed(key);

    const jobId = randomUUID();
    const archiveName = String(input.originalName || path.basename(key) || "heatmap.zip");
    const created = this.analysisJobRepo.create({
      id: jobId,
      userId: input.userId,
      direction: "html_css",
      status: "queued",
      archiveName,
      progressPercent: 0,
      stage: "Ожидание",
      errorMessage: null,
      requestPayload: {
        kind: "standalone_heatmap",
        key,
        originalName: archiveName,
        r: Boolean(input.r),
        depth: input.depth ?? null
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
        originalName: archiveName,
        r: input.r,
        depth: input.depth
      }
    });
    void this.processQueue();

    return {
      jobId,
      status: "queued" as AnalysisJobStatus,
      createdAt: created.createdAt
    };
  }

  async deleteStandaloneHeatmap(userId: number, jobId: string) {
    const normalizedJobId = String(jobId || "").trim();
    if (!normalizedJobId) {
      throw new BadRequestException("jobId path parameter is required");
    }

    const job = await this.analysisJobRepo.findOne({
      where: {
        id: normalizedJobId,
        userId
      }
    });
    if (!job) {
      throw new NotFoundException("Тепловая карта не найдена");
    }

    const request = (job.requestPayload || {}) as Record<string, unknown>;
    if (request.kind !== "standalone_heatmap" && request.kind !== "heatmap_build") {
      throw new NotFoundException("Тепловая карта не найдена");
    }

    await this.analysisJobRepo.delete({
      id: normalizedJobId,
      userId
    });

    return {
      jobId: normalizedJobId,
      deleted: true
    };
  }

  async buildPlagiarismHeatmapByRunFilters(input: {
    userId: number;
    runId: string;
    depth?: number;
    selectedLevels?: string[][];
    onProgress?: (stage: string, progressPercent: number) => Promise<void> | void;
  }) {
    const normalizedRunId = String(input.runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const sourceJob = await this.findSuccessfulJobByRunId(input.userId, normalizedRunId, {
      requireSourceKey: true
    });
    const key = String(sourceJob?.requestPayload?.key || "").trim();
    if (!key) {
      throw new NotFoundException("Архив для запуска не найден");
    }
    this.assertOwnedObjectKey(input.userId, key);

    const recursive =
      sourceJob?.requestPayload?.r === undefined ? true : Boolean(sourceJob.requestPayload.r);

    const inferredDepth = this.inferDepthFromSelectedLevels(input.selectedLevels || []);
    const normalizedDepth =
      input.depth !== undefined && Number.isFinite(input.depth)
        ? Math.max(1, Math.trunc(input.depth))
        : inferredDepth;
    const normalizedLevels = normalizedDepth
      ? this.normalizeSelectedLevels(input.selectedLevels || [], normalizedDepth)
      : [];

    const output = await this.withExtractedS3ObjectRoot(
      key,
      async (tempRoot) => {
        await input.onProgress?.("Определяем папки для сравнения", 21);
        const folderCount = await this.plagiarismHeatmapService.countFromRoot(
          tempRoot,
          recursive,
          normalizedDepth,
          normalizedLevels
        );
        if (folderCount > HEATMAP_MAX_WORKS) {
          throw new BadRequestException(HEATMAP_LIMIT_MESSAGE);
        }
        const heatmap = await this.plagiarismHeatmapService.buildFromRoot(
          tempRoot,
          recursive,
          normalizedDepth,
          async (completedPairs, totalPairs, folder1, folder2) => {
            if (!input.onProgress) {
              return;
            }
            const safeTotal = Math.max(1, totalPairs);
            const progress = this.mapProgressRange(22, 98, completedPairs, safeTotal);
            const toProgressLabel = (value?: string): string => {
              const raw = String(value || "").trim();
              if (!raw) {
                return "";
              }
              const relative = this.normalizePath(path.relative(tempRoot, raw)).replace(
                /^\/+|\/+$/g,
                ""
              );
              const normalized = relative || this.normalizePath(path.basename(raw));
              if (!normalized) {
                return "";
              }
              if (normalizedDepth && normalizedDepth > 0) {
                const segments = normalized.split("/").filter(Boolean);
                if (segments.length >= normalizedDepth) {
                  return (
                    segments[normalizedDepth - 1] || segments[segments.length - 1] || normalized
                  );
                }
                return segments[segments.length - 1] || normalized;
              }
              return normalized.split("/").filter(Boolean).pop() || normalized;
            };
            const pairLabel = [folder1, folder2]
              .map((value) => toProgressLabel(value))
              .filter(Boolean)
              .join(" ↔ ");
            await input.onProgress(
              pairLabel
                ? `Считаем тепловую карту: ${pairLabel} (${completedPairs}/${safeTotal})`
                : `Считаем тепловую карту: пары ${completedPairs}/${safeTotal}`,
              progress
            );
          },
          normalizedLevels
        );
        return {
          folderCount,
          heatmap: heatmap
            ? this.normalizePlagiarismHeatmapPayload(heatmap, tempRoot, normalizedDepth)
            : null
        };
      },
      input.onProgress,
      this.buildSelectedLevelsZipEntryFilter(normalizedLevels)
    );

    return {
      runId: normalizedRunId,
      folderCount: output.folderCount,
      maxAllowed: HEATMAP_MAX_WORKS,
      plagiarismHeatmap: output.heatmap
    };
  }

  async enqueueHeatmapBuildByRunFilters(input: {
    userId: number;
    runId: string;
    depth?: number;
    selectedLevels?: string[][];
  }) {
    const normalizedRunId = String(input.runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const details = await this.getSavedResultsByRunId(input.userId, normalizedRunId);
    const direction = String(details.direction || "html_css").trim() || "html_css";

    const jobId = randomUUID();
    const created = this.analysisJobRepo.create({
      id: jobId,
      userId: input.userId,
      direction,
      status: "queued",
      archiveName: `heatmap:${normalizedRunId}`,
      progressPercent: 0,
      stage: "Ожидание",
      errorMessage: null,
      requestPayload: {
        kind: "heatmap_build",
        runId: normalizedRunId,
        depth: input.depth ?? null,
        selectedLevels: input.selectedLevels || []
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
        runId: normalizedRunId,
        depth: input.depth,
        selectedLevels: input.selectedLevels || []
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
    includePlagiarismHeatmap?: boolean;
  }) {
    const zipPathRaw = String(input.zipPath || "").trim();
    if (!zipPathRaw) {
      throw new BadRequestException("zipPath is required");
    }
    const absoluteZipPath = this.requirePathUnderRoot(this.worksRoot, zipPathRaw, "zipPath");
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
      includeGitMetrics: input.includeGitMetrics,
      includePlagiarismHeatmap: input.includePlagiarismHeatmap
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
      persistedProgress >= 5 &&
      persistedProgress < 100 &&
      elapsedSeconds > 0
    ) {
      estimatedTotalSeconds = Math.max(1, Math.round((elapsedSeconds * 100) / persistedProgress));
    }

    const estimatedRemainingSeconds =
      job.status === "success"
        ? 0
        : estimatedTotalSeconds !== null
          ? job.status === "running"
            ? Math.max(1, estimatedTotalSeconds - elapsedSeconds)
            : Math.max(0, estimatedTotalSeconds - elapsedSeconds)
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
    const plagiarism = await this.analysisPlagiarismRepo.findOne({
      where: { userId, runId: normalizedRunId }
    });
    const requestedFeatures = await this.getRunRequestedFeatures(userId, normalizedRunId);
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
      requestedFeatures: requestedFeatures || undefined,
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
      })),
      plagiarismHeatmap: plagiarism?.payload || null
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
    const plagiarism =
      input.kind === "metrics"
        ? await this.analysisPlagiarismRepo.findOne({
            where: { userId, runId: normalizedRunId }
          })
        : null;
    const requestedFeatures =
      input.kind === "metrics" ? await this.getRunRequestedFeatures(userId, normalizedRunId) : null;

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
    const metrics = this.sortMetricsForDirection(
      filteredRows[0]?.direction || rows[0]?.direction || "",
      Array.from(metricSet)
    );

    return {
      runId: normalizedRunId,
      kind: "metrics",
      depth,
      selectedLevels,
      metrics,
      requestedFeatures: requestedFeatures || undefined,
      plagiarismHeatmap: plagiarism?.payload || null,
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

  async getRunHeatmapHistory(userId: number, runId: string) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const jobs = await this.analysisJobRepo.find({
      where: {
        userId,
        status: "success",
        archiveName: `heatmap:${normalizedRunId}`
      },
      order: { createdAt: "DESC" },
      take: 50
    });

    const history = jobs
      .map((job) => {
        const payload = (job.resultPayload || {}) as Record<string, unknown>;
        const request = (job.requestPayload || {}) as Record<string, unknown>;
        const plagiarismHeatmap = (payload.plagiarismHeatmap ||
          null) as AnalysisResponse["plagiarismHeatmap"];
        if (!plagiarismHeatmap) {
          return null;
        }

        const selectedLevelsRaw = Array.isArray(request.selectedLevels)
          ? request.selectedLevels
          : [];
        const selectedLevels = selectedLevelsRaw.map((levelValues) =>
          (Array.isArray(levelValues) ? levelValues : [])
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        );

        return {
          jobId: job.id,
          createdAt: job.createdAt,
          depth:
            request.depth === undefined ||
            request.depth === null ||
            !Number.isFinite(Number(request.depth))
              ? null
              : Math.max(1, Math.trunc(Number(request.depth))),
          selectedLevels,
          folderCount:
            payload.rowsTotal === undefined ||
            payload.rowsTotal === null ||
            !Number.isFinite(Number(payload.rowsTotal))
              ? null
              : Math.max(0, Math.trunc(Number(payload.rowsTotal))),
          plagiarismHeatmap
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      runId: normalizedRunId,
      data: history
    };
  }

  async getStandaloneHeatmapList(
    userId: number,
    filters?: {
      folder?: string;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
    }
  ) {
    const jobs = await this.analysisJobRepo.find({
      where: {
        userId,
        status: "success"
      },
      order: { finishedAt: "DESC", createdAt: "DESC" },
      take: Math.max(1, Math.min(500, Math.trunc(Number(filters?.limit) || 200)))
    });

    const folderFilter = String(filters?.folder || "")
      .trim()
      .toLowerCase();
    const dateFromMs = filters?.dateFrom ? filters.dateFrom.getTime() : null;
    const dateToMs = filters?.dateTo ? filters.dateTo.getTime() : null;

    const data: Array<{
      jobId: string;
      archiveName: string | null;
      folder: string;
      folderCount: number;
      createdAt: Date;
      finishedAt: Date;
      plagiarismHeatmap: NonNullable<AnalysisResponse["plagiarismHeatmap"]>;
    }> = [];

    for (const job of jobs) {
      const request = (job.requestPayload || {}) as Record<string, unknown>;
      if (request.kind !== "standalone_heatmap" && request.kind !== "heatmap_build") {
        continue;
      }

      const payload = (job.resultPayload || {}) as Record<string, unknown>;
      const heatmap = (payload.plagiarismHeatmap || null) as AnalysisResponse["plagiarismHeatmap"];
      if (!heatmap) {
        continue;
      }

      let folder = String(payload.path || "").trim();
      if (!folder || /^analysis-heatmap-/i.test(folder)) {
        if (request.kind === "standalone_heatmap") {
          folder = this.getArchiveDisplayName(
            String(request.originalName || request.key || job.archiveName || "")
          );
        } else {
          const runId = String(request.runId || "").trim();
          const sourceJob = runId
            ? await this.findSuccessfulJobByRunId(userId, runId, { requireSourceKey: true })
            : null;
          const sourceKey = String(sourceJob?.requestPayload?.key || "").trim();
          folder = sourceKey
            ? this.getArchiveDisplayName(sourceKey)
            : this.getArchiveDisplayName(runId || job.archiveName || "");
        }
      }
      if (!folder) {
        folder = String(heatmap.rootPath || job.archiveName || "Архив").trim() || "Архив";
      }

      const finishedAt = job.finishedAt || job.createdAt;
      const timestamp = new Date(finishedAt).getTime();
      if (folderFilter && !folder.toLowerCase().includes(folderFilter)) {
        continue;
      }
      if (dateFromMs !== null && (!Number.isFinite(timestamp) || timestamp < dateFromMs)) {
        continue;
      }
      if (dateToMs !== null && (!Number.isFinite(timestamp) || timestamp > dateToMs)) {
        continue;
      }

      data.push({
        jobId: job.id,
        archiveName: job.archiveName,
        folder,
        folderCount: Number(payload.rowsTotal || heatmap.labels.length || 0),
        createdAt: job.createdAt,
        finishedAt,
        plagiarismHeatmap: heatmap
      });
    }

    return { data };
  }

  async getStandaloneHeatmapDetails(userId: number, jobId: string) {
    const normalizedJobId = String(jobId || "").trim();
    if (!normalizedJobId) {
      throw new BadRequestException("jobId path parameter is required");
    }

    const job = await this.analysisJobRepo.findOne({
      where: {
        id: normalizedJobId,
        userId
      }
    });
    if (!job) {
      throw new NotFoundException("Тепловая карта не найдена");
    }
    const request = (job.requestPayload || {}) as Record<string, unknown>;
    if (request.kind !== "standalone_heatmap" && request.kind !== "heatmap_build") {
      throw new NotFoundException("Тепловая карта не найдена");
    }
    const payload = (job.resultPayload || {}) as Record<string, unknown>;
    const heatmap = (payload.plagiarismHeatmap || null) as AnalysisResponse["plagiarismHeatmap"];
    if (!heatmap) {
      throw new NotFoundException("Данные тепловой карты не найдены");
    }

    let folder = String(payload.path || "").trim();
    if (!folder || /^analysis-heatmap-/i.test(folder)) {
      if (request.kind === "standalone_heatmap") {
        folder = this.getArchiveDisplayName(
          String(request.originalName || request.key || job.archiveName || "")
        );
      } else {
        const runId = String(request.runId || "").trim();
        const sourceJob = runId
          ? await this.findSuccessfulJobByRunId(userId, runId, { requireSourceKey: true })
          : null;
        const sourceKey = String(sourceJob?.requestPayload?.key || "").trim();
        folder = sourceKey
          ? this.getArchiveDisplayName(sourceKey)
          : this.getArchiveDisplayName(runId || job.archiveName || "");
      }
    }
    if (!folder) {
      folder = String(heatmap.rootPath || job.archiveName || "Архив").trim() || "Архив";
    }

    return {
      jobId: job.id,
      archiveName: job.archiveName,
      folder,
      folderCount: Number(payload.rowsTotal || heatmap.labels.length || 0),
      createdAt: job.createdAt,
      finishedAt: job.finishedAt || job.createdAt,
      plagiarismHeatmap: heatmap
    };
  }

  async getSavedAnalysisList(
    userId: number,
    page: number,
    size: number,
    filters?: {
      path?: string;
      direction?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ) {
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

    let list = Array.from(byRun.values())
      .map((run) => ({
        runId: run.runId,
        path: this.extractRunPath(run.paths),
        date: run.createdAt.toISOString(),
        direction: run.direction
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const normalizedDirection = String(filters?.direction || "")
      .trim()
      .toLowerCase();
    const normalizedPath = this.normalizePath(String(filters?.path || "").trim()).toLowerCase();
    const dateFromMs = filters?.dateFrom ? filters.dateFrom.getTime() : null;
    const dateToMs = filters?.dateTo ? filters.dateTo.getTime() : null;

    if (normalizedDirection) {
      list = list.filter(
        (item) =>
          String(item.direction || "")
            .trim()
            .toLowerCase() === normalizedDirection
      );
    }
    if (normalizedPath) {
      list = list.filter((item) =>
        this.normalizePath(String(item.path || ""))
          .toLowerCase()
          .includes(normalizedPath)
      );
    }
    if (dateFromMs !== null) {
      list = list.filter((item) => {
        const timestamp = new Date(item.date).getTime();
        return Number.isFinite(timestamp) && timestamp >= dateFromMs;
      });
    }
    if (dateToMs !== null) {
      list = list.filter((item) => {
        const timestamp = new Date(item.date).getTime();
        return Number.isFinite(timestamp) && timestamp <= dateToMs;
      });
    }

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

  async deleteSavedRun(userId: number, runId: string) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const runExistsInMetrics = await this.analysisResultRepo.exist({
      where: { userId, runId: normalizedRunId }
    });
    const runExistsInGit = await this.analysisGitResultRepo.exist({
      where: { userId, runId: normalizedRunId }
    });
    if (!runExistsInMetrics && !runExistsInGit) {
      throw new NotFoundException("Результаты запуска не найдены");
    }

    const sourceJob = await this.findSuccessfulJobByRunId(userId, normalizedRunId, {
      requireSourceKey: true
    });
    const sourceKey = String(sourceJob?.requestPayload?.key || "").trim();

    const metricsDeleteResult = await this.analysisResultRepo.delete({
      userId,
      runId: normalizedRunId
    });
    const gitDeleteResult = await this.analysisGitResultRepo.delete({
      userId,
      runId: normalizedRunId
    });
    await this.analysisPlagiarismRepo.delete({
      userId,
      runId: normalizedRunId
    });
    if (sourceKey) {
      await this.deleteS3ObjectIfOwned(userId, sourceKey);
    }

    return {
      runId: normalizedRunId,
      deletedMetricsRows: metricsDeleteResult.affected || 0,
      deletedGitRows: gitDeleteResult.affected || 0
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
      await options?.onRepoProgress?.(index, totalRepos, relativeRepoPath);
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
    const pending: string[] = [rootPath];

    while (pending.length > 0) {
      const currentPath = pending.pop();
      if (!currentPath) {
        continue;
      }

      let entries: Array<{ name: string; isDirectory: () => boolean }>;
      try {
        entries = (await fs.readdir(currentPath, {
          withFileTypes: true
        })) as Array<{ name: string; isDirectory: () => boolean }>;
      } catch {
        continue;
      }

      let hasGitDir = false;
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name === ".git") {
          hasGitDir = true;
          break;
        }
      }

      if (hasGitDir) {
        try {
          await this.runGit(["rev-parse", "--is-inside-work-tree"], currentPath);
          repos.push(currentPath);
        } catch {
          // Not a valid repository.
        }
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        if (entry.name.startsWith(".")) {
          continue;
        }
        if (this.ignoredDirNames.has(entry.name)) {
          continue;
        }
        pending.push(path.join(currentPath, entry.name));
      }
    }

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
          "--format=%x1e%H%x1f%an%x1f%aI%x1f%s%x1f%P"
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
          .map((line) => line.trimEnd())
          .filter(Boolean);
        if (!lines.length) {
          continue;
        }

        const header = lines[0] || "";
        const [fullHash, author, isoDate, message, parentField] = header.split("\x1f");
        if (!fullHash || !/^[0-9a-f]{40}$/i.test(fullHash)) {
          continue;
        }
        if (!isoDate) {
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
            date: isoDate,
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

    const whereClauses: string[] = [];
    const queryParams: unknown[] = [csvAbsolutePath];
    if (dto.group) {
      whereClauses.push("split_part(path, '/', 1) = ?");
      queryParams.push(dto.group);
    }
    if (dto.student) {
      whereClauses.push("split_part(path, '/', 2) = ?");
      queryParams.push(dto.student);
    }

    const query = `
      SELECT path
      FROM read_csv_auto(?, header = true)
      ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
      ORDER BY path;
    `;

    const rows = await this.duckdbService.all<{ path: string }>(query, queryParams);
    const data: AnalysisRow[] = [];

    for (const row of rows) {
      const parsed = this.pathParserService.parse(row.path);
      const absoluteSubmissionPath = this.requirePathUnderRoot(
        this.csvRoot,
        parsed.path,
        "CSV path"
      );

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

    const units = await this.collectHtmlMetricUnits(rootAbsolutePath, dto);
    return this.runFromFolderMetricUnits(dto, selectedMetrics, rootAbsolutePath, units);
  }

  private async runFromFolderJs(
    dto: RunAnalysisDto,
    selectedMetrics: string[]
  ): Promise<AnalysisResponse> {
    const rootAbsolutePath = this.resolveRootPath(dto.rootPath as string);
    const rootDisplayLabel = await this.inferRootDisplayLabel(rootAbsolutePath);
    await this.ensureDirectoryExists(rootAbsolutePath);

    const units = await this.collectJsMetricUnits(rootAbsolutePath, rootDisplayLabel, dto);
    return this.runFromFolderMetricUnits(dto, selectedMetrics, rootAbsolutePath, units);
  }

  private async runFromFolderMetricUnits(
    dto: RunAnalysisDto,
    selectedMetrics: string[],
    rootAbsolutePath: string,
    units: FolderMetricUnit[]
  ): Promise<AnalysisResponse> {
    const data: AnalysisRow[] = [];
    const total = Math.max(1, units.length);

    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index];
      await dto.onAnalyzeProgress?.(index + 1, total, unit.relativePath);
      if (!unit.relativePath || unit.relativePath.startsWith("..")) {
        continue;
      }

      const parsed = this.pathParserService.parse(unit.relativePath);

      if (dto.group && parsed.group !== dto.group) {
        continue;
      }
      if (dto.student && parsed.student !== dto.student) {
        continue;
      }

      const metricValues = await this.safeComputeMetrics(
        dto.direction,
        selectedMetrics,
        unit.absolutePath,
        unit.relativePath,
        rootAbsolutePath,
        unit.targetKind,
        dto.runId,
        dto.eslintConfigPath
      );

      data.push({
        path: unit.relativePath,
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

  private async safeComputeMetrics(
    direction: string,
    metrics: string[],
    absolutePath: string,
    relativePath: string,
    rootAbsolutePath?: string,
    targetKind: "directory" | "file" = "file",
    runId?: string,
    eslintConfigPath?: string
  ) {
    try {
      if (targetKind === "directory") {
        await this.ensureDirectoryExists(absolutePath);
      } else {
        await this.ensureFileExists(absolutePath);
      }
      return await this.metricsService.compute(
        direction,
        {
          absolutePath,
          relativePath,
          eslintConfigPath,
          runId,
          rootAbsolutePath
        },
        metrics
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Не удалось посчитать метрики ${direction} для ${relativePath}: ${message}`);
      const empty: Record<string, null> = {};
      for (const metric of metrics) {
        empty[metric] = null;
      }
      return empty;
    }
  }

  private requirePathUnderRoot(rootDir: string, userPath: string, fieldLabel: string): string {
    try {
      return resolvePathUnderRoot(rootDir, userPath);
    } catch (error) {
      if (error instanceof PathOutsideRootError) {
        throw new BadRequestException(`${fieldLabel}: ${error.message}`);
      }
      throw error;
    }
  }

  private resolveCsvPath(csvFile?: string): string {
    const relative = (csvFile || "submissions.csv").trim();
    return this.requirePathUnderRoot(this.csvRoot, relative, "csvFile");
  }

  private resolveRootPath(rootPath: string): string {
    const trimmed = String(rootPath || "").trim();
    if (!trimmed) {
      throw new BadRequestException("rootPath is required");
    }
    return this.requirePathUnderRoot(this.worksRoot, trimmed, "rootPath");
  }

  private async ensureFileExists(filePath: string) {
    let stat!: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(filePath);
    } catch {
      throw new BadRequestException(`File does not exist: ${filePath}`);
    }
    if (!stat.isFile()) {
      throw new BadRequestException(`Not a file: ${filePath}`);
    }
  }

  private async ensureDirectoryExists(directoryPath: string) {
    let stat!: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(directoryPath);
    } catch {
      throw new BadRequestException(`Directory does not exist: ${directoryPath}`);
    }
    if (!stat.isDirectory()) {
      throw new BadRequestException(`Not a directory: ${directoryPath}`);
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

  private async collectHtmlMetricUnits(
    rootAbsolutePath: string,
    dto: RunAnalysisDto
  ): Promise<FolderMetricUnit[]> {
    const workDirs = await this.collectWorkDirs(rootAbsolutePath, Boolean(dto.r));
    const units: FolderMetricUnit[] = [];

    for (const workDir of workDirs) {
      const htmlFiles = await this.collectFilesByExtension(workDir, [".html", ".htm"], dto.depth);
      for (const absolutePath of htmlFiles) {
        const relativePath = this.normalizePath(path.relative(rootAbsolutePath, absolutePath));
        if (!relativePath || relativePath.startsWith("..")) {
          continue;
        }
        units.push({
          absolutePath,
          relativePath,
          targetKind: "file"
        });
      }
    }

    return units;
  }

  private async collectJsMetricUnits(
    rootAbsolutePath: string,
    rootDisplayLabel: string,
    dto: RunAnalysisDto
  ): Promise<FolderMetricUnit[]> {
    const depth =
      typeof dto.depth === "number" ? dto.depth : Boolean(dto.r) ? Number.POSITIVE_INFINITY : 0;
    const workDirs = await this.collectJsWorkDirs(rootAbsolutePath, depth);

    return workDirs.map((absolutePath) => {
      const relativePathRaw =
        this.normalizePath(path.relative(rootAbsolutePath, absolutePath)) || ".";
      return {
        absolutePath,
        relativePath: this.normalizeResultPath(relativePathRaw, rootDisplayLabel),
        targetKind: "directory" as const
      };
    });
  }

  private async collectJsWorkDirs(rootAbsolutePath: string, maxDepth: number): Promise<string[]> {
    if (maxDepth === 0) {
      return [rootAbsolutePath];
    }

    const result: string[] = [];

    const walk = async (directoryPath: string, depth: number) => {
      if (depth === maxDepth) {
        if (await this.hasJsFiles(directoryPath)) {
          result.push(directoryPath);
        }
        return;
      }

      const entries = await fs.readdir(directoryPath, { withFileTypes: true }).catch(() => []);
      const subdirs = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith("."))
        .filter((entry) => !this.ignoredDirNames.has(entry.name));

      if (!subdirs.length) {
        if (await this.hasJsFiles(directoryPath)) {
          result.push(directoryPath);
        }
        return;
      }

      for (const entry of subdirs) {
        await walk(path.join(directoryPath, entry.name), depth + 1);
      }
    };

    await walk(rootAbsolutePath, 0);
    return Array.from(new Set(result)).sort((a, b) => a.localeCompare(b));
  }

  private async hasJsFiles(directoryPath: string): Promise<boolean> {
    const files = await this.collectFilesByExtension(
      directoryPath,
      [".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"],
      1
    );
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

  private sortMetricsForDirection(direction: string, metrics: string[]): string[] {
    if (direction !== "js") {
      return [...metrics].sort((a, b) => a.localeCompare(b));
    }

    return [...metrics].sort((a, b) => {
      const aIndex = JAVASCRIPT_METRIC_ORDER_INDEX.get(a);
      const bIndex = JAVASCRIPT_METRIC_ORDER_INDEX.get(b);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;
      return a.localeCompare(b);
    });
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

  private resolveIncludePlagiarismHeatmap(value: boolean | undefined): boolean {
    return value !== false;
  }

  private normalizeFeatureFlag(value: unknown): boolean {
    return value !== false;
  }

  private escapeLikePattern(value: string): string {
    return String(value || "").replace(/[\\%_]/g, "\\$&");
  }

  private async findSuccessfulJobByRunId(
    userId: number,
    runId: string,
    options?: { requireSourceKey?: boolean }
  ): Promise<AnalysisJob | null> {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      return null;
    }

    const runIdPattern = `%\"runId\":\"${this.escapeLikePattern(normalizedRunId)}\"%`;
    const query = this.analysisJobRepo
      .createQueryBuilder("job")
      .where("job.userId = :userId", { userId })
      .andWhere("job.status = :status", { status: "success" as AnalysisJobStatus })
      .andWhere("job.resultPayload LIKE :pattern ESCAPE '\\'", { pattern: runIdPattern })
      .orderBy("job.finishedAt", "DESC")
      .addOrderBy("job.createdAt", "DESC");

    if (options?.requireSourceKey) {
      query.andWhere("job.requestPayload LIKE :keyPattern ESCAPE '\\'", {
        keyPattern: '%"key":"uploads/%'
      });
    }

    return query.getOne();
  }

  private async withExtractedS3ObjectRoot<T>(
    key: string,
    fn: (tempRoot: string) => Promise<T>,
    onProgress?: (stage: string, progressPercent: number) => Promise<void> | void,
    entryFilter?: ZipEntryFilter
  ): Promise<T> {
    await onProgress?.("Проверяем архив", 3);
    const head = await this.headS3SourceArchive(key);
    const objectSize = Number(head.ContentLength || 0);
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "analysis-heatmap-"));

    try {
      await onProgress?.("Читаем архив", 5);
      await this.extractS3ZipObjectToDir(key, tempRoot, {
        expectedBytes: objectSize,
        preserveMultiRootShape: true,
        entryFilter,
        onProgress: async (extractProgress) => {
          const progress = 5 + Math.floor((Math.max(0, Math.min(100, extractProgress)) * 15) / 100);
          await onProgress?.("Распаковываем выбранные файлы", progress);
        }
      });
      return await fn(tempRoot);
    } finally {
      try {
        await fs.rm(tempRoot, { recursive: true, force: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Не удалось удалить временную папку ${tempRoot}: ${message}`);
      }
    }
  }

  private async headS3SourceArchive(key: string) {
    try {
      return await this.getS3Client().send(
        new HeadObjectCommand({
          Bucket: this.getS3Bucket(),
          Key: key
        })
      );
    } catch (error) {
      const code = String((error as { name?: string; Code?: string })?.name || "");
      if (code === "NoSuchKey" || code === "NotFound" || code === "NotFoundException") {
        throw new NotFoundException(
          "Исходный архив уже удален из хранилища по политике очистки. Запустите анализ заново, чтобы построить новую тепловую карту."
        );
      }
      throw error;
    }
  }

  private formatBytes(bytes: number): string {
    const safe = Math.max(0, Number(bytes) || 0);
    if (safe >= 1024 * 1024 * 1024) {
      return `${(safe / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (safe >= 1024 * 1024) {
      return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (safe >= 1024) {
      return `${(safe / 1024).toFixed(1)} KB`;
    }
    return `${Math.trunc(safe)} B`;
  }

  private buildHeatmapArchiveSizeLimitMessage(actualBytes: number): string {
    return `Архив слишком большой для построения тепловой карты (${this.formatBytes(
      actualBytes
    )}). Максимально допустимо: ${this.formatBytes(this.heatmapMaxArchiveBytes)}.`;
  }

  private async assertHeatmapArchiveSizeAllowed(key: string): Promise<void> {
    const head = await this.headS3SourceArchive(key);
    const archiveBytes = Number(head.ContentLength || 0);
    if (
      Number.isFinite(archiveBytes) &&
      archiveBytes > 0 &&
      archiveBytes > this.heatmapMaxArchiveBytes
    ) {
      throw new BadRequestException(this.buildHeatmapArchiveSizeLimitMessage(archiveBytes));
    }
  }

  private isHeatmapServiceZipSegment(segment: string): boolean {
    const normalized = String(segment || "").toLowerCase();
    return normalized === "__macosx" || normalized === "macosx" || normalized.startsWith(".");
  }

  private mapProgressRange(
    rangeStart: number,
    rangeEnd: number,
    completed: number,
    total: number
  ): number {
    const safeStart = Math.trunc(rangeStart);
    const safeEnd = Math.max(safeStart, Math.trunc(rangeEnd));
    const safeTotal = Math.max(1, Math.trunc(Number(total) || 0));
    const safeCompleted = Math.max(0, Math.min(safeTotal, Math.trunc(Number(completed) || 0)));
    const ratio = Math.max(0, Math.min(1, safeCompleted / safeTotal));
    return safeStart + Math.floor((safeEnd - safeStart) * ratio);
  }

  private matchesHeatmapSelectedLevels(
    folderSegments: string[],
    selectedLevels?: string[][]
  ): boolean {
    if (!Array.isArray(selectedLevels) || selectedLevels.length === 0) {
      return true;
    }

    for (let index = 0; index < selectedLevels.length; index += 1) {
      const options = Array.isArray(selectedLevels[index]) ? selectedLevels[index] : [];
      if (!options.length) {
        continue;
      }
      const segment = folderSegments[index] || "";
      if (!options.includes(segment)) {
        return false;
      }
    }
    return true;
  }

  private async openS3ZipDirectory(
    key: string
  ): Promise<{ files?: Array<Record<string, unknown>> }> {
    let lastZipReadError: unknown = null;

    for (const tailSize of DEFAULT_S3_ZIP_TAIL_SIZES) {
      try {
        return (await unzipper.Open.s3_v3(
          this.getS3Client(),
          {
            Bucket: this.getS3Bucket(),
            Key: key
          },
          { tailSize }
        )) as { files?: Array<Record<string, unknown>> };
      } catch (error) {
        if (!this.isZipReadFailure(error)) {
          throw error;
        }
        lastZipReadError = error;
      }
    }

    throw lastZipReadError instanceof Error
      ? lastZipReadError
      : new Error("Unable to read ZIP central directory from S3");
  }

  private async countHeatmapFoldersFromZipStream(
    key: string,
    options: {
      recursive: boolean;
      depth: number;
      selectedLevels?: string[][];
      earlyStopLimit?: number;
    }
  ): Promise<number> {
    const includedExtensions = new Set([".html", ".css", ".js", ".ts"]);
    const excludedFiles = new Set(["normalize.css", "reset.css", "README.md"]);
    const recursive = Boolean(options.recursive);
    const depth = Math.max(1, Math.trunc(Number(options.depth) || 1));
    const selectedLevels = Array.isArray(options.selectedLevels) ? options.selectedLevels : [];
    const shiftedDepth = Math.max(1, depth - 1);
    const shiftedSelectedLevels = selectedLevels.slice(1);
    const hasSelectedLevels = selectedLevels.some((level) => Array.isArray(level) && level.length);
    const earlyStopLimit =
      options.earlyStopLimit && Number.isFinite(options.earlyStopLimit)
        ? Math.max(1, Math.trunc(options.earlyStopLimit))
        : null;
    const sourceStream = await this.getS3ObjectBody(key);
    const zipStream = sourceStream.pipe(unzipper.Parse({ forceStream: true }));
    sourceStream.on("error", (error) => {
      zipStream.destroy(error);
    });

    const topLevelDirs = new Set<string>();
    const uniqueFolders = new Set<string>();
    const uniqueFoldersUnshifted = new Set<string>();
    const uniqueFoldersShifted = new Set<string>();

    for await (const entry of zipStream) {
      const rawPath = this.normalizePath(String(entry.path || "")).replace(/^\/+|\/+$/g, "");
      if (!rawPath) {
        entry.autodrain();
        continue;
      }

      const pathSegments = rawPath.split("/").filter(Boolean);
      if (!pathSegments.length) {
        entry.autodrain();
        continue;
      }

      const hasServiceSegment = pathSegments.some((segment) =>
        this.isHeatmapServiceZipSegment(segment)
      );
      if (hasServiceSegment) {
        entry.autodrain();
        continue;
      }

      if (pathSegments[0]) {
        topLevelDirs.add(pathSegments[0]);
      }

      const fileName = pathSegments[pathSegments.length - 1] || "";
      const ext = path.extname(fileName).toLowerCase();
      const isDirectory = entry.type === "Directory" || rawPath.endsWith("/");
      entry.autodrain();
      if (isDirectory || !includedExtensions.has(ext) || excludedFiles.has(fileName)) {
        continue;
      }

      const dirSegments = pathSegments.slice(0, -1);
      if (!dirSegments.length) {
        continue;
      }

      if (!hasSelectedLevels) {
        if (recursive) {
          if (dirSegments.length >= depth) {
            uniqueFolders.add(dirSegments.slice(0, depth).join("/"));
          }
        } else if (depth === 1 && dirSegments[0]) {
          uniqueFolders.add(dirSegments[0]);
        }

        if (earlyStopLimit !== null && uniqueFolders.size >= earlyStopLimit) {
          break;
        }
        continue;
      }

      if (recursive) {
        if (dirSegments.length >= depth) {
          const unshiftedFolderSegments = dirSegments.slice(0, depth);
          if (this.matchesHeatmapSelectedLevels(unshiftedFolderSegments, selectedLevels)) {
            uniqueFoldersUnshifted.add(unshiftedFolderSegments.join("/"));
          }
        }

        const shiftedSegments = dirSegments.slice(1);
        if (shiftedSegments.length >= shiftedDepth) {
          const shiftedFolderSegments = shiftedSegments.slice(0, shiftedDepth);
          if (this.matchesHeatmapSelectedLevels(shiftedFolderSegments, shiftedSelectedLevels)) {
            uniqueFoldersShifted.add(shiftedFolderSegments.join("/"));
          }
        }
      } else if (depth === 1) {
        const topFolder = dirSegments[0];
        if (topFolder && this.matchesHeatmapSelectedLevels([topFolder], selectedLevels)) {
          uniqueFoldersUnshifted.add(topFolder);
        }
        const shiftedTopFolder = dirSegments[1];
        if (
          shiftedTopFolder &&
          this.matchesHeatmapSelectedLevels([shiftedTopFolder], shiftedSelectedLevels)
        ) {
          uniqueFoldersShifted.add(shiftedTopFolder);
        }
      }

      if (
        earlyStopLimit !== null &&
        uniqueFoldersUnshifted.size >= earlyStopLimit &&
        uniqueFoldersShifted.size >= earlyStopLimit
      ) {
        break;
      }
    }

    if (!hasSelectedLevels) {
      return uniqueFolders.size;
    }

    const useShifted = topLevelDirs.size === 1;
    return useShifted ? uniqueFoldersShifted.size : uniqueFoldersUnshifted.size;
  }

  private async countHeatmapFoldersFromZipEntriesFast(
    key: string,
    options: {
      recursive: boolean;
      depth: number;
      selectedLevels?: string[][];
      earlyStopLimit?: number;
    }
  ): Promise<number> {
    const includedExtensions = new Set([".html", ".css", ".js", ".ts"]);
    const excludedFiles = new Set(["normalize.css", "reset.css", "README.md"]);
    const recursive = Boolean(options.recursive);
    const depth = Math.max(1, Math.trunc(Number(options.depth) || 1));
    const selectedLevels = Array.isArray(options.selectedLevels) ? options.selectedLevels : [];
    const shiftedDepth = Math.max(1, depth - 1);
    const shiftedSelectedLevels = selectedLevels.slice(1);
    const hasSelectedLevels = selectedLevels.some((level) => Array.isArray(level) && level.length);
    const earlyStopLimit =
      options.earlyStopLimit && Number.isFinite(options.earlyStopLimit)
        ? Math.max(1, Math.trunc(options.earlyStopLimit))
        : null;

    try {
      const directory = await this.openS3ZipDirectory(key);
      const entries = Array.isArray(directory.files) ? directory.files : [];

      // Fast path: when selected levels are not specified (the primary standalone heatmap case),
      // cardinality does not depend on single-root shifting, so one counter is enough.
      if (!hasSelectedLevels) {
        const uniqueFolders = new Set<string>();
        for (const entry of entries) {
          const rawPath = this.normalizePath(String(entry.path || "")).replace(/^\/+|\/+$/g, "");
          if (!rawPath) {
            continue;
          }

          const pathSegments = rawPath.split("/").filter(Boolean);
          if (!pathSegments.length) {
            continue;
          }

          const hasServiceSegment = pathSegments.some((segment) =>
            this.isHeatmapServiceZipSegment(segment)
          );
          if (hasServiceSegment) {
            continue;
          }

          const fileName = pathSegments[pathSegments.length - 1] || "";
          const ext = path.extname(fileName).toLowerCase();
          const isDirectory = entry.type === "Directory" || rawPath.endsWith("/");
          if (isDirectory || !includedExtensions.has(ext) || excludedFiles.has(fileName)) {
            continue;
          }

          const dirSegments = pathSegments.slice(0, -1);
          if (!dirSegments.length) {
            continue;
          }

          if (recursive) {
            if (dirSegments.length >= depth) {
              uniqueFolders.add(dirSegments.slice(0, depth).join("/"));
            }
          } else if (depth === 1 && dirSegments[0]) {
            uniqueFolders.add(dirSegments[0]);
          }

          if (earlyStopLimit !== null && uniqueFolders.size >= earlyStopLimit) {
            break;
          }
        }
        return uniqueFolders.size;
      }

      const topLevelDirs = new Set<string>();
      const uniqueFoldersUnshifted = new Set<string>();
      const uniqueFoldersShifted = new Set<string>();

      for (const entry of entries) {
        const rawPath = this.normalizePath(String(entry.path || "")).replace(/^\/+|\/+$/g, "");
        if (!rawPath) {
          continue;
        }

        const pathSegments = rawPath.split("/").filter(Boolean);
        if (!pathSegments.length) {
          continue;
        }

        const hasServiceSegment = pathSegments.some((segment) =>
          this.isHeatmapServiceZipSegment(segment)
        );
        if (hasServiceSegment) {
          continue;
        }

        if (pathSegments[0]) {
          topLevelDirs.add(pathSegments[0]);
        }

        const fileName = pathSegments[pathSegments.length - 1] || "";
        const ext = path.extname(fileName).toLowerCase();
        const isDirectory = entry.type === "Directory" || rawPath.endsWith("/");
        if (isDirectory || !includedExtensions.has(ext) || excludedFiles.has(fileName)) {
          continue;
        }

        const dirSegments = pathSegments.slice(0, -1);
        if (!dirSegments.length) {
          continue;
        }

        if (recursive) {
          if (dirSegments.length >= depth) {
            const unshiftedFolderSegments = dirSegments.slice(0, depth);
            if (this.matchesHeatmapSelectedLevels(unshiftedFolderSegments, selectedLevels)) {
              uniqueFoldersUnshifted.add(unshiftedFolderSegments.join("/"));
            }
          }

          const shiftedSegments = dirSegments.slice(1);
          if (shiftedSegments.length >= shiftedDepth) {
            const shiftedFolderSegments = shiftedSegments.slice(0, shiftedDepth);
            if (this.matchesHeatmapSelectedLevels(shiftedFolderSegments, shiftedSelectedLevels)) {
              uniqueFoldersShifted.add(shiftedFolderSegments.join("/"));
            }
          }
        } else if (depth === 1) {
          const topFolder = dirSegments[0];
          if (topFolder && this.matchesHeatmapSelectedLevels([topFolder], selectedLevels)) {
            uniqueFoldersUnshifted.add(topFolder);
          }
          const shiftedTopFolder = dirSegments[1];
          if (
            shiftedTopFolder &&
            this.matchesHeatmapSelectedLevels([shiftedTopFolder], shiftedSelectedLevels)
          ) {
            uniqueFoldersShifted.add(shiftedTopFolder);
          }
        }

        if (
          earlyStopLimit !== null &&
          uniqueFoldersUnshifted.size >= earlyStopLimit &&
          uniqueFoldersShifted.size >= earlyStopLimit
        ) {
          break;
        }
      }

      const useShifted = topLevelDirs.size === 1;
      return useShifted ? uniqueFoldersShifted.size : uniqueFoldersUnshifted.size;
    } catch (error) {
      if (this.isZipReadFailure(error)) {
        return this.countHeatmapFoldersFromZipStream(key, options);
      }
      throw error;
    }
  }

  private isZipReadFailure(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return (
      message.includes("unexpected end of file") ||
      message.includes("file_ended") ||
      message.includes("invalid") ||
      message.includes("corrupt") ||
      message.includes("eio")
    );
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      const details = [error.name, error.message].filter(Boolean).join(": ");
      return error.stack ? `${details}\n${error.stack}` : details;
    }
    return String(error);
  }

  private getInvalidZipMessage(): string {
    return "Не удалось прочитать ZIP-архив. Файл поврежден, недоступен или загружен не полностью.";
  }

  private async getRunRequestedFeatures(
    userId: number,
    runId: string
  ): Promise<{ includeGitMetrics: boolean; includePlagiarismHeatmap: boolean } | null> {
    const job = await this.findSuccessfulJobByRunId(userId, runId, { requireSourceKey: true });

    if (!job) {
      return null;
    }

    return {
      includeGitMetrics: this.normalizeFeatureFlag(job.requestPayload?.includeGitMetrics),
      includePlagiarismHeatmap: this.normalizeFeatureFlag(
        job.requestPayload?.includePlagiarismHeatmap
      )
    };
  }

  private async buildPlagiarismHeatmapIfNeeded(
    rootAbsolutePath: string,
    input: Pick<ZipAnalysisInput, "includePlagiarismHeatmap" | "r" | "depth" | "onProgress">
  ) {
    if (!this.resolveIncludePlagiarismHeatmap(input.includePlagiarismHeatmap)) {
      return null;
    }

    try {
      const raw = await this.plagiarismHeatmapService.buildFromRoot(
        rootAbsolutePath,
        Boolean(input.r),
        input.depth,
        async (completedPairs, totalPairs, folder1, folder2) => {
          if (!input.onProgress) {
            return;
          }
          const safeTotal = Math.max(1, totalPairs);
          const progress = this.mapProgressRange(92, 97, completedPairs, safeTotal);
          const pairLabel = [folder1, folder2]
            .map((value) => this.extractWorkLabel(String(value || "")))
            .filter(Boolean)
            .join(" ↔ ");
          await input.onProgress(
            pairLabel
              ? `Считаем тепловую карту: ${pairLabel} (${completedPairs}/${safeTotal})`
              : `Считаем тепловую карту: пары ${completedPairs}/${safeTotal}`,
            progress
          );
        }
      );
      if (!raw) {
        return null;
      }
      return this.normalizePlagiarismHeatmapPayload(raw, rootAbsolutePath, input.depth);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown plagiarism heatmap error";
      this.logger.warn(`Plagiarism heatmap calculation failed: ${message}`);
      return null;
    }
  }

  private async buildStandaloneHeatmapFromS3(input: {
    userId: number;
    key: string;
    originalName?: string;
    r?: boolean;
    depth?: number;
    onProgress?: (stage: string, progressPercent: number) => Promise<void> | void;
  }) {
    const key = String(input.key || "").trim();
    if (!key) {
      throw new BadRequestException("key is required");
    }
    this.assertOwnedObjectKey(input.userId, key);
    await this.assertHeatmapArchiveSizeAllowed(key);
    const recursive = input.r === undefined ? true : Boolean(input.r);

    return this.withExtractedS3ObjectRoot(
      key,
      async (tempRoot) => {
        await input.onProgress?.("Определяем папки для сравнения", 21);
        const folderCount = await this.plagiarismHeatmapService.countFromRoot(
          tempRoot,
          recursive,
          input.depth
        );
        if (folderCount > HEATMAP_MAX_WORKS) {
          throw new BadRequestException(HEATMAP_LIMIT_MESSAGE);
        }

        const heatmap = await this.plagiarismHeatmapService.buildFromRoot(
          tempRoot,
          recursive,
          input.depth,
          async (completedPairs, totalPairs, folder1, folder2) => {
            if (!input.onProgress) {
              return;
            }
            const safeTotal = Math.max(1, totalPairs);
            const progress = this.mapProgressRange(22, 98, completedPairs, safeTotal);
            const toProgressLabel = (value?: string): string => {
              const raw = String(value || "").trim();
              if (!raw) {
                return "";
              }
              const relative = this.normalizePath(path.relative(tempRoot, raw)).replace(
                /^\/+|\/+$/g,
                ""
              );
              const normalized = relative || this.normalizePath(path.basename(raw));
              if (!normalized) {
                return "";
              }
              const segments = normalized.split("/").filter(Boolean);
              const targetDepth = Math.max(1, Math.trunc(Number(input.depth) || 2));
              if (segments.length >= targetDepth) {
                return segments[targetDepth - 1] || segments[segments.length - 1] || normalized;
              }
              return segments[segments.length - 1] || normalized;
            };
            const pairLabel = [folder1, folder2]
              .map((value) => toProgressLabel(value))
              .filter(Boolean)
              .join(" ↔ ");
            await input.onProgress(
              pairLabel
                ? `Считаем тепловую карту: ${pairLabel} (${completedPairs}/${safeTotal})`
                : `Считаем тепловую карту: пары ${completedPairs}/${safeTotal}`,
              progress
            );
          }
        );
        const inferredFolder = await this.inferRootDisplayLabel(tempRoot);
        const archiveLabel = this.getArchiveDisplayName(input.originalName || input.key);
        const folder =
          inferredFolder && !/^analysis-heatmap-/i.test(inferredFolder)
            ? inferredFolder
            : archiveLabel;
        if (!heatmap) {
          throw new BadRequestException("Недостаточно данных для построения тепловой карты.");
        }
        return {
          folder,
          folderCount,
          plagiarismHeatmap: this.normalizePlagiarismHeatmapPayload(heatmap, tempRoot, input.depth)
        };
      },
      input.onProgress
    );
  }

  private normalizePlagiarismHeatmapPayload(
    raw: NonNullable<AnalysisResponse["plagiarismHeatmap"]>,
    rootAbsolutePath: string,
    depth?: number
  ) {
    const normalizeFolderPath = (value: string): string => {
      const relative = this.normalizePath(path.relative(rootAbsolutePath, value) || "");
      const normalized = relative.replace(/^\/+|\/+$/g, "");
      if (normalized && depth && depth > 0) {
        const segments = normalized.split("/").filter(Boolean);
        if (segments.length >= depth) {
          return segments[depth - 1] || segments[segments.length - 1] || normalized;
        }
        if (segments.length) {
          return segments[segments.length - 1] || normalized;
        }
      }
      if (normalized) {
        return normalized;
      }
      return this.normalizePath(path.basename(value || "")).replace(/^\/+|\/+$/g, "");
    };

    return {
      ...raw,
      rootPath: this.normalizePath(path.basename(rootAbsolutePath || "")).replace(/^\/+|\/+$/g, ""),
      labels: raw.labels.map((label) => normalizeFolderPath(label)),
      folders: raw.folders.map((folder) => ({
        ...folder,
        path: normalizeFolderPath(folder.path)
      })),
      pairs: raw.pairs.map((pair) => ({
        ...pair,
        folder1: normalizeFolderPath(pair.folder1),
        folder2: normalizeFolderPath(pair.folder2)
      }))
    };
  }

  private getArchiveDisplayName(value: string): string {
    const raw = String(value || "").trim();
    if (!raw) {
      return "Архив";
    }
    const base = path.basename(raw);
    const normalized = base.replace(/\.zip$/i, "").trim();
    return normalized || "Архив";
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
      result[level] = Array.from(
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
    }
    return result;
  }

  private buildSelectedLevelsZipEntryFilter(
    selectedLevels: string[][]
  ): ZipEntryFilter | undefined {
    const normalizedLevels = (Array.isArray(selectedLevels) ? selectedLevels : []).map((values) =>
      Array.from(
        new Set(
          (Array.isArray(values) ? values : [])
            .map((value) =>
              this.normalizePath(String(value || ""))
                .replace(/^\/+|\/+$/g, "")
                .trim()
            )
            .filter(Boolean)
        )
      )
    );

    if (!normalizedLevels.some((values) => values.length > 0)) {
      return undefined;
    }

    return (relativePath: string): boolean => {
      const segments = this.normalizePath(relativePath)
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .filter(Boolean);
      if (!segments.length) {
        return false;
      }

      for (let offset = 0; offset < Math.min(2, segments.length); offset += 1) {
        const matches = normalizedLevels.every((options, level) => {
          const segment = segments[offset + level] || "";
          return options.length === 0 || options.includes(segment);
        });
        if (matches) {
          return true;
        }
      }

      return false;
    };
  }

  private inferDepthFromSelectedLevels(selectedLevels: string[][]): number | undefined {
    if (!Array.isArray(selectedLevels) || !selectedLevels.length) {
      return undefined;
    }

    let maxSelectedLevel = -1;
    for (let index = 0; index < selectedLevels.length; index += 1) {
      const values = Array.isArray(selectedLevels[index]) ? selectedLevels[index] : [];
      if (values.some((value) => String(value || "").trim().length > 0)) {
        maxSelectedLevel = index;
      }
    }

    if (maxSelectedLevel < 0) {
      return undefined;
    }
    return maxSelectedLevel + 1;
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

  private buildAnalysisZipEntryFilter(includeGitMetrics?: boolean): ZipEntryFilter {
    const includeGit = this.resolveIncludeGitMetrics(includeGitMetrics);
    const skippedDirectories = new Set([
      ".github",
      ".vscode",
      "__macosx",
      "macosx",
      "node_modules",
      "bootstrap"
    ]);

    return (relativePath: string): boolean => {
      const segments = this.normalizePath(relativePath)
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean);
      if (!segments.length) {
        return false;
      }

      for (const segment of segments.slice(0, -1)) {
        const normalized = segment.toLowerCase();
        if (normalized.startsWith(".") && normalized !== ".git") {
          return false;
        }
        if (normalized === ".git" && !includeGit) {
          return false;
        }
        if (skippedDirectories.has(normalized)) {
          return false;
        }
      }

      const fileName = segments[segments.length - 1] || "";
      return Boolean(fileName && !fileName.startsWith("._"));
    };
  }

  private async extractZipToDir(
    zipPath: string,
    outputRoot: string,
    onProgress?: (progressPercent: number) => Promise<void> | void,
    entryFilter?: ZipEntryFilter
  ): Promise<number> {
    const zipStat = await fs.stat(zipPath);
    const sourceStream = createReadStream(zipPath);
    return this.extractZipReadableToDir(sourceStream, outputRoot, {
      expectedBytes: zipStat.size,
      onProgress,
      entryFilter,
      debugSource: zipPath
    });
  }

  private async extractS3ZipObjectToDir(
    key: string,
    outputRoot: string,
    options: {
      expectedBytes?: number;
      onProgress?: (progressPercent: number) => Promise<void> | void;
      entryFilter?: ZipEntryFilter;
      preserveMultiRootShape?: boolean;
      debugSource?: string;
    } = {}
  ): Promise<number> {
    try {
      const directory = await this.openS3ZipDirectory(key);
      const entries = Array.isArray(directory.files) ? directory.files : [];
      const topLevelDirs = new Set<string>();
      const fileEntries: Array<{
        entry: { path?: string; type?: string; stream: () => NodeJS.ReadableStream };
        index: number;
      }> = [];

      entries.forEach(
        (
          entry: { path?: string; type?: string; stream?: () => NodeJS.ReadableStream },
          index: number
        ) => {
          const entryPath = String(entry.path || "");
          const entrySegments = this.normalizePath(entryPath)
            .replace(/^\/+|\/+$/g, "")
            .split("/")
            .filter(Boolean);
          const firstSegment = entrySegments[0] || "";
          if (
            firstSegment &&
            firstSegment.toLowerCase() !== "__macosx" &&
            !firstSegment.startsWith(".")
          ) {
            topLevelDirs.add(firstSegment);
          }
          const isDirectory = entry.type === "Directory" || /[/\\]$/.test(entryPath);
          const relativePath = this.sanitizeRelativePath(entryPath, index);
          if (
            !isDirectory &&
            typeof entry.stream === "function" &&
            (!options.entryFilter || options.entryFilter(relativePath))
          ) {
            fileEntries.push({
              entry: entry as { path?: string; type?: string; stream: () => NodeJS.ReadableStream },
              index
            });
          }
        }
      );

      let extractedFiles = 0;
      let processedFiles = 0;
      let lastReported = 0;
      let nextIndex = 0;
      const concurrency = Math.max(
        1,
        Math.min(
          Number(process.env.ZIP_EXTRACT_CONCURRENCY || DEFAULT_ZIP_EXTRACT_CONCURRENCY),
          fileEntries.length || 1
        )
      );

      const reportProgress = async () => {
        if (!options.onProgress || !fileEntries.length) {
          return;
        }
        const percent = Math.floor((processedFiles / fileEntries.length) * 100);
        if (percent >= lastReported + 2 || percent === 100) {
          lastReported = percent;
          await options.onProgress(percent);
        }
      };

      const extractOne = async (item: {
        entry: { path?: string; stream: () => NodeJS.ReadableStream };
        index: number;
      }) => {
        const entryPath = String(item.entry.path || "");
        const relativePath = this.sanitizeRelativePath(entryPath, item.index);
        const absolutePath = path.resolve(outputRoot, relativePath);
        const normalizedRoot = `${path.resolve(outputRoot)}${path.sep}`;
        if (!absolutePath.startsWith(normalizedRoot)) {
          processedFiles += 1;
          await reportProgress();
          return;
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await pipeline(item.entry.stream(), createWriteStream(absolutePath));
        extractedFiles += 1;
        processedFiles += 1;
        await reportProgress();
      };

      const worker = async () => {
        while (true) {
          const item = fileEntries[nextIndex];
          nextIndex += 1;
          if (!item) {
            return;
          }
          await extractOne(item);
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      if (options.preserveMultiRootShape && topLevelDirs.size > 1) {
        await fs.mkdir(path.join(outputRoot, "__analysis_root_marker__"), { recursive: true });
      }
      if (options.onProgress) {
        await options.onProgress(100);
      }
      return extractedFiles;
    } catch (error) {
      if (this.isZipReadFailure(error)) {
        this.logger.warn(
          `Не удалось прочитать центральную директорию ZIP через unzipper из S3 (${key}), пробуем yauzl range-reader: ${this.describeError(
            error
          )}`
        );
        return this.extractS3ZipObjectToDirWithYauzl(key, outputRoot, options);
      }
      throw error;
    }
  }

  private createS3YauzlReader(key: string): yauzl.RandomAccessReader {
    const service = this;

    return new (class extends yauzl.RandomAccessReader {
      _readStreamForRange(start: number, end: number) {
        const output = new Readable({
          read() {
            // Data is pushed asynchronously from S3 below.
          }
        });

        service
          .getS3Client()
          .send(
            new GetObjectCommand({
              Bucket: service.getS3Bucket(),
              Key: key,
              Range: `bytes=${start}-${end - 1}`
            })
          )
          .then(async (response) => {
            const body = response.Body as AsyncIterable<Uint8Array> | undefined;
            if (!body) {
              throw new Error("S3 object body is empty");
            }
            for await (const chunk of body) {
              output.push(Buffer.from(chunk));
            }
            output.push(null);
          })
          .catch((error) => output.destroy(error));

        return output;
      }

      _destroy(callback: (error?: Error | null) => void) {
        callback();
      }
    })();
  }

  private async openS3ZipFileWithYauzl(key: string, totalSize: number): Promise<yauzl.ZipFile> {
    const reader = this.createS3YauzlReader(key);

    return new Promise((resolve, reject) => {
      yauzl.fromRandomAccessReader(
        reader,
        totalSize,
        {
          lazyEntries: true,
          strictFileNames: false,
          validateEntrySizes: true
        },
        (error, zipFile) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(zipFile);
        }
      );
    });
  }

  private openYauzlEntryReadStream(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable> {
    return new Promise((resolve, reject) => {
      zipFile.openReadStream(entry, (error, stream) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stream);
      });
    });
  }

  private async extractS3ZipObjectToDirWithYauzl(
    key: string,
    outputRoot: string,
    options: {
      expectedBytes?: number;
      onProgress?: (progressPercent: number) => Promise<void> | void;
      entryFilter?: ZipEntryFilter;
      preserveMultiRootShape?: boolean;
      debugSource?: string;
    } = {}
  ): Promise<number> {
    const head = options.expectedBytes ? null : await this.headS3SourceArchive(key);
    const objectSize = Math.max(1, Number(options.expectedBytes || head?.ContentLength || 0));
    const zipFile = await this.openS3ZipFileWithYauzl(key, objectSize);
    const topLevelDirs = new Set<string>();
    const normalizedRoot = `${path.resolve(outputRoot)}${path.sep}`;
    let extractedFiles = 0;
    let processedEntries = 0;
    let lastReported = 0;

    const reportProgress = async () => {
      if (!options.onProgress || !zipFile.entryCount) {
        return;
      }
      const percent = Math.floor((processedEntries / zipFile.entryCount) * 100);
      if (percent >= lastReported + 2 || percent === 100) {
        lastReported = percent;
        await options.onProgress(percent);
      }
    };

    return new Promise((resolve, reject) => {
      let settled = false;

      const fail = (error: unknown) => {
        if (settled) {
          return;
        }
        settled = true;
        zipFile.close();
        reject(error);
      };

      zipFile.on("error", fail);
      zipFile.on("entry", (entry: yauzl.Entry) => {
        void (async () => {
          try {
            processedEntries += 1;
            const entryPath = String(entry.fileName || "");
            const entrySegments = this.normalizePath(entryPath)
              .replace(/^\/+|\/+$/g, "")
              .split("/")
              .filter(Boolean);
            const firstSegment = entrySegments[0] || "";
            if (
              firstSegment &&
              firstSegment.toLowerCase() !== "__macosx" &&
              !firstSegment.startsWith(".")
            ) {
              topLevelDirs.add(firstSegment);
            }

            const isDirectory = /[/\\]$/.test(entryPath);
            const relativePath = this.sanitizeRelativePath(entryPath, extractedFiles);
            if (isDirectory || (options.entryFilter && !options.entryFilter(relativePath))) {
              await reportProgress();
              zipFile.readEntry();
              return;
            }

            const absolutePath = path.resolve(outputRoot, relativePath);
            if (!absolutePath.startsWith(normalizedRoot)) {
              await reportProgress();
              zipFile.readEntry();
              return;
            }

            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            const readStream = await this.openYauzlEntryReadStream(zipFile, entry);
            await pipeline(readStream, createWriteStream(absolutePath));
            extractedFiles += 1;
            await reportProgress();
            zipFile.readEntry();
          } catch (error) {
            this.logger.error(
              `Yauzl S3 ZIP extraction failed (${options.debugSource || key}) at entry ${
                entry.fileName
              }: ${this.describeError(error)}`
            );
            fail(error);
          }
        })();
      });

      zipFile.on("end", () => {
        void (async () => {
          try {
            if (options.preserveMultiRootShape && topLevelDirs.size > 1) {
              await fs.mkdir(path.join(outputRoot, "__analysis_root_marker__"), {
                recursive: true
              });
            }
            if (options.onProgress) {
              await options.onProgress(100);
            }
            if (!settled) {
              settled = true;
              resolve(extractedFiles);
            }
          } catch (error) {
            fail(error);
          }
        })();
      });

      zipFile.readEntry();
    });
  }

  private async extractZipReadableToDir(
    sourceStream: NodeJS.ReadableStream,
    outputRoot: string,
    options: {
      expectedBytes?: number;
      onProgress?: (progressPercent: number) => Promise<void> | void;
      entryFilter?: ZipEntryFilter;
      preserveMultiRootShape?: boolean;
      debugSource?: string;
    } = {}
  ): Promise<number> {
    try {
      const zipSize = Math.max(1, Number(options.expectedBytes || 0));
      let bytesRead = 0;
      const countBytes = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytesRead += chunk.length;
          callback(null, chunk);
        }
      });
      const zipStream = sourceStream.pipe(countBytes).pipe(unzipper.Parse({ forceStream: true }));
      // Forward low-level fs read errors to unzip stream so they are handled by try/catch below.
      sourceStream.on("error", (error) => {
        zipStream.destroy(error);
      });
      let extractedFiles = 0;
      let lastReported = 0;
      const topLevelDirs = new Set<string>();

      for await (const entry of zipStream) {
        const isDirectory = entry.type === "Directory";
        const entryPath = String(entry.path || "");
        const entrySegments = this.normalizePath(entryPath)
          .replace(/^\/+|\/+$/g, "")
          .split("/")
          .filter(Boolean);
        const firstSegment = entrySegments[0] || "";
        if (
          firstSegment &&
          firstSegment.toLowerCase() !== "__macosx" &&
          !firstSegment.startsWith(".")
        ) {
          topLevelDirs.add(firstSegment);
        }

        if (isDirectory) {
          entry.autodrain();
          continue;
        }

        const relativePath = this.sanitizeRelativePath(entryPath, extractedFiles);
        if (options.entryFilter && !options.entryFilter(relativePath)) {
          entry.autodrain();
          continue;
        }

        const absolutePath = path.resolve(outputRoot, relativePath);
        const normalizedRoot = `${path.resolve(outputRoot)}${path.sep}`;
        if (!absolutePath.startsWith(normalizedRoot)) {
          entry.autodrain();
          continue;
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await pipeline(entry, createWriteStream(absolutePath));
        extractedFiles += 1;

        if (options.onProgress && zipSize > 0) {
          const ratio = Math.max(0, Math.min(1, bytesRead / zipSize));
          const percent = Math.floor(ratio * 100);
          if (percent >= lastReported + 2 || percent === 100) {
            lastReported = percent;
            await options.onProgress(percent);
          }
        }
      }

      if (options.preserveMultiRootShape && topLevelDirs.size > 1) {
        await fs.mkdir(path.join(outputRoot, "__analysis_root_marker__"), { recursive: true });
      }
      if (options.onProgress) {
        await options.onProgress(100);
      }
      return extractedFiles;
    } catch (error) {
      if (this.isZipReadFailure(error)) {
        this.logger.error(
          `ZIP stream read failed (${options.debugSource || "unknown source"}): ${this.describeError(
            error
          )}`
        );
        throw new BadRequestException(this.getInvalidZipMessage());
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

    if (result.plagiarismHeatmap) {
      const plagiarismEntity = this.analysisPlagiarismRepo.create({
        userId,
        runId,
        direction: result.direction,
        payload: result.plagiarismHeatmap
      });
      await this.analysisPlagiarismRepo.save(plagiarismEntity);
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

  private async writeEslintConfigIfNeeded(
    tempRoot: string,
    input: ZipAnalysisInput
  ): Promise<string | undefined> {
    if (input.direction !== "js") {
      return undefined;
    }

    const configText = String(input.eslintConfigText || "").trim();
    if (!configText) {
      return undefined;
    }

    const configDir = path.join(tempRoot, ".analysis-eslint");
    await fs.mkdir(configDir, { recursive: true });
    const configPath = path.join(
      configDir,
      `eslint.config.${this.resolveEslintConfigFormat(input.eslintConfigFormat)}`
    );
    await fs.writeFile(configPath, `${configText}\n`, "utf8");
    return configPath;
  }

  private resolveEslintConfigFormat(format?: string): "js" | "mjs" | "cjs" {
    return format === "js" || format === "cjs" || format === "mjs" ? format : "mjs";
  }

  private hashOptionalText(text?: string): string | null {
    const normalized = String(text || "").trim();
    if (!normalized) {
      return null;
    }
    return createHash("sha256").update(normalized).digest("hex");
  }

  private async buildZipCacheKey(
    input: ZipAnalysisInput,
    archivePath: string | undefined,
    selectedMetrics: string[]
  ): Promise<string> {
    const metricsPart = [...selectedMetrics].sort().join(",");
    const requestPart = [
      `direction=${input.direction}`,
      `metrics=${metricsPart}`,
      `group=${input.group || ""}`,
      `student=${input.student || ""}`,
      `eslintConfig=${this.hashOptionalText(input.eslintConfigText) || ""}`,
      `eslintConfigFormat=${this.resolveEslintConfigFormat(input.eslintConfigFormat)}`,
      `eslintRunner=v3`,
      `r=${input.r ? "1" : "0"}`,
      `depth=${input.depth ?? ""}`,
      `includeGitMetrics=${this.resolveIncludeGitMetrics(input.includeGitMetrics) ? "1" : "0"}`,
      `includePlagiarismHeatmap=${this.resolveIncludePlagiarismHeatmap(input.includePlagiarismHeatmap) ? "1" : "0"}`
    ].join("|");

    if (input.sourceFingerprint) {
      return `${input.sourceFingerprint}|${requestPart}`;
    }

    if (!archivePath) {
      throw new BadRequestException("archive path is required for cache key");
    }

    const stats = await fs.stat(archivePath);
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
    const plagiarism = await this.analysisPlagiarismRepo.findOne({
      where: { userId, runId: latest.runId }
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
      })),
      plagiarismHeatmap: plagiarism?.payload || null
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

  private async cleanupStaleLocalUploads(): Promise<void> {
    const before = new Date(Date.now() - this.uploadCleanupTtlHours * 60 * 60 * 1000);
    const staleUploads = await this.analysisUploadRepo
      .createQueryBuilder("upload")
      .where("upload.updatedAt < :before", { before })
      .andWhere("upload.status IN (:...statuses)", { statuses: ["uploaded", "done", "failed"] })
      .limit(200)
      .getMany();

    if (!staleUploads.length) {
      return;
    }

    for (const upload of staleUploads) {
      if (upload.storedPath) {
        try {
          await fs.rm(upload.storedPath, { force: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Не удалось удалить старый архив ${upload.storedPath}: ${message}`);
        }
      }
    }

    await this.analysisUploadRepo.delete(staleUploads.map((upload) => upload.id));
    this.logger.log(`Удалено старых локальных upload-архивов: ${staleUploads.length}`);
  }

  private extractS3KeyFromRequestPayload(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const key = String((payload as Record<string, unknown>).key || "").trim();
    return key.startsWith("uploads/") ? key : null;
  }

  private async getActiveS3UploadKeys(): Promise<Set<string>> {
    const jobs = await this.analysisJobRepo.find({
      where: {
        status: In(["queued", "running"] as AnalysisJobStatus[])
      },
      select: ["requestPayload"]
    });
    const active = new Set<string>();
    for (const job of jobs) {
      const key = this.extractS3KeyFromRequestPayload(job.requestPayload);
      if (key) {
        active.add(key);
      }
    }
    return active;
  }

  private async cleanupStaleS3Uploads(): Promise<void> {
    if (!this.s3Bucket) {
      return;
    }

    await this.ensureS3BucketExists();
    await this.cleanupStaleS3MultipartUploads();

    const cutoffMs = Date.now() - this.sourceArchiveTtlHours * 60 * 60 * 1000;
    const activeKeys = await this.getActiveS3UploadKeys();
    let continuationToken: string | undefined = undefined;
    let deleted = 0;

    do {
      const response: ListObjectsV2CommandOutput = await this.getS3Client().send(
        new ListObjectsV2Command({
          Bucket: this.getS3Bucket(),
          Prefix: "uploads/",
          ContinuationToken: continuationToken,
          MaxKeys: 500
        })
      );

      for (const object of response.Contents || []) {
        const key = String(object.Key || "").trim();
        const lastModifiedMs = object.LastModified?.getTime() || 0;
        if (!key || activeKeys.has(key) || !lastModifiedMs || lastModifiedMs >= cutoffMs) {
          continue;
        }
        await this.deleteS3ObjectIfOwned(this.parseUserIdFromUploadKey(key), key);
        deleted += 1;
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    if (deleted > 0) {
      this.logger.log(
        `Удалено старых S3 upload-архивов: ${deleted}. TTL: ${this.sourceArchiveTtlHours} ч.`
      );
    }
  }

  private async cleanupStaleS3MultipartUploads(): Promise<void> {
    const cutoffMs = Date.now() - this.sourceArchiveTtlHours * 60 * 60 * 1000;
    let keyMarker: string | undefined = undefined;
    let uploadIdMarker: string | undefined = undefined;
    let aborted = 0;

    do {
      const response: ListMultipartUploadsCommandOutput = await this.getS3Client().send(
        new ListMultipartUploadsCommand({
          Bucket: this.getS3Bucket(),
          Prefix: "uploads/",
          KeyMarker: keyMarker,
          UploadIdMarker: uploadIdMarker,
          MaxUploads: 500
        })
      );

      for (const upload of response.Uploads || []) {
        const key = String(upload.Key || "").trim();
        const uploadId = String(upload.UploadId || "").trim();
        const initiatedMs = upload.Initiated?.getTime() || 0;
        if (!key || !uploadId || !initiatedMs || initiatedMs >= cutoffMs) {
          continue;
        }

        try {
          await this.getS3Client().send(
            new AbortMultipartUploadCommand({
              Bucket: this.getS3Bucket(),
              Key: key,
              UploadId: uploadId
            })
          );
          aborted += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Не удалось отменить старый multipart upload ${key}: ${message}`);
        }
      }

      keyMarker = response.IsTruncated ? response.NextKeyMarker : undefined;
      uploadIdMarker = response.IsTruncated ? response.NextUploadIdMarker : undefined;
    } while (keyMarker || uploadIdMarker);

    if (aborted > 0) {
      this.logger.log(
        `Отменено старых незавершенных multipart uploads: ${aborted}. TTL: ${this.sourceArchiveTtlHours} ч.`
      );
    }
  }

  private parseUserIdFromUploadKey(key: string): number {
    const match = String(key || "").match(/^uploads\/(\d+)\//);
    const userId = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException("Недопустимый key объекта");
    }
    return userId;
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
      void this.analysisJobRepo
        .update({ id: entity.id }, { heartbeatAt: new Date() })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Не удалось обновить heartbeat задачи ${entity.id}: ${message}`);
        });
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
      let result:
        | AnalysisResponse
        | {
            runId: string;
            folder: string;
            folderCount: number;
            plagiarismHeatmap: AnalysisResponse["plagiarismHeatmap"];
          }
        | {
            runId: string;
            folderCount: number;
            maxAllowed: number;
            plagiarismHeatmap: AnalysisResponse["plagiarismHeatmap"];
          };

      if ("archive" in job.input) {
        result = await this.runFromZip({
          ...job.input,
          onProgress: writeProgress
        });
      } else if ("key" in job.input && "direction" in job.input) {
        await writeProgress("Подготовка данных", 2);
        const head = await this.headS3SourceArchive(job.input.key);
        const objectSize = Number(head.ContentLength || 0);
        const objectEtag = String(head.ETag || "").replaceAll('"', "");
        await writeProgress("Открываем архив для проверки", 4);

        result = await this.runFromZip({
          userId: job.input.userId,
          archive: {
            originalname: path.basename(job.input.key),
            s3Key: job.input.key,
            size: objectSize
          },
          sourceFingerprint: `s3|bucket=${this.getS3Bucket()}|key=${job.input.key}|etag=${objectEtag}|size=${objectSize}`,
          direction: job.input.direction,
          metrics: job.input.metrics,
          eslintConfigText: job.input.eslintConfigText,
          eslintConfigFormat: job.input.eslintConfigFormat,
          group: job.input.group,
          student: job.input.student,
          r: job.input.r,
          depth: job.input.depth,
          includeGitMetrics: job.input.includeGitMetrics,
          includePlagiarismHeatmap: job.input.includePlagiarismHeatmap,
          onProgress: writeProgress
        });
      } else if ("key" in job.input) {
        await writeProgress("Подготовка тепловой карты", 2);
        const standalone = await this.buildStandaloneHeatmapFromS3({
          userId: job.input.userId,
          key: job.input.key,
          originalName: job.input.originalName,
          r: job.input.r,
          depth: job.input.depth,
          onProgress: writeProgress
        });
        result = {
          runId: `heatmap:${job.jobId}`,
          folder: standalone.folder,
          folderCount: standalone.folderCount,
          plagiarismHeatmap: standalone.plagiarismHeatmap
        };
      } else {
        await writeProgress("Подготовка тепловой карты", 2);
        result = await this.buildPlagiarismHeatmapByRunFilters({
          userId: job.input.userId,
          runId: job.input.runId,
          depth: job.input.depth,
          selectedLevels: job.input.selectedLevels,
          onProgress: writeProgress
        });
      }

      entity.status = "success";
      entity.finishedAt = new Date();
      entity.heartbeatAt = entity.finishedAt;
      entity.progressPercent = 100;
      entity.stage = "Готово";
      if ("metrics" in result) {
        entity.resultPayload = {
          direction: result.direction,
          metrics: result.metrics,
          rowsTotal: result.data.length,
          gitRowsTotal: result.gitData?.length || 0,
          runId: result.runId || null,
          path: this.extractRunPath([
            ...result.data.map((row) => this.normalizeResultPath(String(row.path || ""))),
            ...(result.gitData || []).map((row) => this.normalizeResultPath(String(row.path || "")))
          ])
        };
      } else if ("folder" in result) {
        entity.resultPayload = {
          direction: entity.direction,
          metrics: [],
          rowsTotal: result.folderCount,
          gitRowsTotal: 0,
          runId: result.runId,
          path: result.folder,
          plagiarismHeatmap: result.plagiarismHeatmap
        };
      } else {
        const runInput = job.input as QueuedHeatmapJob["input"];
        const sourceJob = await this.findSuccessfulJobByRunId(runInput.userId, runInput.runId, {
          requireSourceKey: true
        });
        const sourceKey = String(sourceJob?.requestPayload?.key || "").trim();
        const heatmapPath = sourceKey
          ? this.getArchiveDisplayName(sourceKey)
          : this.getArchiveDisplayName(runInput.runId);
        entity.resultPayload = {
          direction: entity.direction,
          metrics: [],
          rowsTotal: result.folderCount,
          gitRowsTotal: 0,
          runId: result.runId,
          path: heatmapPath,
          plagiarismHeatmap: result.plagiarismHeatmap
        };
      }
      await this.analysisJobRepo.save(entity);
      if ("onSuccess" in job && job.onSuccess) {
        await job.onSuccess();
      }
      if ("key" in job.input && !("direction" in job.input)) {
        await this.deleteS3ObjectIfOwned(job.input.userId, job.input.key);
      } else if ("key" in job.input) {
        await this.deleteS3ObjectIfOwned(job.input.userId, job.input.key);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка";
      entity.status = "failed";
      entity.finishedAt = new Date();
      entity.heartbeatAt = entity.finishedAt;
      entity.stage = "Ошибка";
      entity.errorMessage = message;
      entity.resultPayload = null;
      try {
        await this.analysisJobRepo.save(entity);
      } catch (saveError) {
        const saveMessage = saveError instanceof Error ? saveError.message : String(saveError);
        this.logger.error(
          `Не удалось сохранить ошибку задачи ${entity.id}: ${saveMessage}. Исходная ошибка: ${message}`
        );
      }
      if ("onError" in job && job.onError) {
        try {
          await job.onError(message);
        } catch (callbackError) {
          const callbackMessage =
            callbackError instanceof Error ? callbackError.message : String(callbackError);
          this.logger.warn(
            `Не удалось выполнить обработчик ошибки задачи ${entity.id}: ${callbackMessage}`
          );
        }
      }
      if ("key" in job.input) {
        if (message === this.getInvalidZipMessage()) {
          this.logger.warn(
            `Debug: сохраняем S3-архив после ошибки чтения ZIP для проверки: ${job.input.key}`
          );
        } else {
          await this.deleteS3ObjectIfOwned(job.input.userId, job.input.key);
        }
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
    const includePlagiarismHeatmap = requestPayload?.includePlagiarismHeatmap === false ? "0" : "1";

    return `${direction}|metrics=${metrics}|r=${recursive}|depth=${depth}|git=${includeGitMetrics}|plag=${includePlagiarismHeatmap}`;
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
      requestHandler: this.createS3RequestHandler(10000, 60000),
      maxAttempts: 3,
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
      requestHandler: this.createS3RequestHandler(5000, 30000),
      maxAttempts: 3,
      credentials: {
        accessKeyId: this.s3AccessKeyId,
        secretAccessKey: this.s3SecretAccessKey
      }
    });
    return this.s3PresignClient;
  }

  private createS3RequestHandler(connectionTimeout: number, requestTimeout: number) {
    return new NodeHttpHandler({
      connectionTimeout,
      requestTimeout,
      httpAgent: new HttpAgent({
        keepAlive: true,
        maxSockets: this.s3MaxSockets
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
        maxSockets: this.s3MaxSockets
      })
    });
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

  private async getS3ObjectBody(key: string): Promise<Readable> {
    const response = await this.getS3Client().send(
      new GetObjectCommand({
        Bucket: this.getS3Bucket(),
        Key: key
      })
    );

    const body = response.Body as Readable | undefined;
    if (!body) {
      throw new BadRequestException("S3 object body is empty");
    }
    return body;
  }

  private async deleteS3ObjectIfOwned(userId: number, key: string): Promise<void> {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || !this.s3Bucket) {
      return;
    }
    this.assertOwnedObjectKey(userId, normalizedKey);

    try {
      await this.getS3Client().send(
        new DeleteObjectCommand({
          Bucket: this.getS3Bucket(),
          Key: normalizedKey
        })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Не удалось удалить архив ${normalizedKey} из S3: ${message}`);
    }
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
