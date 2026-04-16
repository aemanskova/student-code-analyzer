import { AUTH_LOGOUT_EVENT } from "@shared/api/auth"
import { AuthContext, loadFromLS } from "@shared/lib"
import {
  ACCESS_TOKEN_KEY,
  clearStoredTokens,
  REFRESH_TOKEN_KEY,
  storeTokens
} from "@shared/lib/auth"
import { EMPTY_AUTH_INFO } from "@shared/lib/authContext"
import type { AuthContextModel, AuthInfo } from "@shared/model"
import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"

const readAuthInfoFromLs = (): AuthInfo => {
  const accessToken = loadFromLS<string>({ key: ACCESS_TOKEN_KEY }) || ""
  const refreshToken = loadFromLS<string>({ key: REFRESH_TOKEN_KEY }) || ""
  return { accessToken, refreshToken }
}

export const withAuth = (WrappedComponent: ComponentType) => () => {
  const [authInfo, setAuthInfo] = useState<AuthInfo>(readAuthInfoFromLs)
  const navigate = useNavigate()

  const login = useCallback(async (accessToken: string, refreshToken: string) => {
    setAuthInfo({ accessToken, refreshToken })
    storeTokens({ accessToken, refreshToken })
  }, [])

  const logout = useCallback(() => {
    setAuthInfo(EMPTY_AUTH_INFO)
    clearStoredTokens()
  }, [])

  const contextValue: AuthContextModel = useMemo(
    () => ({
      ...authInfo,
      login,
      logout
    }),
    [authInfo, login, logout]
  )

  useEffect(() => {
    const handleLogout = () => {
      setAuthInfo(EMPTY_AUTH_INFO)
      clearStoredTokens()
    }

    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout)

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout)
    }
  }, [navigate])

  return (
    <AuthContext.Provider value={contextValue}>
      <WrappedComponent />
    </AuthContext.Provider>
  )
}
