import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Repository } from "typeorm";
import { AnalysisGitResult } from "../analysis/entities/analysis-git-result.entity";
import { AnalysisJob, AnalysisJobStatus } from "../analysis/entities/analysis-job.entity";
import { AnalysisResult } from "../analysis/entities/analysis-result.entity";
import {
  CLUSTERING_DIRECTION,
  CLUSTERING_FEATURES,
  CLUSTERING_LOG_FEATURES,
  CLUSTERING_REQUIRED_NON_ZERO_METRICS,
  ClusteredMetricRow,
  ClusterGroupDistribution,
  ClusterGroupShare,
  ClusteringMetricValue,
  ExcludedMetricRow
} from "./clustering.types";

type SklearnModule = {
  createPythonBridge: (opts?: Record<string, unknown>) => Promise<{ end: () => Promise<void> }>;
  DBSCAN: new (opts: Record<string, unknown>) => {
    init: (py: unknown) => Promise<void>;
    fit_predict: (opts: { X: number[][] }) => Promise<number[]>;
    dispose: () => Promise<void>;
  };
  NearestNeighbors: new (opts: Record<string, unknown>) => {
    init: (py: unknown) => Promise<void>;
    fit: (opts: { X: number[][] }) => Promise<unknown>;
    kneighbors: (opts: {
      X?: number[][];
      n_neighbors: number;
      return_distance: boolean;
    }) => Promise<[number[][], number[][]] | number[][]>;
    dispose: () => Promise<void>;
  };
  RobustScaler: new (opts?: Record<string, unknown>) => {
    init: (py: unknown) => Promise<void>;
    fit_transform: (opts: { X: number[][] }) => Promise<number[][]>;
    dispose: () => Promise<void>;
  };
};

interface PreparedRow {
  entity: AnalysisResult;
  path: string;
  groupPath: string;
  metrics: Record<string, ClusteringMetricValue>;
  features: Array<number | null>;
}

interface PrepareRowsResult {
  preparedRows: PreparedRow[];
  excludedRows: ExcludedMetricRow[];
}

interface RunMetadata {
  depth: number;
  sourcePath: string;
}

interface BuildClusteringOptions {
  eps?: number;
}

interface GitAggregateMetrics {
  active_days: number;
  churn_ratio: number;
  development_duration_days: number;
  median_commit_size: number;
  night_commit_pct: number;
  total_lines_added: number;
}

@Injectable()
export class ClusteringService {
  private readonly minSamples = 5;
  private readonly targetClustersCount = 3;
  private sklearnPromise: Promise<SklearnModule> | null = null;

  constructor(
    @InjectRepository(AnalysisResult)
    private readonly analysisResultRepo: Repository<AnalysisResult>,
    @InjectRepository(AnalysisGitResult)
    private readonly analysisGitResultRepo: Repository<AnalysisGitResult>,
    @InjectRepository(AnalysisJob)
    private readonly analysisJobRepo: Repository<AnalysisJob>
  ) {}

  async getClusters(userId: number, runId: string) {
    const result = await this.buildClustering(userId, runId);
    return {
      ...result,
      rows: result.rows.filter((row) => row.cluster !== -1)
    };
  }

  async buildClusterization(userId: number, runId: string, options: BuildClusteringOptions = {}) {
    const result = await this.buildClustering(userId, runId, options);
    const job = this.analysisJobRepo.create({
      id: randomUUID(),
      userId,
      direction: CLUSTERING_DIRECTION,
      status: "success" as AnalysisJobStatus,
      archiveName: result.sourcePath || null,
      progressPercent: 100,
      stage: "Кластеризация завершена",
      errorMessage: null,
      requestPayload: {
        kind: "clusterizing",
        sourceRunId: result.runId,
        depth: result.depth,
        eps: options.eps ?? null
      },
      resultPayload: result,
      startedAt: new Date(),
      finishedAt: new Date(),
      heartbeatAt: new Date()
    });
    await this.analysisJobRepo.save(job);
    return this.toClusterizationDetails(job.id, result, job.createdAt, job.finishedAt);
  }

