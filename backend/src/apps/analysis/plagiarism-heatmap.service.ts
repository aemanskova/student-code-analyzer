import { Injectable } from "@nestjs/common";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Worker } from "node:worker_threads";
import type { PlagiarismCell, PlagiarismHeatmapData, PlagiarismPair } from "./analysis.types";

const HEATMAP_MAX_DURATION_MS = (() => {
  const configured = Number(process.env.HEATMAP_MAX_DURATION_MS || 0);
  if (!Number.isFinite(configured) || configured <= 0) {
    return null;
  }
  return Math.max(1_000, configured);
})();

const WORKER_EXTRA_GRACE_MS = 5_000;
const HEATMAP_WORKER_MAX_OLD_MB = (() => {
  const configured = Number(process.env.HEATMAP_WORKER_MAX_OLD_MB || 1024);
  if (!Number.isFinite(configured) || configured <= 0) {
    return 1024;
  }
  return Math.max(128, Math.trunc(configured));
})();
const HEATMAP_COMPARE_WORKERS = (() => {
  const available = typeof os.availableParallelism === "function" ? os.availableParallelism() : 2;
  const configured = Number(process.env.HEATMAP_COMPARE_WORKERS || Math.min(4, available));
  if (!Number.isFinite(configured) || configured <= 1) {
    return 1;
  }
  return Math.max(1, Math.trunc(configured));
})();

type WorkerResultMessage = {
  ok: boolean;
  result?: PlagiarismHeatmapData | PartialHeatmapResult | null;
  count?: number;
  error?: string;
};

type WorkerProgressMessage = {
  type: "progress";
  shardIndex: number;
  completedPairs: number;
  totalPairs: number;
  folder1?: string;
  folder2?: string;
};

type PartialMatrixEntry = {
  i: number;
  j: number;
  cell: PlagiarismCell;
};

type PartialHeatmapResult = {
  rootPath: string;
  recursive: boolean;
  generatedAt: string;
  metric: string;
  formula: string;
  comparedExtensions: string[];
  excludedFiles: string[];
  folders: Array<{ path: string; fileCount: number; files: string[] }>;
  labels: string[];
  partialPairs: PlagiarismPair[];
  partialEntries: PartialMatrixEntry[];
  shardIndex: number;
  shardCount: number;
};

@Injectable()
export class PlagiarismHeatmapService {
  private normalizeSelectedLevelsForEffectiveRoot(
    selectedLevels: string[][] | undefined,
    rootWasShifted: boolean
  ): string[][] | undefined {
    if (!Array.isArray(selectedLevels) || selectedLevels.length === 0) {
      return selectedLevels;
    }

    const normalized = selectedLevels.map((levelValues) =>
      (Array.isArray(levelValues) ? levelValues : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );

    if (!rootWasShifted) {
      return normalized;
    }

    // Effective root was moved one level deeper, so all selected levels must be shifted too.
    return normalized.slice(1);
  }

  private normalizeDepth(depth?: number): number | undefined {
    if (depth === undefined || depth === null) {
      return undefined;
    }
    if (!Number.isFinite(depth)) {
      return undefined;
    }
    const normalized = Math.trunc(depth);
    return normalized > 0 ? normalized : undefined;
  }

  async buildFromRoot(
    rootPath: string,
    recursive: boolean,
    depth?: number,
    onProgress?: (
      completedPairs: number,
      totalPairs: number,
      folder1?: string,
      folder2?: string
    ) => Promise<void> | void,
    selectedLevels?: string[][]
  ): Promise<PlagiarismHeatmapData | null> {
    const requestedDepth = this.normalizeDepth(depth);
    const effectiveRoot = await this.resolveEffectiveRoot(rootPath);
    const rootWasShifted = path.resolve(effectiveRoot) !== path.resolve(rootPath);
    const effectiveSelectedLevels = this.normalizeSelectedLevelsForEffectiveRoot(
      selectedLevels,
      rootWasShifted
    );
    const effectiveDepth =
      requestedDepth === undefined
        ? undefined
        : rootWasShifted
          ? Math.max(1, requestedDepth - 1)
          : requestedDepth;

    return this.runHeatmapWorker(
      "build",
      effectiveRoot,
      recursive,
      effectiveDepth,
      onProgress,
      effectiveSelectedLevels
    ) as Promise<PlagiarismHeatmapData | null>;
  }

  async countFromRoot(
    rootPath: string,
    recursive: boolean,
    depth?: number,
    selectedLevels?: string[][]
  ): Promise<number> {
    const requestedDepth = this.normalizeDepth(depth);
    const effectiveRoot = await this.resolveEffectiveRoot(rootPath);
    const rootWasShifted = path.resolve(effectiveRoot) !== path.resolve(rootPath);
    const effectiveSelectedLevels = this.normalizeSelectedLevelsForEffectiveRoot(
      selectedLevels,
      rootWasShifted
    );
    const effectiveDepth =
      requestedDepth === undefined
        ? undefined
        : rootWasShifted
          ? Math.max(1, requestedDepth - 1)
          : requestedDepth;

    const result = (await this.runHeatmapWorker(
      "count",
      effectiveRoot,
      recursive,
      effectiveDepth,
      undefined,
      effectiveSelectedLevels
    )) as number;
    return Math.max(0, Math.trunc(Number(result) || 0));
  }

  private async resolveEffectiveRoot(rootPath: string): Promise<string> {
    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      const dirs = entries
        .filter((entry) => {
          if (!entry.isDirectory()) {
            return false;
          }
          const normalized = String(entry.name || "").toLowerCase();
          return (
            normalized !== "__macosx" && normalized !== "macosx" && !normalized.startsWith(".")
          );
        })
        .map((entry) => path.join(rootPath, entry.name));

      if (dirs.length === 1) {
        return dirs[0];
      }
    } catch {
      return rootPath;
    }

    return rootPath;
  }

