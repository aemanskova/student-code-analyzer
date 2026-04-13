import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query"
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"
import { emitLogout } from "@shared/api/auth/hepler"
import { loadFromLS } from "@shared/lib"
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, storeTokens } from "@shared/lib/auth"

import { isAuthEndpoint, isRefreshResponse, isUnauthorizedError } from "./utils"

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

const baseQueryFn: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const requestUrl = typeof args === "string" ? args : args.url
  let result = await rawBaseQuery(args, api, extraOptions)

  if (!isUnauthorizedError(result.error) || isAuthEndpoint(requestUrl)) {
    return result
  }

  const refreshToken = loadFromLS<string>({ key: REFRESH_TOKEN_KEY })

  if (!refreshToken) {
    emitLogout()
    return result
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
      return result
    }
  }

  emitLogout()
  return result
}

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: baseQueryFn,
  tagTypes: ["ArchiveResults", "Profile"],
  endpoints: () => ({})
})