  async getClusterizationList(userId: number) {
    const jobs = await this.analysisJobRepo.find({
      where: {
        userId,
        direction: CLUSTERING_DIRECTION,
        status: "success"
      },
      order: { finishedAt: "DESC", createdAt: "DESC" },
      take: 200
    });

    return {
      data: jobs
        .filter((job) => job.requestPayload?.kind === "clusterizing")
        .map((job) => {
          const payload = (job.resultPayload || {}) as Record<string, unknown>;
          return {
            jobId: job.id,
            runId: String(payload.runId || job.requestPayload?.sourceRunId || ""),
            sourcePath: String(payload.sourcePath || job.archiveName || ""),
            direction: job.direction,
            clustersCount: Array.isArray(payload.clusters) ? payload.clusters.length : 0,
            rowsUsed: Number(payload.rowsUsed || 0),
            rowsExcluded: Number(payload.rowsExcluded || 0),
            createdAt: job.createdAt,
            finishedAt: job.finishedAt || job.createdAt
          };
        })
    };
  }

  async getClusterizationDetails(userId: number, jobId: string) {
    const normalizedJobId = String(jobId || "").trim();
    if (!normalizedJobId) {
      throw new BadRequestException("jobId path parameter is required");
    }

    const job = await this.analysisJobRepo.findOne({
      where: {
        id: normalizedJobId,
        userId,
        direction: CLUSTERING_DIRECTION,
        status: "success"
      }
    });
    if (!job || job.requestPayload?.kind !== "clusterizing" || !job.resultPayload) {
      throw new NotFoundException("Кластеризация не найдена");
    }
    return this.toClusterizationDetails(
      job.id,
      job.resultPayload as ReturnTypeForClustering,
      job.createdAt,
      job.finishedAt
    );
  }

  async getOutliers(userId: number, runId: string) {
    const result = await this.buildClustering(userId, runId);
    return {
      runId: result.runId,
      direction: result.direction,
      depth: result.depth,
      groupDepth: result.groupDepth,
      metrics: result.metrics,
      features: result.features,
      rows: result.rows.filter((row) => row.cluster === -1)
    };
  }

  private async buildClustering(
    userId: number,
    runId: string,
    options: BuildClusteringOptions = {}
  ) {
    const normalizedRunId = String(runId || "").trim();
    if (!normalizedRunId) {
      throw new BadRequestException("runId path parameter is required");
    }

    const rows = await this.analysisResultRepo.find({
      where: { userId, runId: normalizedRunId },
      order: { id: "ASC" }
    });
    if (!rows.length) {
      throw new NotFoundException("Результаты запуска не найдены");
    }

    const direction = rows[0]?.direction || "";
    if (direction !== CLUSTERING_DIRECTION || rows.some((row) => row.direction !== direction)) {
      throw new BadRequestException("Кластеризация доступна только для direction=html_css");
    }

    const enrichedRows = await this.enrichRowsWithGitMetrics(userId, normalizedRunId, rows);
    const metadata = await this.resolveRunMetadata(userId, normalizedRunId, rows);
    const groupDepth = Math.max(1, metadata.depth - 1);
    const allMetrics = this.collectMetricNames(enrichedRows);
    const { excludedRows, preparedRows } = this.prepareRows(enrichedRows, groupDepth);
    if (preparedRows.length < this.minSamples) {
      throw new BadRequestException(
        `Для DBSCAN min_samples=5 нужно минимум 5 строк после фильтрации, сейчас ${preparedRows.length}`
      );
    }

    const featureMatrix = this.fillMissingFeaturesWithMedian(
      preparedRows.map((row) => row.features)
    );
    const transformed = this.applyLogTransform(featureMatrix);
    const sklearn = await this.loadSklearn();
    const py = await sklearn.createPythonBridge({
      python: process.env.SKLEARN_PYTHON_PATH || "python3"
    });
    let scaler: InstanceType<SklearnModule["RobustScaler"]> | null = null;
    let neighbors: InstanceType<SklearnModule["NearestNeighbors"]> | null = null;

    try {
      scaler = new sklearn.RobustScaler();
      await scaler.init(py);
      const scaled = await scaler.fit_transform({ X: transformed });

      let eps = this.resolveEps(options.eps);
      let labels: number[];
      if (eps === null) {
        neighbors = new sklearn.NearestNeighbors({ n_neighbors: this.minSamples });
        await neighbors.init(py);
        await neighbors.fit({ X: scaled });
        const neighborResult = await neighbors.kneighbors({
          n_neighbors: this.minSamples,
          return_distance: true
        });
        const kDistances = this.extractKDistances(neighborResult);
        const targeted = await this.pickEpsForTargetClusters(sklearn, py, scaled, kDistances);
        eps = targeted.eps;
        labels = targeted.labels;
      } else {
        labels = await this.fitDbscan(sklearn, py, scaled, eps);
      }

      const clusteredRows = this.toClusteredRows(preparedRows, labels);
      const clusters = this.getClustersList(clusteredRows);

      return {
        runId: normalizedRunId,
        direction,
        depth: metadata.depth,
        groupDepth,
        sourcePath: metadata.sourcePath,
        minSamples: this.minSamples,
        eps,
        features: [...CLUSTERING_FEATURES],
        logFeatures: [...CLUSTERING_LOG_FEATURES],
        requiredNonZeroMetrics: [...CLUSTERING_REQUIRED_NON_ZERO_METRICS],
        metrics: allMetrics,
        rowsTotal: rows.length,
        rowsUsed: clusteredRows.length,
        rowsExcluded: excludedRows.length,
        rows: clusteredRows,
        excludedRows,
        clusters,
        clusterSharesByGroup: this.buildClusterSharesByGroup(clusteredRows, clusters),
        groupDistributionByCluster: this.buildGroupDistributionByCluster(clusteredRows, clusters)
      };
    } finally {
      await neighbors?.dispose();
      await scaler?.dispose();
      await py.end();
    }
  }

