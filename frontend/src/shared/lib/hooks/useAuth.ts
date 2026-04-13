import { useAuthContext } from "../authContext.ts"

export const useAuth = () => {
  const { accessToken } = useAuthContext()

  return {
    isAuthenticated: Boolean(accessToken)
  }
}
