import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@shared/api/baseApi"
import { errorNotificationsMiddleware } from "@shared/api/middleware"

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }).concat(baseApi.middleware, errorNotificationsMiddleware)
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
