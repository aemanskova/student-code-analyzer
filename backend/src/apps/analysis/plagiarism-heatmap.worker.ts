import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { parentPort, workerData } from "node:worker_threads";
import * as levenshtein from "fast-levenshtein";
import type { PlagiarismCell, PlagiarismHeatmapData, PlagiarismPair } from "./analysis.types";

const INCLUDED_EXTENSIONS = new Set([".html", ".css", ".js", ".ts"]);
const EXCLUDED_FILES = new Set(["normalize.css", "reset.css", "README.md"]);
const SIMILARITY_CACHE_MAX_ENTRIES = Math.max(
  0,
  Math.trunc(Number(process.env.HEATMAP_SIMILARITY_CACHE_MAX_ENTRIES || 200_000))
);
const FILE_READ_CONCURRENCY = Math.max(
  1,
  Math.trunc(Number(process.env.HEATMAP_FILE_READ_CONCURRENCY || 32))
);
const LEVENSHTEIN_MAX_CHARS = Math.max(
  0,
  Math.trunc(Number(process.env.HEATMAP_LEVENSHTEIN_MAX_CHARS || 20_000))
);

type FolderCandidate = {
  path: string;
  filePaths: string[];
};

type FolderModel = {
  path: string;
  fileHashesByName: Record<string, string>;
  fileNames: string[];
  fileNameSet: Set<string>;
  fileCount: number;
  signature: string;
};

type LineFingerprint = {
  totalLines: number;
  lineCounts: Map<string, number>;
};

type WorkerInput = {
  mode?: "build" | "count";
  rootPath: string;
  recursive: boolean;
  depth?: number;
  selectedLevels?: string[][];
  timeoutMs?: number | null;
  shardIndex?: number;
  shardCount?: number;
};

type WorkerProgressPayload = {
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

const input = workerData as WorkerInput;
const mode: "build" | "count" = input.mode === "count" ? "count" : "build";
const shardCount = Math.max(1, Math.trunc(Number(input.shardCount) || 1));
const shardIndex = Math.max(0, Math.min(shardCount - 1, Math.trunc(Number(input.shardIndex) || 0)));
const deadlineMs =
  input.timeoutMs && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
    ? Date.now() + input.timeoutMs
    : null;

const isServiceDirectoryName = (dirName: string): boolean => {
  const normalized = String(dirName || "").toLowerCase();
  return normalized === "__macosx" || normalized === "macosx" || normalized.startsWith(".");
};

const throwIfDeadlineExceeded = (): void => {
  if (!deadlineMs) {
    return;
  }
  if (Date.now() > deadlineMs) {
    throw new Error("Plagiarism heatmap timeout");
  }
};

const hasExpectedDepth = (rootPath: string, folderPath: string, depth?: number): boolean => {
  if (!depth || !Number.isFinite(depth) || depth < 1) {
    return true;
  }

  const relativePath = path.relative(rootPath, folderPath);
  if (!relativePath || relativePath === ".") {
    return false;
  }

  const segments = relativePath.split(path.sep).filter(Boolean);
  return segments.length === depth;
};

const matchesSelectedLevels = (
  rootPath: string,
  folderPath: string,
  selectedLevels?: string[][]
): boolean => {
  if (!Array.isArray(selectedLevels) || selectedLevels.length === 0) {
    return true;
  }

  const relativePath = path.relative(rootPath, folderPath);
  if (!relativePath || relativePath === ".") {
    return false;
  }
  const segments = relativePath.split(path.sep).filter(Boolean);

  for (let index = 0; index < selectedLevels.length; index += 1) {
    const options = Array.isArray(selectedLevels[index]) ? selectedLevels[index] : [];
    if (!options.length) {
      continue;
    }
    const segment = segments[index] || "";
    if (!options.includes(segment)) {
      return false;
    }
  }

  return true;
};

const runWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (!items.length) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runner = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  const parallelism = Math.min(items.length, Math.max(1, concurrency));
  await Promise.all(Array.from({ length: parallelism }, () => runner()));
  return results;
};

