export type Direction = "html_css" | "js"

export interface AnalysisRow {
  path: string
  group: string | null
  student: string | null
  [key: string]: string | number | null
}

export interface SavedResultItem {
  runId: string
  createdAt: string
  path: string
  group: string | null
  student: string | null
  [key: string]: string | number | null
}

export interface SavedResultsResponse {
  direction: string
  path: string
  data: SavedResultItem[]
}

export interface SavedRunResultsResponse {
  runId: string
  direction: string
  path: string
  data: SavedResultItem[]
}

export interface RunS3AsyncRequest {
  key: string
  direction: Direction
  metrics?: string[]
  r?: boolean
  depth?: number
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

export interface SavedResultsQuery {
  path: string
  direction: Direction
}

export interface AnalysisListItem {
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
