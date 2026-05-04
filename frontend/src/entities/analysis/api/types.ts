export type Direction = "html_css" | "js"
export type EslintConfigFormat = "js" | "mjs" | "cjs"

export interface AnalysisRow {
  path: string
  group: string | null
  student: string | null
  [key: string]: string | number | null
}

export interface GitAnalysisRow {
  runId?: string
  createdAt?: string
  path: string
  group: string | null
  student: string | null
  branch: string
  hash: string
  date: string
  message: string
  author: string
  filename: string
  filetype: "binary" | "text"
  extraMetadata: string
  changes: string
  added: number
  deleted: number
}

export interface SavedResultItem {
  runId: string
  createdAt: string
  path: string
  group: string | null
  student: string | null
  [key: string]: string | number | null
}

export interface RunS3AsyncRequest {
  key: string
  direction: Direction
  metrics?: string[]
  eslintConfigText?: string
  eslintConfigFormat?: EslintConfigFormat
  r?: boolean
  depth?: number
  includeGitMetrics?: boolean
  includePlagiarismHeatmap?: boolean
}

export interface HeatmapValidateUploadRequest {
  key: string
  r?: boolean
  depth?: number
  selectedLevels?: string[][]
}

export interface HeatmapLimitValidationResponse {
  folderCount: number | null
  maxAllowed: number
  allowed: boolean
  archiveTooLarge?: boolean
  message: string | null
}

export interface RunS3AsyncResponse {
  jobId: string
  status: "queued" | "running" | "success" | "failed"
  createdAt: string
}

export interface AnalysisJobResultPayload {
  direction: Direction
  metrics: string[]
  rowsTotal: number
  gitRowsTotal?: number
  runId: string | null
  path?: string | null
  plagiarismHeatmap?: PlagiarismHeatmapData | null
}

export interface AnalysisJobStatusResponse {
  jobId: string
  status: "queued" | "running" | "success" | "failed"
  direction: Direction
  archiveName: string | null
  stage: string | null
  errorMessage: string | null
  result: AnalysisJobResultPayload | null
  elapsedSeconds: number
  estimatedTotalSeconds: number | null
  estimatedRemainingSeconds: number | null
  progressPercent: number | null
  createdAt: string
  heartbeatAt: string | null
  startedAt: string | null
  finishedAt: string | null
}

export interface AnalysisListItem {
  runId: string
  path: string
  date: string
  direction: Direction
}

export interface AnalysisListQuery {
  page: number
  size: number
  path?: string
  direction?: Direction
  dateFrom?: string
  dateTo?: string
}

export interface AnalysisListResponse {
  page: number
  size: number
  total: number
  data: AnalysisListItem[]
}

export interface DeleteSavedRunResponse {
  runId: string
  deletedMetricsRows: number
  deletedGitRows: number
}

export interface DeleteStandaloneHeatmapResponse {
  jobId: string
  deleted: boolean
}

export interface SavedRunDetailsResponse {
  runId: string
  direction: Direction
  path: string
  data: SavedResultItem[]
  gitData: GitAnalysisRow[]
  plagiarismHeatmap?: PlagiarismHeatmapData | null
  requestedFeatures?: RunRequestedFeatures
}

export type RunViewKind = "metrics" | "git"

export interface RunFilterQuery {
  runId: string
  kind: RunViewKind
  depth?: number
  selectedLevels?: string[][]
}

export interface RunFilterLevelOptions {
  level: number
  multi: boolean
  options: string[]
}

export interface RunFilterOptionsResponse {
  runId: string
  kind: RunViewKind
  depth: number
  selectedLevels: string[][]
  levels: RunFilterLevelOptions[]
  paths: string[]
}

export interface RunMetricsViewResponse {
  runId: string
  kind: "metrics"
  depth: number
  selectedLevels: string[][]
  metrics: string[]
  rows: SavedResultItem[]
  gitRows: GitAnalysisRow[]
  plagiarismHeatmap?: PlagiarismHeatmapData | null
  requestedFeatures?: RunRequestedFeatures
}

export interface RunGitViewResponse {
  runId: string
  kind: "git"
  depth: number
  selectedLevels: string[][]
  rows: GitAnalysisRow[]
}

export type RunViewResponse = RunMetricsViewResponse | RunGitViewResponse

export interface BuildRunHeatmapRequest {
  runId: string
  depth?: number
  selectedLevels?: string[][]
}

export interface BuildRunHeatmapResponse {
  runId: string
  folderCount: number
  maxAllowed: number
  plagiarismHeatmap: PlagiarismHeatmapData | null
}

export interface BuildRunHeatmapAsyncRequest {
  runId: string
  depth?: number
  selectedLevels?: string[][]
}

export interface BuildStandaloneHeatmapAsyncRequest {
  key: string
  originalName?: string
  r?: boolean
  depth?: number
}

export interface StandaloneHeatmapItem {
  jobId: string
  archiveName: string | null
  folder: string
  folderCount: number
  createdAt: string
  finishedAt: string
  plagiarismHeatmap: PlagiarismHeatmapData
}

export interface StandaloneHeatmapListQuery {
  folder?: string
  dateFrom?: string
  dateTo?: string
}

export interface StandaloneHeatmapListResponse {
  data: StandaloneHeatmapItem[]
}

export interface RunHeatmapHistoryItem {
  jobId: string
  createdAt: string
  depth: number | null
  selectedLevels: string[][]
  folderCount: number | null
  plagiarismHeatmap: PlagiarismHeatmapData
}

export interface RunHeatmapHistoryResponse {
  runId: string
  data: RunHeatmapHistoryItem[]
}

export interface RunRequestedFeatures {
  includeGitMetrics: boolean
  includePlagiarismHeatmap: boolean
}

export interface PlagiarismFileSimilarity {
  fileName: string
  similarity: number
}

export interface PlagiarismCell {
  avgSimilarity: number
  maxSimilarity: number
  minSimilarity: number
  comparedFiles: number
  highSimilarityFiles: number
  fileDetails: PlagiarismFileSimilarity[]
}

export interface PlagiarismPair extends PlagiarismCell {
  folder1: string
  folder2: string
}

export interface PlagiarismHeatmapData {
  rootPath: string
  recursive: boolean
  generatedAt: string
  metric: string
  formula: string
  comparedExtensions: string[]
  excludedFiles: string[]
  folders: Array<{ path: string; fileCount: number; files: string[] }>
  labels: string[]
  matrix: PlagiarismCell[][]
  pairs: PlagiarismPair[]
}
