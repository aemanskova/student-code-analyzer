import { baseApi } from "@shared/api/baseApi"

import { buildFilterQueryParams } from "./queryParams"
import { analysisListTag, analysisRunTag, runFilterOptionsTag } from "./tags"
import type {
  AnalysisListQuery,
  AnalysisListResponse,
  DeleteSavedRunResponse,
  RunFilterOptionsResponse,
  RunFilterQuery,
  RunViewResponse,
  SavedRunDetailsResponse
} from "./types"

export const analysisResultsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getRunFilterOptions: build.query<RunFilterOptionsResponse, RunFilterQuery>({
      query: (query) => ({
        url: `/analysis/results/run/${encodeURIComponent(query.runId)}/select-options?${buildFilterQueryParams(query)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, query) => [
        analysisRunTag(query.runId),
        runFilterOptionsTag(query)
      ]
    }),
    getRunView: build.query<RunViewResponse, RunFilterQuery>({
      query: (query) => ({
        url: `/analysis/results/run/${encodeURIComponent(query.runId)}/view?${buildFilterQueryParams(query)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, query) => [analysisRunTag(query.runId)]
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
      providesTags: [analysisListTag]
    }),
    getSavedResultsByRunId: build.query<SavedRunDetailsResponse, string>({
      query: (runId) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, runId) => [analysisRunTag(runId)]
    }),
    deleteSavedRun: build.mutation<DeleteSavedRunResponse, { runId: string }>({
      query: ({ runId }) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}`,
        method: "DELETE"
      }),
      invalidatesTags: (_result, _error, { runId }) => [analysisListTag, analysisRunTag(runId)]
    })
  })
})

export const {
  useDeleteSavedRunMutation,
  useGetRunFilterOptionsQuery,
  useGetRunViewQuery,
  useGetSavedAnalysisListQuery,
  useGetSavedResultsByRunIdQuery
} = analysisResultsApi
