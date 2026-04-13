import { baseApi } from '@shared/api/baseApi';

import type {
  AnalysisJobStatusResponse,
  AnalysisListQuery,
  AnalysisListResponse,
  RunS3AsyncRequest,
  RunS3AsyncResponse,
  SavedResultsQuery,
  SavedResultsResponse,
  SavedRunResultsResponse,
} from './types';

export const analysisApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    runS3Async: build.mutation<RunS3AsyncResponse, RunS3AsyncRequest>({
      query: (body) => ({
        url: '/analysis/run/s3/async',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ArchiveResults'],
    }),
    getAnalysisJobStatus: build.query<AnalysisJobStatusResponse, string>({
      query: (jobId) => ({
        url: `/analysis/jobs/${encodeURIComponent(jobId)}`,
        method: 'GET',
      }),
    }),
    getSavedResults: build.query<SavedResultsResponse, SavedResultsQuery>({
      query: ({ path, direction }) => ({
        url: `/analysis/results?path=${encodeURIComponent(path)}&direction=${encodeURIComponent(direction)}`,
        method: 'GET',
      }),
      providesTags: ['ArchiveResults'],
    }),
    getSavedResultsByRunId: build.query<SavedRunResultsResponse, string>({
      query: (runId) => ({
        url: `/analysis/results/run/${encodeURIComponent(runId)}`,
        method: 'GET',
      }),
      providesTags: ['ArchiveResults'],
    }),
    getSavedAnalysisList: build.query<AnalysisListResponse, AnalysisListQuery>({
      query: ({ page, size }) => ({
        url: `/analysis/list?page=${encodeURIComponent(String(page))}&size=${encodeURIComponent(String(size))}`,
        method: 'GET',
      }),
      providesTags: ['ArchiveResults'],
    }),
  }),
});

export const {
  useGetAnalysisJobStatusQuery,
  useGetSavedAnalysisListQuery,
  useGetSavedResultsByRunIdQuery,
  useGetSavedResultsQuery,
  useRunS3AsyncMutation,
} = analysisApi;