  private async loadSklearn(): Promise<SklearnModule> {
    if (!this.sklearnPromise) {
      const dynamicImport = new Function("moduleName", "return import(moduleName)") as (
        moduleName: string
      ) => Promise<SklearnModule>;
      this.sklearnPromise = dynamicImport("sklearn");
    }
    return this.sklearnPromise;
  }

  private async resolveRunMetadata(
    userId: number,
    runId: string,
    rows: AnalysisResult[]
  ): Promise<RunMetadata> {
    const runIdPattern = `%\"runId\":\"${this.escapeLikePattern(runId)}\"%`;
    const job = await this.analysisJobRepo
      .createQueryBuilder("job")
      .where("job.userId = :userId", { userId })
      .andWhere("job.status = :status", { status: "success" })
      .andWhere("job.resultPayload LIKE :pattern ESCAPE '\\'", { pattern: runIdPattern })
      .orderBy("job.finishedAt", "DESC")
      .addOrderBy("job.createdAt", "DESC")
      .getOne();

    const payload = (job?.resultPayload || {}) as Record<string, unknown>;
    const rawDepth = job?.requestPayload?.depth;
    const parsed = Number(rawDepth);
    const depth = !Number.isFinite(parsed) || parsed < 1 ? 1 : Math.max(1, Math.trunc(parsed));
    return {
      depth,
      sourcePath: String(payload.path || this.inferSourcePath(rows)).trim()
    };
  }

  private inferSourcePath(rows: AnalysisResult[]): string {
    const firstPath = this.normalizePath(rows[0]?.path || "");
    return firstPath.split("/").filter(Boolean)[0] || firstPath;
  }

  private async enrichRowsWithGitMetrics(
    userId: number,
    runId: string,
    rows: AnalysisResult[]
  ): Promise<AnalysisResult[]> {
    const gitRows = await this.analysisGitResultRepo.find({
      where: { userId, runId },
      order: { id: "ASC" }
    });
    if (!gitRows.length) {
      return rows;
    }

    const gitMetricsByPath = this.buildGitMetricsByPath(gitRows);
    return rows.map((row) => {
      const gitMetrics = this.findGitMetricsForPath(row.path, gitMetricsByPath);
      if (!gitMetrics) {
        return row;
      }
      return {
        ...row,
        metrics: {
          ...(row.metrics || {}),
          ...gitMetrics
        }
      } as AnalysisResult;
    });
  }

