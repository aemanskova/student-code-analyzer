export interface AnalysisRow {
  path: string;
  group: string | null;
  student: string | null;
  [key: string]: string | number | boolean | null;
}

export interface GitAnalysisRow {
  path: string;
  group: string | null;
  student: string | null;
  branch: string;
  hash: string;
  date: string;
  message: string;
  author: string;
  filename: string;
  filetype: "binary" | "text";
  extraMetadata: string;
  changes: string;
  added: number;
  deleted: number;
}

export interface PlagiarismFileSimilarity {
  fileName: string;
  similarity: number;
}

export interface PlagiarismCell {
  avgSimilarity: number;
  maxSimilarity: number;
  minSimilarity: number;
  comparedFiles: number;
  highSimilarityFiles: number;
  fileDetails: PlagiarismFileSimilarity[];
}

export interface PlagiarismPair extends PlagiarismCell {
  folder1: string;
  folder2: string;
}

export interface PlagiarismHeatmapData {
  rootPath: string;
  recursive: boolean;
  generatedAt: string;
  metric: string;
  formula: string;
  comparedExtensions: string[];
  excludedFiles: string[];
  folders: Array<{ path: string; fileCount: number; files: string[] }>;
  labels: string[];
  matrix: PlagiarismCell[][];
  pairs: PlagiarismPair[];
}

export interface AnalysisResponse {
  direction: string;
  metrics: string[];
  data: AnalysisRow[];
  gitData?: GitAnalysisRow[];
  plagiarismHeatmap?: PlagiarismHeatmapData | null;
  runId?: string | null;
}
