import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"
import type { RefreshResponse } from "@shared/api/auth"
import { isPlainObject } from "@shared/lib"

export type AppQueryError = {
  status?: number | string
  originalStatus?: number
  message: string
  code?: string
  details?: unknown
}

export const isRefreshResponse = (value: unknown): value is RefreshResponse => {
  if (!value || !isPlainObject(value)) {
    return false
  }
  return "accessToken" in value && "refreshToken" in value
}

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/logout", "/auth/refresh"]

export const isAuthEndpoint = (url: string): boolean =>
  AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint))

const extractMessage = (value: unknown): string | null => {
  if (!value) {
    return null
  }
  if (typeof value === "string") {
    return value
  }
  if (value instanceof Error) {
    return value.message || null
  }
  if (isPlainObject(value) && typeof value.message === "string") {
    return value.message
  }
  return null
}

export const isUnauthorizedError = (error?: FetchBaseQueryError): boolean => {
  if (!error) {
    return false
  }

  if (typeof error.status === "number") {
    return error.status === 401
  }

  if (
    isPlainObject(error) &&
    "originalStatus" in error &&
    typeof error.originalStatus === "number"
  ) {
    return error.originalStatus === 401
  }

  return false
}

export const normalizeBaseQueryError = (error: FetchBaseQueryError): AppQueryError => {
  const status = error.status
  const originalStatus =
    isPlainObject(error) && "originalStatus" in error && typeof error.originalStatus === "number"
      ? error.originalStatus
      : undefined
  const details = "data" in error ? error.data : undefined
  const transportMessage = "error" in error ? error.error : undefined
  const message =
    extractMessage(details) ||
    extractMessage(transportMessage) ||
    (typeof status === "number" ? `HTTP ${status}` : "Запрос завершился с ошибкой")

  return {
    status,
    originalStatus,
    message,
    details
  }
}
