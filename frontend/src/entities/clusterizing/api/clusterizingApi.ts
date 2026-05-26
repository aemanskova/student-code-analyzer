import { baseApi } from "@shared/api/baseApi"

import type {
  ClusterizationDetailsResponse,
  ClusterizationListResponse,
  DeleteClusterizationResponse
} from "./types"

const clusterizationListTag = { type: "ClusterizationList" as const, id: "LIST" }
const clusterizationTag = (jobId: string) => ({ type: "Clusterization" as const, id: jobId })

export const clusterizingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getClusterizationList: build.query<ClusterizationListResponse, void>({
      query: () => ({
        url: "/clustering/list",
        method: "GET"
      }),
      providesTags: [clusterizationListTag]
    }),
    buildClusterization: build.mutation<ClusterizationDetailsResponse, { runId: string }>({
      query: ({ runId }) => ({
        body: {},
        url: `/clustering/run/${encodeURIComponent(runId)}/build`,
        method: "POST"
      }),
      invalidatesTags: [clusterizationListTag]
    }),
    getClusterizationDetails: build.query<ClusterizationDetailsResponse, string>({
      query: (jobId) => ({
        url: `/clustering/jobs/${encodeURIComponent(jobId)}`,
        method: "GET"
      }),
      providesTags: (_result, _error, jobId) => [clusterizationTag(jobId)]
    }),
    deleteClusterization: build.mutation<DeleteClusterizationResponse, { jobId: string }>({
      query: ({ jobId }) => ({
        url: `/clustering/jobs/${encodeURIComponent(jobId)}`,
        method: "DELETE"
      }),
      invalidatesTags: (_result, _error, { jobId }) => [
        clusterizationListTag,
        clusterizationTag(jobId)
      ]
    })
  })
})

export const {
  useBuildClusterizationMutation,
  useDeleteClusterizationMutation,
  useGetClusterizationDetailsQuery,
  useGetClusterizationListQuery
} = clusterizingApi