const buildLineFingerprint = (content: string): LineFingerprint => {
  const lines = String(content || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const lineCounts = new Map<string, number>();

  for (const line of lines) {
    lineCounts.set(line, (lineCounts.get(line) || 0) + 1);
  }

  return {
    totalLines: lines.length,
    lineCounts
  };
};

const calculateLineSimilarityPercent = (a: LineFingerprint, b: LineFingerprint): number => {
  const totalLines = a.totalLines + b.totalLines;
  if (totalLines === 0) {
    return 100;
  }

  const source = a.lineCounts.size <= b.lineCounts.size ? a : b;
  const target = source === a ? b : a;
  let shared = 0;

  for (const [line, count] of source.lineCounts) {
    const otherCount = target.lineCounts.get(line) || 0;
    if (otherCount > 0) {
      shared += Math.min(count, otherCount);
    }
  }

  return (2 * shared * 100) / totalLines;
};

const normalizeContentForSimilarity = (fileName: string, content: string): string => {
  const ext = path.extname(fileName).toLowerCase();
  let normalized = String(content || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\uFEFF/, "");

  if (ext === ".html") {
    normalized = normalized.replace(/<!--[\s\S]*?-->/g, "");
    normalized = normalized.replace(/>\s+</g, "><");
  } else if (ext === ".css" || ext === ".js" || ext === ".ts") {
    normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, "");
  }

  normalized = normalized.replace(/[ \t\f\v]+/g, " ");
  normalized = normalized.replace(/\n{2,}/g, "\n");
  normalized = normalized.replace(/ ?\n ?/g, "\n");

  return normalized.trim();
};

const getFilesByExtensions = async (dir: string, extensions: Set<string>): Promise<string[]> => {
  throwIfDeadlineExceeded();
  let results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isServiceDirectoryName(entry.name)) {
        continue;
      }
      results = results.concat(await getFilesByExtensions(fullPath, extensions));
    } else {
      const ext = path.extname(entry.name);
      if (extensions.has(ext) && !EXCLUDED_FILES.has(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  return results;
};

const collectFolders = async (
  rootPath: string,
  recursive: boolean,
  depth?: number,
  selectedLevels?: string[][]
): Promise<FolderCandidate[]> => {
  if (!recursive) {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory() && !isServiceDirectoryName(entry.name))
      .map((entry) => path.join(rootPath, entry.name));

    const valid: FolderCandidate[] = [];
    for (const folder of folders) {
      throwIfDeadlineExceeded();
      const files = await getFilesByExtensions(folder, INCLUDED_EXTENSIONS);
      if (
        files.length > 0 &&
        hasExpectedDepth(rootPath, folder, depth) &&
        matchesSelectedLevels(rootPath, folder, selectedLevels)
      ) {
        valid.push({ path: folder, filePaths: files });
      }
    }
    return valid;
  }

  const result: FolderCandidate[] = [];
  const walk = async (currentDir: string): Promise<string[]> => {
    throwIfDeadlineExceeded();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const relevantFilesInSubtree: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isServiceDirectoryName(entry.name)) {
          continue;
        }
        const childFiles = await walk(path.join(currentDir, entry.name));
        if (childFiles.length) {
          relevantFilesInSubtree.push(...childFiles);
        }
        continue;
      }

      const ext = path.extname(entry.name);
      if (INCLUDED_EXTENSIONS.has(ext) && !EXCLUDED_FILES.has(entry.name)) {
        relevantFilesInSubtree.push(path.join(currentDir, entry.name));
      }
    }

    if (
      relevantFilesInSubtree.length > 0 &&
      hasExpectedDepth(rootPath, currentDir, depth) &&
      matchesSelectedLevels(rootPath, currentDir, selectedLevels)
    ) {
      result.push({
        path: currentDir,
        filePaths: relevantFilesInSubtree.slice()
      });
    }

    return relevantFilesInSubtree;
  };

  await walk(rootPath);

  return result
    .filter((entry) => path.resolve(entry.path) !== path.resolve(rootPath))
    .sort((a, b) => a.path.localeCompare(b.path));
};