  private buildGitMetricsByPath(gitRows: AnalysisGitResult[]): Map<string, GitAggregateMetrics> {
    const rowsByPath = new Map<string, AnalysisGitResult[]>();
    for (const row of gitRows) {
      const normalizedPath = this.normalizePath(row.path);
      const bucket = rowsByPath.get(normalizedPath) || [];
      bucket.push(row);
      rowsByPath.set(normalizedPath, bucket);
    }

    const result = new Map<string, GitAggregateMetrics>();
    for (const [pathValue, rows] of rowsByPath.entries()) {
      result.set(pathValue, this.aggregateGitMetrics(rows));
    }
    return result;
  }

  private aggregateGitMetrics(rows: AnalysisGitResult[]): GitAggregateMetrics {
    const commits = new Map<
      string,
      { date: string; added: number; deleted: number; size: number }
    >();
    let totalLinesAdded = 0;
    let totalLinesDeleted = 0;

    for (const row of rows) {
      if (row.filetype !== "text" || this.isGitMetadataChange(row.extraMetadata)) {
        continue;
      }

      const added = Number(row.added || 0);
      const deleted = Number(row.deleted || 0);
      totalLinesAdded += added;
      totalLinesDeleted += deleted;

      const current = commits.get(row.hash) || {
        date: row.date,
        added: 0,
        deleted: 0,
        size: 0
      };
      current.date = current.date || row.date;
      current.added += added;
      current.deleted += deleted;
      current.size += added + deleted;
      commits.set(row.hash, current);
    }

    const dates = Array.from(commits.values())
      .map((commit) => this.safeTimestamp(commit.date))
      .filter((value): value is number => value !== null);
    const activeDays = new Set(dates.map((stamp) => new Date(stamp).toISOString().slice(0, 10)));
    const nightCommits = Array.from(commits.values()).filter((commit) => {
      const stamp = this.safeTimestamp(commit.date);
      if (stamp === null) {
        return false;
      }
      const hour = new Date(stamp).getUTCHours();
      return hour >= 0 && hour <= 5;
    }).length;
    const commitSizes = Array.from(commits.values()).map((commit) => commit.size);
    const durationDays = dates.length
      ? Math.floor((Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      active_days: activeDays.size,
      churn_ratio: totalLinesAdded > 0 ? this.round(totalLinesDeleted / totalLinesAdded, 4) : 0,
      development_duration_days: Math.max(0, durationDays),
      median_commit_size: this.round(this.quantile(commitSizes, 0.5), 2),
      night_commit_pct: commits.size > 0 ? this.round((100 * nightCommits) / commits.size, 2) : 0,
      total_lines_added: totalLinesAdded
    };
  }

  private findGitMetricsForPath(
    pathValue: string,
    gitMetricsByPath: Map<string, GitAggregateMetrics>
  ): GitAggregateMetrics | null {
    const normalizedPath = this.normalizePath(pathValue);
    const exact = gitMetricsByPath.get(normalizedPath);
    if (exact) {
      return exact;
    }

    let bestMatch: { path: string; metrics: GitAggregateMetrics } | null = null;
    for (const [gitPath, metrics] of gitMetricsByPath.entries()) {
      if (!normalizedPath.startsWith(`${gitPath}/`)) {
        continue;
      }
      if (!bestMatch || gitPath.length > bestMatch.path.length) {
        bestMatch = { path: gitPath, metrics };
      }
    }
    return bestMatch?.metrics || null;
  }

  private isGitMetadataChange(value: string): boolean {
    return /rename|copy|mode change/i.test(String(value || ""));
  }

  private safeTimestamp(value: string): number | null {
    const stamp = new Date(value).getTime();
    return Number.isFinite(stamp) ? stamp : null;
  }

  private quantile(values: number[], q: number): number {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) {
      return 0;
    }

    const position = (sorted.length - 1) * q;
    const low = Math.floor(position);
    const high = Math.ceil(position);
    if (low === high) {
      return sorted[low] ?? 0;
    }

    const lowValue = sorted[low] ?? 0;
    const highValue = sorted[high] ?? 0;
    return lowValue + (highValue - lowValue) * (position - low);
  }

