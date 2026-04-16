import type { Direction, RunS3AsyncRequest, RunS3AsyncResponse } from "@entities/analysis/api"

export interface AnalysisFormValues {
  archive: File | null
  direction: Direction
  metrics: string[]
  recursive: boolean
  depth?: number
  includeGitMetrics: boolean
}

export interface AnalysisRunResult {
  response: RunS3AsyncResponse
  request: RunS3AsyncRequest
}