const buildFolderModel = async (
  folderPath: string,
  files: string[],
  contentByHash: Map<string, string>,
  lineFingerprintByHash: Map<string, LineFingerprint>
): Promise<FolderModel> => {
  const fileHashesByName: Record<string, string> = {};

  const readResults = await runWithConcurrency(files, FILE_READ_CONCURRENCY, async (filePath) => {
    throwIfDeadlineExceeded();
    const fileName = path.basename(filePath);
    try {
      const rawContent = await fs.readFile(filePath, "utf-8");
      const content = normalizeContentForSimilarity(fileName, rawContent);
      return {
        fileName,
        content,
        hash: createHash("sha1").update(content).digest("hex")
      };
    } catch {
      return null;
    }
  });

  for (const item of readResults) {
    if (!item) {
      continue;
    }
    fileHashesByName[item.fileName] = item.hash;
    if (!contentByHash.has(item.hash)) {
      contentByHash.set(item.hash, item.content);
      lineFingerprintByHash.set(item.hash, buildLineFingerprint(item.content));
    }
  }

  const fileNames = Object.keys(fileHashesByName).sort();
  const signatureSource = fileNames
    .map((fileName) => `${fileName}:${fileHashesByName[fileName]}`)
    .join("|");
  return {
    path: folderPath,
    fileHashesByName,
    fileNames,
    fileNameSet: new Set(fileNames),
    fileCount: fileNames.length,
    signature: createHash("sha1").update(signatureSource).digest("hex")
  };
};

const calculateSimilarityPercent = (a: string, b: string): number => {
  throwIfDeadlineExceeded();
  const distance = levenshtein.get(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) {
    return 100;
  }
  return ((maxLen - distance) / maxLen) * 100;
};

const getSimilarityCacheKey = (hashA: string, hashB: string): string =>
  hashA <= hashB ? `${hashA}:${hashB}` : `${hashB}:${hashA}`;

const getFolderPairCacheKey = (signatureA: string, signatureB: string): string =>
  signatureA <= signatureB ? `${signatureA}:${signatureB}` : `${signatureB}:${signatureA}`;

const getCachedSimilarity = (
  hashA: string,
  hashB: string,
  contentByHash: Map<string, string>,
  lineFingerprintByHash: Map<string, LineFingerprint>,
  similarityCache: Map<string, number>
): number => {
  if (hashA === hashB) {
    return 100;
  }

  const cacheKey = getSimilarityCacheKey(hashA, hashB);
  const cached = similarityCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const contentA = contentByHash.get(hashA) || "";
  const contentB = contentByHash.get(hashB) || "";
  if (!contentA && !contentB) {
    return 0;
  }
  if (contentA === contentB) {
    return 100;
  }

  const maxLen = Math.max(contentA.length, contentB.length);
  const similarity =
    LEVENSHTEIN_MAX_CHARS > 0 && maxLen <= LEVENSHTEIN_MAX_CHARS
      ? calculateSimilarityPercent(contentA, contentB)
      : calculateLineSimilarityPercent(
          lineFingerprintByHash.get(hashA) || buildLineFingerprint(contentA),
          lineFingerprintByHash.get(hashB) || buildLineFingerprint(contentB)
        );
  if (SIMILARITY_CACHE_MAX_ENTRIES > 0 && similarityCache.size < SIMILARITY_CACHE_MAX_ENTRIES) {
    similarityCache.set(cacheKey, similarity);
  }
  return similarity;
};

