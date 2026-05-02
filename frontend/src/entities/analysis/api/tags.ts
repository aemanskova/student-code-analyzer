import { buildFilterQueryParams } from "./queryParams"
import type { RunFilterQuery } from "./types"

export const analysisListTag = { type: "AnalysisList" as const, id: "LIST" }
export const standaloneHeatmapListTag = { type: "StandaloneHeatmapList" as const, id: "LIST" }

export const analysisJobTag = (jobId: string) => ({ type: "AnalysisJob" as const, id: jobId })
export const analysisRunTag = (runId: string) => ({ type: "AnalysisRun" as const, id: runId })
export const runFilterOptionsTag = (query: RunFilterQuery) => ({
  type: "RunFilterOptions" as const,
  id: `${query.runId}:${buildFilterQueryParams(query)}`
})
export const runHeatmapHistoryTag = (runId: string) => ({
  type: "RunHeatmapHistory" as const,
  id: runId
})
export const standaloneHeatmapTag = (jobId: string) => ({
  type: "StandaloneHeatmap" as const,
  id: jobId
})