  private round(value: number, precision: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  private prepareRows(rows: AnalysisResult[], groupDepth: number): PrepareRowsResult {
    const prepared: PreparedRow[] = [];
    const excluded: ExcludedMetricRow[] = [];
    for (const row of rows) {
      const normalizedMetrics = this.normalizeMetrics(row.metrics || {});
      const zeroMetrics = CLUSTERING_REQUIRED_NON_ZERO_METRICS.filter(
        (metric) => this.toNumber(normalizedMetrics[metric]) === 0
      );
      const path = this.normalizePath(row.path);
      if (zeroMetrics.length) {
        excluded.push({
          runId: row.runId,
          path,
          groupPath: this.getGroupPath(path, groupDepth),
          group: row.groupValue,
          student: row.studentValue,
          reason: `Нулевые обязательные метрики: ${zeroMetrics.join(", ")}`,
          metrics: normalizedMetrics
        });
        continue;
      }

      prepared.push({
        entity: row,
        path,
        groupPath: this.getGroupPath(path, groupDepth),
        metrics: normalizedMetrics,
        features: CLUSTERING_FEATURES.map((metric) =>
          this.toNullableNumber(normalizedMetrics[metric])
        )
      });
    }
    return { excludedRows: excluded, preparedRows: prepared };
  }

  private normalizeMetrics(
    metrics: Record<string, string | number | null>
  ): Record<string, ClusteringMetricValue> {
    const normalized: Record<string, ClusteringMetricValue> = {};
    for (const [key, value] of Object.entries(metrics || {})) {
      normalized[key] = this.normalizeMetricValue(value);
    }
    return normalized;
  }

  private normalizeMetricValue(value: unknown): ClusteringMetricValue {
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
      return value;
    }
    return value === null || value === undefined ? null : String(value);
  }

  private toNumber(value: unknown): number {
    return this.toNullableNumber(value) ?? 0;
  }

