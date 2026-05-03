import { isPlainObject } from "./common"

type ErrorWithData = {
  status?: number | string
  error?: string
  message?: string
  data?: unknown
  details?: unknown
}

const extractText = (value: unknown): string | null => {
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

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (!error) {
    return fallback
  }

  if (isPlainObject(error)) {
    const typed = error as ErrorWithData
    const rawText =
      extractText(typed.message) ||
      extractText(typed.details) ||
      extractText(typed.data) ||
      extractText(typed.error) ||
      extractText(error)
    const text = (rawText || "").toLowerCase()

    if (text.includes("aborted")) {
      return "Запрос был прерван. Проверьте соединение и повторите попытку."
    }
    if (text.includes("unexpected end of file") || text.includes("file_ended")) {
      return "ZIP-архив поврежден или загружен не полностью. Пересоздайте архив и повторите попытку."
    }
    if (text.includes("failed to fetch")) {
      return "Нет соединения с сервером. Проверьте, что бэкенд запущен."
    }
    if (typed.status === 401) {
      return "Требуется авторизация. Войдите в систему снова."
    }
    if (typed.status === 413) {
      return "Архив слишком большой для загрузки."
    }
    if (rawText) {
      return rawText
    }
  }

  const directText = extractText(error)
  return directText || fallback
}