const compareFolders = (
  folderA: FolderModel,
  folderB: FolderModel,
  contentByHash: Map<string, string>,
  lineFingerprintByHash: Map<string, LineFingerprint>,
  similarityCache: Map<string, number>
): PlagiarismCell => {
  if (folderA.signature === folderB.signature) {
    return {
      avgSimilarity: 100,
      maxSimilarity: 100,
      minSimilarity: 100,
      comparedFiles: folderA.fileCount,
      highSimilarityFiles: folderA.fileCount,
      fileDetails: []
    };
  }

  const sourceFolder = folderA.fileNames.length <= folderB.fileNames.length ? folderA : folderB;
  const targetFolder = sourceFolder === folderA ? folderB : folderA;
  const commonFileNames: string[] = [];
  for (const fileName of sourceFolder.fileNames) {
    if (targetFolder.fileNameSet.has(fileName)) {
      commonFileNames.push(fileName);
    }
  }

  if (!commonFileNames.length) {
    return {
      avgSimilarity: 0,
      maxSimilarity: 0,
      minSimilarity: 0,
      comparedFiles: 0,
      highSimilarityFiles: 0,
      fileDetails: []
    };
  }

  let total = 0;
  let maxSimilarity = 0;
  let minSimilarity = 100;
  let highSimilarityFiles = 0;

  for (const fileName of commonFileNames) {
    const hashA = folderA.fileHashesByName[fileName];
    const hashB = folderB.fileHashesByName[fileName];
    const similarity = getCachedSimilarity(
      hashA,
      hashB,
      contentByHash,
      lineFingerprintByHash,
      similarityCache
    );

    total += similarity;
    maxSimilarity = Math.max(maxSimilarity, similarity);
    minSimilarity = Math.min(minSimilarity, similarity);
    if (similarity >= 80) {
      highSimilarityFiles += 1;
    }
  }

  return {
    avgSimilarity: Number((total / commonFileNames.length).toFixed(2)),
    maxSimilarity: Number(maxSimilarity.toFixed(2)),
    minSimilarity: Number(minSimilarity.toFixed(2)),
    comparedFiles: commonFileNames.length,
    highSimilarityFiles,
    fileDetails: []
  };
};

const buildMatrix = (
  folderModels: FolderModel[],
  contentByHash: Map<string, string>,
  lineFingerprintByHash: Map<string, LineFingerprint>,
  options?: { shardIndex?: number; shardCount?: number }
): { partialEntries: PartialMatrixEntry[]; partialPairs: PlagiarismPair[]; totalPairs: number } => {
  const size = folderModels.length;
  const globalTotalPairs = Math.max(0, Math.floor((size * (size - 1)) / 2));
  const activeShardCount = Math.max(1, Math.trunc(Number(options?.shardCount) || 1));
  const activeShardIndex = Math.max(
    0,
    Math.min(activeShardCount - 1, Math.trunc(Number(options?.shardIndex) || 0))
  );
  const totalPairs = Math.floor(
    (globalTotalPairs + activeShardCount - 1 - activeShardIndex) / activeShardCount
  );
  const partialEntries: PartialMatrixEntry[] = [];
  const partialPairs: PlagiarismPair[] = [];
  let completedPairs = 0;
  let lastProgressSentAt = 0;
  const similarityCache = new Map<string, number>();
  const folderPairCache = new Map<string, PlagiarismCell>();
  let pairOrdinal = 0;

  for (let i = 0; i < size; i += 1) {
    for (let j = i + 1; j < size; j += 1) {
      throwIfDeadlineExceeded();
      const currentPairOrdinal = pairOrdinal;
      pairOrdinal += 1;
      if (currentPairOrdinal % activeShardCount !== activeShardIndex) {
        continue;
      }

      const pairCacheKey = getFolderPairCacheKey(
        folderModels[i].signature,
        folderModels[j].signature
      );
      let result = folderPairCache.get(pairCacheKey);
      if (!result) {
        result = compareFolders(
          folderModels[i],
          folderModels[j],
          contentByHash,
          lineFingerprintByHash,
          similarityCache
        );
        folderPairCache.set(pairCacheKey, result);
      }
      partialEntries.push({
        i,
        j,
        cell: result
      });
      partialPairs.push({
        folder1: folderModels[i].path,
        folder2: folderModels[j].path,
        ...result
      });

      completedPairs += 1;
      const now = Date.now();
      if (
        parentPort &&
        totalPairs > 0 &&
        (completedPairs === totalPairs || now - lastProgressSentAt >= 500)
      ) {
        const progressMessage: WorkerProgressPayload = {
          type: "progress",
          shardIndex: activeShardIndex,
          completedPairs,
          totalPairs,
          folder1: folderModels[i]?.path,
          folder2: folderModels[j]?.path
        };
        parentPort.postMessage(progressMessage);
        lastProgressSentAt = now;
      }
    }
  }

  return { partialEntries, partialPairs, totalPairs };
};