  private toNullableNumber(value: unknown): number | null {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    if (typeof value === "string") {
      const normalized = value.trim().replace(",", ".");
      if (!normalized) {
        return null;
      }
      if (["true", "yes", "да"].includes(normalized.toLowerCase())) {
        return 1;
      }
      if (["false", "no", "нет"].includes(normalized.toLowerCase())) {
        return 0;
      }
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private fillMissingFeaturesWithMedian(matrix: Array<Array<number | null>>): number[][] {
    const medians = CLUSTERING_FEATURES.map((_, featureIndex) => {
      const values = matrix
        .map((row) => row[featureIndex])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .sort((a, b) => a - b);

      if (!values.length) {
        return 0;
      }

      const middle = Math.floor(values.length / 2);
      if (values.length % 2 === 1) {
        return values[middle] ?? 0;
      }
      return ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
    });

    return matrix.map((row) =>
      row.map((value, index) =>
        typeof value === "number" && Number.isFinite(value) ? value : (medians[index] ?? 0)
      )
    );
  }

  private applyLogTransform(matrix: number[][]): number[][] {
    const logFeatureIndexes = new Set(
      CLUSTERING_LOG_FEATURES.map((feature) => CLUSTERING_FEATURES.indexOf(feature)).filter(
        (index) => index >= 0
      )
    );

    return matrix.map((row) =>
      row.map((value, index) => {
        if (!logFeatureIndexes.has(index)) {
          return value;
        }
        if (value < 0) {
          const feature = CLUSTERING_FEATURES[index] || `feature_${index}`;
          throw new BadRequestException(
            `В признаке ${feature} есть отрицательные значения. log1p применять нельзя без сдвига.`
          );
        }
        return Math.log1p(value);
      })
    );
  }

  private extractKDistances(result: [number[][], number[][]] | number[][]): number[] {
    const distances = Array.isArray(result[0]) && Array.isArray(result[1]) ? result[0] : result;
    return (distances as number[][])
      .map((row) => Number(row[this.minSamples - 1] ?? row[row.length - 1] ?? 0))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
  }

  private pickEpsFromKDistance(sortedDistances: number[]): number {
    if (!sortedDistances.length) {
      return 0.5;
    }
    if (sortedDistances.length < 3) {
      return Math.max(sortedDistances[sortedDistances.length - 1] || 0.5, Number.EPSILON);
    }

    const firstX = 0;
    const firstY = sortedDistances[0] || 0;
    const lastX = sortedDistances.length - 1;
    const lastY = sortedDistances[lastX] || 0;
    const denominator = Math.hypot(lastY - firstY, lastX - firstX) || 1;
    let bestIndex = sortedDistances.length - 1;
    let bestDistance = -1;

    for (let index = 1; index < sortedDistances.length - 1; index += 1) {
      const y = sortedDistances[index] || 0;
      const distance =
        Math.abs(
          (lastY - firstY) * index - (lastX - firstX) * y + lastX * firstY - lastY * firstX
        ) / denominator;
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const eps = sortedDistances[bestIndex] || sortedDistances[sortedDistances.length - 1] || 0.5;
    return Math.max(eps, Number.EPSILON);
  }

  private async pickEpsForTargetClusters(
    sklearn: SklearnModule,
    py: unknown,
    scaled: number[][],
    sortedDistances: number[]
  ): Promise<{ eps: number; labels: number[] }> {
    const fallbackEps = this.pickEpsFromKDistance(sortedDistances);
    const candidates = this.buildEpsCandidates(sortedDistances, fallbackEps);
    let best: {
      eps: number;
      labels: number[];
      clusterDelta: number;
      noiseCount: number;
      fallbackDistance: number;
    } | null = null;

    for (const eps of candidates) {
      const labels = await this.fitDbscan(sklearn, py, scaled, eps);
      const clusterCount = this.countClusters(labels);
      const candidate = {
        eps,
        labels,
        clusterDelta: Math.abs(clusterCount - this.targetClustersCount),
        noiseCount: labels.filter((label) => label === -1).length,
        fallbackDistance: Math.abs(eps - fallbackEps)
      };

      if (!best || this.isBetterEpsCandidate(candidate, best)) {
        best = candidate;
      }
    }

    if (!best) {
      return {
        eps: fallbackEps,
        labels: await this.fitDbscan(sklearn, py, scaled, fallbackEps)
      };
    }

    return {
      eps: best.eps,
      labels: best.labels
    };
  }

  private buildEpsCandidates(sortedDistances: number[], fallbackEps: number): number[] {
    const positive = sortedDistances
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);
    const candidates = new Set<number>([Math.max(fallbackEps, Number.EPSILON)]);

    for (const value of positive) {
      candidates.add(Math.max(value, Number.EPSILON));
    }
    for (let index = 1; index < positive.length; index += 1) {
      candidates.add(Math.max((positive[index - 1] + positive[index]) / 2, Number.EPSILON));
    }
    if (positive.length) {
      candidates.add(Math.max((positive[0] || fallbackEps) / 2, Number.EPSILON));
      candidates.add(
        Math.max((positive[positive.length - 1] || fallbackEps) * 1.1, Number.EPSILON)
      );
    }

    return Array.from(candidates).sort((a, b) => a - b);
  }

  private async fitDbscan(
    sklearn: SklearnModule,
    py: unknown,
    scaled: number[][],
    eps: number
  ): Promise<number[]> {
    const dbscan = new sklearn.DBSCAN({ eps, min_samples: this.minSamples });
    try {
      await dbscan.init(py);
      return (await dbscan.fit_predict({ X: scaled })).map((value) => Number(value));
    } finally {
      await dbscan.dispose();
    }
  }

  private countClusters(labels: number[]): number {
    return new Set(labels.filter((label) => label !== -1)).size;
  }

  private isBetterEpsCandidate(
    candidate: { clusterDelta: number; noiseCount: number; fallbackDistance: number },
    current: { clusterDelta: number; noiseCount: number; fallbackDistance: number }
  ): boolean {
    if (candidate.clusterDelta !== current.clusterDelta) {
      return candidate.clusterDelta < current.clusterDelta;
    }
    if (candidate.noiseCount !== current.noiseCount) {
      return candidate.noiseCount < current.noiseCount;
    }
    return candidate.fallbackDistance < current.fallbackDistance;
  }

  private resolveEps(inputEps: number | undefined): number | null {
    if (inputEps === undefined) {
      return null;
    }
    if (!Number.isFinite(inputEps) || inputEps <= 0) {
      throw new BadRequestException("eps должен быть положительным числом");
    }
    return inputEps;
  }

  private toClusteredRows(preparedRows: PreparedRow[], labels: number[]): ClusteredMetricRow[] {
    return preparedRows.map((row, index) => ({
      runId: row.entity.runId,
      path: row.path,
      groupPath: row.groupPath,
      cluster: Number(labels[index] ?? -1),
      group: row.entity.groupValue,
      student: row.entity.studentValue,
      metrics: row.metrics
    }));
  }

  private getClustersList(rows: ClusteredMetricRow[]): number[] {
    return Array.from(
      new Set(rows.map((row) => row.cluster).filter((cluster) => cluster !== -1))
    ).sort((a, b) => a - b);
  }

  private buildClusterSharesByGroup(
    rows: ClusteredMetricRow[],
    clusters: number[]
  ): ClusterGroupShare[] {
    const grouped = new Map<string, ClusteredMetricRow[]>();
    for (const row of rows.filter((item) => item.cluster !== -1)) {
      const bucket = grouped.get(row.groupPath) || [];
      bucket.push(row);
      grouped.set(row.groupPath, bucket);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupPath, groupRows]) => {
        const shares: Record<string, number> = {};
        for (const cluster of clusters) {
          const count = groupRows.filter((row) => row.cluster === cluster).length;
          shares[String(cluster)] = groupRows.length ? count / groupRows.length : 0;
        }
        return {
          groupPath,
          total: groupRows.length,
          shares
        };
      });
  }

