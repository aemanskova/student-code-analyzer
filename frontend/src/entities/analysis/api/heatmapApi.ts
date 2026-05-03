import { baseApi } from "@shared/api/baseApi"

import { buildLevelsBody } from "./queryParams"
import {
  analysisRunTag,
  runHeatmapHistoryTag,
  standaloneHeatmapListTag,
  standaloneHeatmapTag
} from "./tags"
import type {
  BuildRunHeatmapAsyncRequest,
  BuildRunHeatmapRequest,
  BuildRunHeatmapResponse,
  BuildStandaloneHeatmapAsyncRequest,
  DeleteStandaloneHeatmapResponse,
  HeatmapLimitValidationResponse,
  HeatmapValidateUploadRequest,
  RunHeatmapHistoryResponse,
  RunS3AsyncResponse,
  StandaloneHeatmapItem,
  StandaloneHeatmapListQuery,
  StandaloneHeatmapListResponse
} from "./types"

export const heatmapApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
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
    getRunHeatmapHistory: build.query<RunHeatmapHistoryResponse, { runId: string }>({
      query: ({ runId }) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}/heatmap/history`,
        method: "GET"
      }),
      providesTags: (_result, _error, { runId }) => [runHeatmapHistoryTag(runId)]
    }),
    buildRunHeatmap: build.mutation<BuildRunHeatmapResponse, BuildRunHeatmapRequest>({
      query: (body) => ({
        url: `/analysis/results/run/${encodeURIComponent(body.runId)}/heatmap/build`,
        method: "POST",
        body: buildLevelsBody(body.depth, body.selectedLevels)
      }),
      invalidatesTags: (_result, _error, body) => [
        analysisRunTag(body.runId),
        runHeatmapHistoryTag(body.runId)
      ]
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
      invalidatesTags: [standaloneHeatmapListTag]
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
      providesTags: [standaloneHeatmapListTag]
    }),
    getStandaloneHeatmapDetails: build.query<StandaloneHeatmapItem, string>({
      query: (jobId) => ({
        url: `/analysis/heatmap/${encodeURIComponent(jobId)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, jobId) => [standaloneHeatmapTag(jobId)]
    }),
    deleteStandaloneHeatmap: build.mutation<DeleteStandaloneHeatmapResponse, { jobId: string }>({
      query: ({ jobId }) => ({
        url: `/analysis/heatmap/${encodeURIComponent(jobId)}`,
        method: "DELETE"
      }),
      invalidatesTags: (_result, _error, { jobId }) => [
        standaloneHeatmapListTag,
        standaloneHeatmapTag(jobId)
      ]
    })
  })
})

export const {
  useBuildStandaloneHeatmapAsyncMutation,
  useBuildRunHeatmapAsyncMutation,
  useBuildRunHeatmapMutation,
  useDeleteStandaloneHeatmapMutation,
  useGetRunHeatmapHistoryQuery,
  useGetStandaloneHeatmapDetailsQuery,
  useGetStandaloneHeatmapListQuery,
  useValidateHeatmapUploadMutation
} = heatmapApi