  private async runHeatmapWorker(
    mode: "build" | "count",
    rootPath: string,
    recursive: boolean,
    depth?: number,
    onProgress?: (
      completedPairs: number,
      totalPairs: number,
      folder1?: string,
      folder2?: string
    ) => Promise<void> | void,
    selectedLevels?: string[][]
  ): Promise<PlagiarismHeatmapData | null | number> {
    if (mode === "build" && HEATMAP_COMPARE_WORKERS > 1) {
      return this.runShardedHeatmapWorkers(rootPath, recursive, depth, onProgress, selectedLevels);
    }

    const workerPath = path.resolve(__dirname, "plagiarism-heatmap.worker.js");
    const hardTimeoutMs = HEATMAP_MAX_DURATION_MS
      ? HEATMAP_MAX_DURATION_MS + WORKER_EXTRA_GRACE_MS
      : null;

    return new Promise<PlagiarismHeatmapData | null | number>((resolve, reject) => {
      let settled = false;
      const worker = new Worker(workerPath, {
        workerData: {
          mode,
          rootPath,
          recursive,
          depth,
          selectedLevels,
          timeoutMs: HEATMAP_MAX_DURATION_MS
        },
        resourceLimits: {
          maxOldGenerationSizeMb: HEATMAP_WORKER_MAX_OLD_MB
        }
      });

      const done = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        fn();
      };

      let timeoutHandle: NodeJS.Timeout | null = null;
      if (hardTimeoutMs) {
        timeoutHandle = setTimeout(() => {
          void worker.terminate();
          done(() => reject(new Error("Plagiarism heatmap hard timeout")));
        }, hardTimeoutMs);
      }

      worker.on("message", (message: WorkerResultMessage | WorkerProgressMessage) => {
        if (
          onProgress &&
          message &&
          typeof message === "object" &&
          "type" in message &&
          message.type === "progress"
        ) {
          void onProgress(
            message.completedPairs,
            message.totalPairs,
            message.folder1,
            message.folder2
          );
          return;
        }

        if (!message || typeof message !== "object" || !("ok" in message)) {
          return;
        }

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        done(() => {
          if (!message?.ok) {
            reject(new Error(message?.error || "Plagiarism heatmap worker failed"));
            return;
          }
          if (mode === "count") {
            resolve(Math.max(0, Math.trunc(Number(message.count) || 0)));
            return;
          }
          resolve((message.result as PlagiarismHeatmapData | null) ?? null);
        });
      });

      worker.on("error", (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        done(() => reject(error));
      });

      worker.on("exit", (code) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        if (settled) {
          return;
        }
        done(() => {
          if (code === 0) {
            resolve(null);
            return;
          }
          reject(new Error(`Plagiarism heatmap worker exited with code ${code}`));
        });
      });
    });
  }

  private buildEmptyCell(): PlagiarismCell {
    return {
      avgSimilarity: 0,
      maxSimilarity: 0,
      minSimilarity: 0,
      comparedFiles: 0,
      highSimilarityFiles: 0,
      fileDetails: []
    };
  }

  private async runShardedHeatmapWorkers(
    rootPath: string,
    recursive: boolean,
    depth?: number,
    onProgress?: (
      completedPairs: number,
      totalPairs: number,
      folder1?: string,
      folder2?: string
    ) => Promise<void> | void,
    selectedLevels?: string[][]
  ): Promise<PlagiarismHeatmapData | null> {
    const workerPath = path.resolve(__dirname, "plagiarism-heatmap.worker.js");
    const hardTimeoutMs = HEATMAP_MAX_DURATION_MS
      ? HEATMAP_MAX_DURATION_MS + WORKER_EXTRA_GRACE_MS
      : null;
    const shardCount = HEATMAP_COMPARE_WORKERS;
    const shardProgress = new Map<number, { completedPairs: number; totalPairs: number }>();

    return new Promise<PlagiarismHeatmapData | null>((resolve, reject) => {
      let settled = false;
      const workers: Worker[] = [];
      const results = new Map<number, PartialHeatmapResult | null>();

      const cleanup = () => {
        for (const worker of workers) {
          void worker.terminate().catch(() => undefined);
        }
      };

      const done = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        fn();
      };

      let timeoutHandle: NodeJS.Timeout | null = null;
      if (hardTimeoutMs) {
        timeoutHandle = setTimeout(() => {
          cleanup();
          done(() => reject(new Error("Plagiarism heatmap hard timeout")));
        }, hardTimeoutMs);
      }

      const finalize = () => {
        if (settled || results.size < shardCount) {
          return;
        }
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        const successful = Array.from(results.values()).filter(
          (value): value is PartialHeatmapResult => Boolean(value)
        );
        done(() => {
          if (!successful.length) {
            resolve(null);
            return;
          }

          const base = successful[0];
          const size = base.labels.length;
          const matrix: PlagiarismCell[][] = Array.from({ length: size }, (_, rowIndex) =>
            Array.from({ length: size }, (_, colIndex) =>
              rowIndex === colIndex
                ? {
                    avgSimilarity: 100,
                    maxSimilarity: 100,
                    minSimilarity: 100,
                    comparedFiles: base.folders[rowIndex]?.fileCount || 0,
                    highSimilarityFiles: base.folders[rowIndex]?.fileCount || 0,
                    fileDetails: []
                  }
                : this.buildEmptyCell()
            )
          );

          const pairs: PlagiarismPair[] = [];
          for (const shard of successful) {
            for (const entry of shard.partialEntries) {
              matrix[entry.i][entry.j] = entry.cell;
              matrix[entry.j][entry.i] = entry.cell;
            }
            pairs.push(...shard.partialPairs);
          }

          resolve({
            rootPath: base.rootPath,
            recursive: base.recursive,
            generatedAt: base.generatedAt,
            metric: base.metric,
            formula: base.formula,
            comparedExtensions: base.comparedExtensions,
            excludedFiles: base.excludedFiles,
            folders: base.folders,
            labels: base.labels,
            matrix,
            pairs: pairs.sort((a, b) => b.avgSimilarity - a.avgSimilarity)
          });
        });
      };

      for (let shardIndex = 0; shardIndex < shardCount; shardIndex += 1) {
        const worker = new Worker(workerPath, {
          workerData: {
            mode: "build",
            rootPath,
            recursive,
            depth,
            selectedLevels,
            timeoutMs: HEATMAP_MAX_DURATION_MS,
            shardIndex,
            shardCount
          },
          resourceLimits: {
            maxOldGenerationSizeMb: HEATMAP_WORKER_MAX_OLD_MB
          }
        });
        workers.push(worker);

        worker.on("message", (message: WorkerResultMessage | WorkerProgressMessage) => {
          if (
            onProgress &&
            message &&
            typeof message === "object" &&
            "type" in message &&
            message.type === "progress"
          ) {
            shardProgress.set(message.shardIndex, {
              completedPairs: message.completedPairs,
              totalPairs: message.totalPairs
            });
            const aggregated = Array.from(shardProgress.values()).reduce(
              (acc, item) => {
                acc.completedPairs += item.completedPairs;
                acc.totalPairs += item.totalPairs;
                return acc;
              },
              { completedPairs: 0, totalPairs: 0 }
            );
            void onProgress(
              aggregated.completedPairs,
              aggregated.totalPairs,
              message.folder1,
              message.folder2
            );
            return;
          }

          if (!message || typeof message !== "object" || !("ok" in message)) {
            return;
          }

          if (!message.ok) {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
            cleanup();
            done(() => reject(new Error(message.error || "Plagiarism heatmap worker failed")));
            return;
          }

          results.set(shardIndex, (message.result as PartialHeatmapResult | null) ?? null);
          finalize();
        });

        worker.on("error", (error) => {
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
          }
          cleanup();
          done(() => reject(error));
        });

        worker.on("exit", (code) => {
          if (settled) {
            return;
          }
          if (!results.has(shardIndex)) {
            if (timeoutHandle) {
              clearTimeout(timeoutHandle);
            }
            cleanup();
            done(() => {
              if (code === 0) {
                resolve(null);
                return;
              }
              reject(
                new Error(`Plagiarism heatmap worker shard ${shardIndex} exited with code ${code}`)
              );
            });
          }
        });
      }
    });
  }
}
