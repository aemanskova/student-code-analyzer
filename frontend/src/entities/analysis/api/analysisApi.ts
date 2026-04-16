import { baseApi } from "@shared/api/baseApi"

import type {
  AnalysisJobStatusResponse,
  AnalysisListQuery,
  AnalysisListResponse,
  BuildStandaloneHeatmapAsyncRequest,
  BuildRunHeatmapAsyncRequest,
  BuildRunHeatmapRequest,
  BuildRunHeatmapResponse,
  DeleteSavedRunResponse,
  DeleteStandaloneHeatmapResponse,
  HeatmapLimitValidationResponse,
  HeatmapValidateUploadRequest,
  RunFilterOptionsResponse,
  RunHeatmapHistoryResponse,
  RunFilterQuery,
  RunS3AsyncRequest,
  RunS3AsyncResponse,
  RunViewResponse,
  SavedRunDetailsResponse,
  StandaloneHeatmapItem,
  StandaloneHeatmapListQuery,
  StandaloneHeatmapListResponse
} from "./types"

const buildFilterQueryParams = (query: RunFilterQuery) => {
  const params = new URLSearchParams()
  params.set("kind", query.kind)
  if (typeof query.depth === "number") {
    params.set("depth", String(query.depth))
  }
  ;(query.selectedLevels || []).forEach((values, index) => {
    if (!values || !values.length) {
      return
    }
    params.set(`level${index + 1}`, values.join(","))
  })
  return params.toString()
}

const buildLevelsBody = (depth?: number, selectedLevels?: string[][]) => {
  const body: Record<string, unknown> = {}
  if (typeof depth === "number") {
    body.depth = depth
  }
  ;(selectedLevels || []).forEach((values, index) => {
    if (!values || !values.length) {
      return
    }
    body[`level${index + 1}`] = values.join(",")
  })
  return body
}

