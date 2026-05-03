import type { BaseQueryFn, FetchArgs } from "@reduxjs/toolkit/query"
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { emitLogout } from "@shared/api/auth/hepler"
import { loadFromLS } from "@shared/lib"
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, storeTokens } from "@shared/lib/auth"

import {
  type AppQueryError,
  isAuthEndpoint,
  isRefreshResponse,
  isUnauthorizedError,
  normalizeBaseQueryError
} from "./utils"

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  prepareHeaders: (headers: Headers) => {
    const token = loadFromLS<string>({ key: ACCESS_TOKEN_KEY })
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    return headers
  }
})

const normalizeResult = (result: Awaited<ReturnType<typeof rawBaseQuery>>) =>
  result.error ? { error: normalizeBaseQueryError(result.error) } : result

const baseQueryFn: BaseQueryFn<string | FetchArgs, unknown, AppQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const requestUrl = typeof args === "string" ? args : args.url
  let result = await rawBaseQuery(args, api, extraOptions)

  if (!isUnauthorizedError(result.error) || isAuthEndpoint(requestUrl)) {
    return normalizeResult(result)
  }

  const refreshToken = loadFromLS<string>({ key: REFRESH_TOKEN_KEY })

  if (!refreshToken) {
    emitLogout()
    return normalizeResult(result)
  }

  const refreshResult = await rawBaseQuery(
    {
      url: "/auth/refresh",
      method: "POST",
      body: { refreshToken }
    },
    api,
    extraOptions
  )

  if (refreshResult.data && isRefreshResponse(refreshResult.data)) {
    const tokens = refreshResult.data
    if (tokens.accessToken && tokens.refreshToken) {
      storeTokens(tokens)
      result = await rawBaseQuery(args, api, extraOptions)
      return normalizeResult(result)
    }
  }

  emitLogout()
  return normalizeResult(result)
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryFn,
  tagTypes: [
    "AnalysisJob",
    "AnalysisList",
    "AnalysisRun",
    "Clusterization",
    "ClusterizationList",
    "Glossary",
    "Profile",
    "RunFilterOptions",
    "RunHeatmapHistory",
    "StandaloneHeatmap",
    "StandaloneHeatmapList"
  ],
  endpoints: () => ({})
})

export type { AppQueryError } from "./utils"
