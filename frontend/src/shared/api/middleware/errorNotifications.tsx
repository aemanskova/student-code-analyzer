import { notifications } from "@mantine/notifications"
import { XIcon } from "@phosphor-icons/react"
import { createListenerMiddleware, isRejectedWithValue, type Middleware } from "@reduxjs/toolkit"
import type { AppQueryError } from "@shared/api/baseApi"
import { isPlainObject } from "@shared/lib"

const getError = (payload: unknown): AppQueryError | null => {
  if (!payload || !isPlainObject(payload)) {
    return null
  }
  return payload as AppQueryError
}

const getStatus = (error: AppQueryError | null): number | string | null =>
  error?.status || error?.originalStatus || null

const getMessage = (error: AppQueryError | null): string => error?.message || "Попробуйте еще раз"

const errorNotificationsListener = createListenerMiddleware()

errorNotificationsListener.startListening({
  matcher: isRejectedWithValue,
  effect: (action) => {
    const error = getError(action.payload)
    const status = getStatus(error)
    const message = getMessage(error)

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
