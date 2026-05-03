import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalysisJob } from "../analysis/entities/analysis-job.entity";
import { AnalysisResult } from "../analysis/entities/analysis-result.entity";
import {
  CLUSTERING_DIRECTION,
  CLUSTERING_FEATURES,
  CLUSTERING_LOG_FEATURES,
  CLUSTERING_REQUIRED_NON_ZERO_METRICS,
  ClusteredMetricRow,
  ClusterGroupDistribution,
  ClusterGroupShare,
  ClusteringMetricValue
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

@Injectable()
export class ClusteringService {
  private readonly minSamples = 5;
  private sklearnPromise: Promise<SklearnModule> | null = null;

  constructor(
    @InjectRepository(AnalysisResult)
    private readonly analysisResultRepo: Repository<AnalysisResult>,
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

  private async buildClustering(userId: number, runId: string) {
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

    const depth = await this.resolveRunDepth(userId, normalizedRunId);
    const groupDepth = Math.max(1, depth - 1);
    const allMetrics = this.collectMetricNames(rows);
    const preparedRows = this.prepareRows(rows, groupDepth);
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
    let dbscan: InstanceType<SklearnModule["DBSCAN"]> | null = null;

    try {
      scaler = new sklearn.RobustScaler();
      await scaler.init(py);
      const scaled = await scaler.fit_transform({ X: transformed });

      neighbors = new sklearn.NearestNeighbors({ n_neighbors: this.minSamples });
      await neighbors.init(py);
      await neighbors.fit({ X: scaled });
      const neighborResult = await neighbors.kneighbors({
        n_neighbors: this.minSamples,
        return_distance: true
      });
      const kDistances = this.extractKDistances(neighborResult);
      const eps = this.pickEpsFromKDistance(kDistances);

      dbscan = new sklearn.DBSCAN({ eps, min_samples: this.minSamples });
      await dbscan.init(py);
      const labels = (await dbscan.fit_predict({ X: scaled })).map((value) => Number(value));
      const clusteredRows = this.toClusteredRows(preparedRows, labels);
      const clusters = this.getClustersList(clusteredRows);

      return {
        runId: normalizedRunId,
        direction,
        depth,
        groupDepth,
        minSamples: this.minSamples,
        eps,
        features: [...CLUSTERING_FEATURES],
        logFeatures: [...CLUSTERING_LOG_FEATURES],
        requiredNonZeroMetrics: [...CLUSTERING_REQUIRED_NON_ZERO_METRICS],
        metrics: allMetrics,
        rowsTotal: rows.length,
        rowsUsed: clusteredRows.length,
        rowsExcluded: rows.length - clusteredRows.length,
        rows: clusteredRows,
        clusters,
        clusterSharesByGroup: this.buildClusterSharesByGroup(clusteredRows, clusters),
        groupDistributionByCluster: this.buildGroupDistributionByCluster(clusteredRows, clusters)
      };
    } finally {
      await dbscan?.dispose();
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

  private async resolveRunDepth(userId: number, runId: string): Promise<number> {
    const runIdPattern = `%\"runId\":\"${this.escapeLikePattern(runId)}\"%`;
    const job = await this.analysisJobRepo
      .createQueryBuilder("job")
      .where("job.userId = :userId", { userId })
      .andWhere("job.status = :status", { status: "success" })
      .andWhere("job.resultPayload LIKE :pattern ESCAPE '\\'", { pattern: runIdPattern })
      .orderBy("job.finishedAt", "DESC")
      .addOrderBy("job.createdAt", "DESC")
      .getOne();

    const rawDepth = job?.requestPayload?.depth;
    const parsed = Number(rawDepth);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return Math.max(1, Math.trunc(parsed));
  }

  private prepareRows(rows: AnalysisResult[], groupDepth: number): PreparedRow[] {
    const prepared: PreparedRow[] = [];
    for (const row of rows) {
      const normalizedMetrics = this.normalizeMetrics(row.metrics || {});
      const hasRequiredZero = CLUSTERING_REQUIRED_NON_ZERO_METRICS.some(
        (metric) => this.toNumber(normalizedMetrics[metric]) === 0
      );
      if (hasRequiredZero) {
        continue;
      }

      const path = this.normalizePath(row.path);
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
    return prepared;
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
}
