import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import type { RefreshResponse } from "@shared/api/auth"
import { isPlainObject } from "@shared/lib"

export const isRefreshResponse = (value: unknown): value is RefreshResponse => {
  if (!value || !isPlainObject(value)) {
    return false
  }
  return "accessToken" in value && "refreshToken" in value
}

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/logout", "/auth/refresh"]

export const isAuthEndpoint = (url: string): boolean =>
  AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint))

export const isUnauthorizedError = (error?: FetchBaseQueryError): boolean => {
  if (!error) {
    return false
  }

  if (typeof error.status === "number") {
    return error.status === 401
  }

  if ("originalStatus" in error && typeof error.originalStatus === "number") {
    return error.originalStatus === 401
  }

  return false
}