const run = async (): Promise<
  PlagiarismHeatmapData | PartialHeatmapResult | null | { count: number }
> => {
  const folderCandidates = await collectFolders(
    input.rootPath,
    Boolean(input.recursive),
    input.depth,
    input.selectedLevels
  );
  if (mode === "count") {
    return { count: folderCandidates.length };
  }
  if (folderCandidates.length < 2) {
    return null;
  }

  const contentByHash = new Map<string, string>();
  const lineFingerprintByHash = new Map<string, LineFingerprint>();
  const folderModels = (
    await Promise.all(
      folderCandidates.map((folder) =>
        buildFolderModel(folder.path, folder.filePaths, contentByHash, lineFingerprintByHash)
      )
    )
  ).filter((model) => model.fileCount > 0);
  if (folderModels.length < 2) {
    return null;
  }

  const { partialEntries, partialPairs } = buildMatrix(
    folderModels,
    contentByHash,
    lineFingerprintByHash,
    {
      shardIndex,
      shardCount
    }
  );

  if (shardCount > 1) {
    return {
      rootPath: input.rootPath,
      recursive: Boolean(input.recursive),
      generatedAt: new Date().toISOString(),
      metric: "hybrid_levenshtein_line_similarity_percent",
      formula: `maxLen <= ${LEVENSHTEIN_MAX_CHARS} ? ((maxLen - levenshteinDistance(normalizedContentA, normalizedContentB)) / maxLen) * 100 : (2 * sharedNormalizedLines / (normalizedLinesA + normalizedLinesB)) * 100`,
      comparedExtensions: [...INCLUDED_EXTENSIONS],
      excludedFiles: [...EXCLUDED_FILES],
      folders: folderModels.map((folder) => ({
        path: folder.path,
        fileCount: folder.fileCount,
        files: folder.fileNames
      })),
      labels: folderModels.map((folder) => folder.path),
      partialPairs,
      partialEntries,
      shardIndex,
      shardCount
    };
  }

  const size = folderModels.length;
  const matrix: PlagiarismCell[][] = Array.from({ length: size }, (_, rowIndex) =>
    Array.from({ length: size }, (_, colIndex) =>
      rowIndex === colIndex
        ? {
            avgSimilarity: 100,
            maxSimilarity: 100,
            minSimilarity: 100,
            comparedFiles: folderModels[rowIndex].fileCount,
            highSimilarityFiles: folderModels[rowIndex].fileCount,
            fileDetails: []
          }
        : {
            avgSimilarity: 0,
            maxSimilarity: 0,
            minSimilarity: 0,
            comparedFiles: 0,
            highSimilarityFiles: 0,
            fileDetails: []
          }
    )
  );
  for (const entry of partialEntries) {
    matrix[entry.i][entry.j] = entry.cell;
    matrix[entry.j][entry.i] = entry.cell;
  }

  return {
    rootPath: input.rootPath,
    recursive: Boolean(input.recursive),
    generatedAt: new Date().toISOString(),
    metric: "hybrid_levenshtein_line_similarity_percent",
    formula: `maxLen <= ${LEVENSHTEIN_MAX_CHARS} ? ((maxLen - levenshteinDistance(normalizedContentA, normalizedContentB)) / maxLen) * 100 : (2 * sharedNormalizedLines / (normalizedLinesA + normalizedLinesB)) * 100`,
    comparedExtensions: [...INCLUDED_EXTENSIONS],
    excludedFiles: [...EXCLUDED_FILES],
    folders: folderModels.map((folder) => ({
      path: folder.path,
      fileCount: folder.fileCount,
      files: folder.fileNames
    })),
    labels: folderModels.map((folder) => folder.path),
    matrix,
    pairs: partialPairs.sort((a, b) => b.avgSimilarity - a.avgSimilarity)
  };
};

void run()
  .then((result) => {
    if (mode === "count") {
      const count = Number((result as { count?: number } | null)?.count || 0);
      parentPort?.postMessage({ ok: true, count: Math.max(0, Math.trunc(count)) });
      return;
    }
    parentPort?.postMessage({ ok: true, result });
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown plagiarism heatmap error";
    parentPort?.postMessage({ ok: false, error: message });
  });
