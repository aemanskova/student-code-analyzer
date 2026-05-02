import { baseApi } from "@shared/api/baseApi"

import { analysisJobTag, analysisListTag } from "./tags"
import type { AnalysisJobStatusResponse, RunS3AsyncRequest, RunS3AsyncResponse } from "./types"

export const analysisJobsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    runS3Async: build.mutation<RunS3AsyncResponse, RunS3AsyncRequest>({
      query: (body) => ({
        url: "/analysis/run/s3/async",
        method: "POST",
        body
      }),
      invalidatesTags: [analysisListTag]
    }),
    getAnalysisJobStatus: build.query<AnalysisJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/analysis/jobs/${encodeURIComponent(jobId)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, jobId) => [analysisJobTag(jobId)]
    })
  })
})

export const { useGetAnalysisJobStatusQuery, useRunS3AsyncMutation } = analysisJobsApi
