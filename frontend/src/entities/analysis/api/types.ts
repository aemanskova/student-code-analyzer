export type Direction = "html_css" | "js"

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
  r?: boolean
  depth?: number
  includeGitMetrics?: boolean
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
}

export interface AnalysisListResponse {
  page: number
  size: number
  total: number
  data: AnalysisListItem[]
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
}

export interface RunGitViewResponse {
  runId: string
  kind: "git"
  depth: number
  selectedLevels: string[][]
  rows: GitAnalysisRow[]
}

export type RunViewResponse = RunMetricsViewResponse | RunGitViewResponse