  private buildGroupDistributionByCluster(
    rows: ClusteredMetricRow[],
    clusters: number[]
  ): ClusterGroupDistribution[] {
    const groupPaths = Array.from(
      new Set(rows.filter((row) => row.cluster !== -1).map((row) => row.groupPath))
    ).sort((a, b) => a.localeCompare(b));

    return clusters.map((cluster) => {
      const counts: Record<string, number> = {};
      for (const groupPath of groupPaths) {
        counts[groupPath] = rows.filter(
          (row) => row.cluster === cluster && row.groupPath === groupPath
        ).length;
      }
      return { cluster, counts };
    });
  }

  private collectMetricNames(rows: AnalysisResult[]): string[] {
    const metrics = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.metrics || {})) {
        metrics.add(key);
      }
    }
    return Array.from(metrics).sort((a, b) => a.localeCompare(b));
  }

  private getGroupPath(pathValue: string, groupDepth: number): string {
    const segments = this.normalizePath(pathValue)
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter(Boolean);
    if (!segments.length) {
      return "";
    }
    return segments.slice(0, Math.max(1, groupDepth)).join("/");
  }

  private normalizePath(value: string): string {
    return String(value || "")
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");
  }

  private escapeLikePattern(value: string): string {
    return String(value || "").replace(/[\\%_]/g, "\\$&");
  }

  private toClusterizationDetails(
    jobId: string,
    result: ReturnTypeForClustering,
    createdAt: Date,
    finishedAt: Date | null
  ) {
    const rows = Array.isArray(result.rows)
      ? result.rows.filter((row) => Number(row.cluster) !== -1)
      : [];
    const outlierRows = Array.isArray(result.rows)
      ? result.rows.filter((row) => Number(row.cluster) === -1)
      : [];
    const outliersCount = Array.isArray(result.rows) ? outlierRows.length : 0;

    return {
      jobId,
      createdAt,
      finishedAt: finishedAt || createdAt,
      ...result,
      rows,
      outlierRows,
      outliersCount
    };
  }
}

type ReturnTypeForClustering = Awaited<ReturnType<ClusteringService["buildClustering"]>>;
