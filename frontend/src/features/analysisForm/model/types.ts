import type {
  Direction,
  EslintConfigFormat,
  RunS3AsyncRequest,
  RunS3AsyncResponse
} from "@entities/analysis/api"

export interface AnalysisFormValues {
  archive: File | null
  direction: Direction | null
  metrics: string[]
  eslintConfigText: string
  eslintConfigFormat?: EslintConfigFormat
  recursive: boolean
  depth?: number
  includeGitMetrics: boolean
}

export interface AnalysisRunResult {
  response: RunS3AsyncResponse
  request: RunS3AsyncRequest
}
