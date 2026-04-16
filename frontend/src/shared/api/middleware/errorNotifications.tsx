import { notifications } from "@mantine/notifications"
import { XIcon } from "@phosphor-icons/react"
import { createListenerMiddleware, isRejectedWithValue, type Middleware } from "@reduxjs/toolkit"
import { isPlainObject } from "@shared/lib"

type ErrorPayload = {
  status?: number | string
  originalStatus?: number
}

const getStatus = (payload: unknown): number | string | null => {
  if (!payload || !isPlainObject(payload)) {
    return null
  }

  const error = payload as ErrorPayload

  if (typeof error.status === "number" || typeof error.status === "string") {
    return error.status
  }

  if (typeof error.originalStatus === "number") {
    return error.originalStatus
  }

  return null
}

const getMessage = (payload: unknown): string => {
  const error = payload as ErrorPayload

  if (
    isPlainObject(error) &&
    "data" in error &&
    isPlainObject(error.data) &&
    "message" in error.data &&
    error.data.message &&
    typeof error.data.message === "string"
  ) {
    return error.data.message
  }

  return "Попробуйте еще раз"
}

const errorNotificationsListener = createListenerMiddleware()

errorNotificationsListener.startListening({
  matcher: isRejectedWithValue,
  effect: (action) => {
    const status = getStatus(action.payload)
    const message = getMessage(action.payload)

    notifications.show({
      title: status ? `Запрос завершился с ошибкой: ${status}` : "Запрос завершился с ошибкой",
      message: `${message}`,
      icon: <XIcon size={20} />,
      position: "top-right",
      color: "red"
    })
  }
})

export const errorNotificationsMiddleware = errorNotificationsListener.middleware as Middleware
