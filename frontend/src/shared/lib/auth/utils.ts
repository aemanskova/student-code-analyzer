import type { RefreshResponse } from "@shared/api/auth/types.ts"
import { clearLS, saveToLocaleStorage } from "@shared/lib"

import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from "./constants"

export const clearStoredTokens = () => {
  clearLS({ key: ACCESS_TOKEN_KEY })
  clearLS({ key: REFRESH_TOKEN_KEY })
}

export const storeTokens = (tokens: RefreshResponse) => {
  saveToLocaleStorage({ key: ACCESS_TOKEN_KEY, state: tokens.accessToken })
  saveToLocaleStorage({ key: REFRESH_TOKEN_KEY, state: tokens.refreshToken })
}