export const analysisApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    runS3Async: build.mutation<RunS3AsyncResponse, RunS3AsyncRequest>({
      query: (body) => ({
        url: "/analysis/run/s3/async",
        method: "POST",
        body
      }),
      invalidatesTags: ["ArchiveResults"]
    }),
    validateHeatmapUpload: build.mutation<
      HeatmapLimitValidationResponse,
      HeatmapValidateUploadRequest
    >({
      query: (body) => ({
        url: "/analysis/heatmap/validate-upload",
        method: "POST",
        body: {
          key: body.key,
          r: body.r,
          ...buildLevelsBody(body.depth, body.selectedLevels)
        }
      })
    }),
    getAnalysisJobStatus: build.query<AnalysisJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/analysis/jobs/${encodeURIComponent(jobId)}`,
        method: "GET"
      })
    }),
    getRunFilterOptions: build.query<RunFilterOptionsResponse, RunFilterQuery>({
      query: (query) => ({
        url: `/analysis/results/run/${encodeURIComponent(query.runId)}/select-options?${buildFilterQueryParams(query)}`,
        method: "GET"
      }),
      providesTags: ["ArchiveResults"]
    }),
    getRunView: build.query<RunViewResponse, RunFilterQuery>({
      query: (query) => ({
        url: `/analysis/results/run/${encodeURIComponent(query.runId)}/view?${buildFilterQueryParams(query)}`,
        method: "GET"
      }),
      providesTags: ["ArchiveResults"]
    }),
    getRunHeatmapHistory: build.query<RunHeatmapHistoryResponse, { runId: string }>({
      query: ({ runId }) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}/heatmap/history`,
        method: "GET"
      }),
      providesTags: ["ArchiveResults"]
    }),
    getSavedAnalysisList: build.query<AnalysisListResponse, AnalysisListQuery>({
      query: ({ page, size, path, direction, dateFrom, dateTo }) => {
        const params = new URLSearchParams()
        params.set("page", String(page))
        params.set("size", String(size))
        if (path) {
          params.set("path", path)
        }
        if (direction) {
          params.set("direction", direction)
        }
        if (dateFrom) {
          params.set("dateFrom", dateFrom)
        }
        if (dateTo) {
          params.set("dateTo", dateTo)
        }
        return {
          url: `/analysis/list?${params.toString()}`,
          method: "GET"
        }
      },
      providesTags: ["ArchiveResults"]
    }),
    getSavedResultsByRunId: build.query<SavedRunDetailsResponse, string>({
      query: (runId) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}`,
        method: "GET"
      }),
      providesTags: ["ArchiveResults"]
    }),
    buildRunHeatmap: build.mutation<BuildRunHeatmapResponse, BuildRunHeatmapRequest>({
      query: (body) => ({
        url: `/analysis/results/run/${encodeURIComponent(body.runId)}/heatmap/build`,
        method: "POST",
        body: buildLevelsBody(body.depth, body.selectedLevels)
      }),
      invalidatesTags: ["ArchiveResults"]
    }),
    buildRunHeatmapAsync: build.mutation<RunS3AsyncResponse, BuildRunHeatmapAsyncRequest>({
      query: (body) => ({
        url: `/analysis/results/run/${encodeURIComponent(body.runId)}/heatmap/build/async`,
        method: "POST",
        body: buildLevelsBody(body.depth, body.selectedLevels)
      })
    }),
    buildStandaloneHeatmapAsync: build.mutation<
      RunS3AsyncResponse,
      BuildStandaloneHeatmapAsyncRequest
    >({
      query: (body) => ({
        url: "/analysis/heatmap/build/async",
        method: "POST",
        body
      }),
      invalidatesTags: ["ArchiveResults"]
    }),
    getStandaloneHeatmapList: build.query<
      StandaloneHeatmapListResponse,
      StandaloneHeatmapListQuery | void
    >({
      query: (query) => {
        const params = new URLSearchParams()
        if (query?.folder) {
          params.set("folder", query.folder)
        }
        if (query?.dateFrom) {
          params.set("dateFrom", query.dateFrom)
        }
        if (query?.dateTo) {
          params.set("dateTo", query.dateTo)
        }
        const suffix = params.toString()
        return {
          url: `/analysis/heatmap/list${suffix ? `?${suffix}` : ""}`,
          method: "GET"
        }
      },
      providesTags: ["ArchiveResults"]
    }),
    getStandaloneHeatmapDetails: build.query<StandaloneHeatmapItem, string>({
      query: (jobId) => ({
        url: `/analysis/heatmap/${encodeURIComponent(jobId)}`,
        method: "GET"
      }),
      providesTags: ["ArchiveResults"]
    }),
    deleteSavedRun: build.mutation<DeleteSavedRunResponse, { runId: string }>({
      query: ({ runId }) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}`,
        method: "DELETE"
      }),
      invalidatesTags: ["ArchiveResults"]
    }),
    deleteStandaloneHeatmap: build.mutation<DeleteStandaloneHeatmapResponse, { jobId: string }>({
      query: ({ jobId }) => ({
        url: `/analysis/heatmap/${encodeURIComponent(jobId)}`,
        method: "DELETE"
      }),
      invalidatesTags: ["ArchiveResults"]
    })
  })
})

export const {
  useBuildStandaloneHeatmapAsyncMutation,
  useBuildRunHeatmapAsyncMutation,
  useBuildRunHeatmapMutation,
  useGetStandaloneHeatmapDetailsQuery,
  useGetStandaloneHeatmapListQuery,
  useValidateHeatmapUploadMutation,
  useGetAnalysisJobStatusQuery,
  useGetRunFilterOptionsQuery,
  useGetRunHeatmapHistoryQuery,
  useGetRunViewQuery,
  useGetSavedAnalysisListQuery,
  useGetSavedResultsByRunIdQuery,
  useDeleteStandaloneHeatmapMutation,
  useDeleteSavedRunMutation,
  useRunS3AsyncMutation
} = analysisApi
