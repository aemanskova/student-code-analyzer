import { baseApi } from "@shared/api/baseApi"

import type {
  AnalysisJobStatusResponse,
  AnalysisListQuery,
  AnalysisListResponse,
  DeleteSavedRunResponse,
  RunFilterOptionsResponse,
  RunFilterQuery,
  RunS3AsyncRequest,
  RunS3AsyncResponse,
  RunViewResponse
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
    deleteSavedRun: build.mutation<DeleteSavedRunResponse, { runId: string }>({
      query: ({ runId }) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}`,
        method: "DELETE"
      }),
      invalidatesTags: ["ArchiveResults"]
    })
  })
})

export const {
  useGetAnalysisJobStatusQuery,
  useGetRunFilterOptionsQuery,
  useGetRunViewQuery,
  useGetSavedAnalysisListQuery,
  useDeleteSavedRunMutation,
  useRunS3AsyncMutation
} = analysisApi
