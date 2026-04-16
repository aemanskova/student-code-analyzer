export type AuthInfo = {
  accessToken: string
  refreshToken: string
}

export type AuthContextModel = AuthInfo & {
  login: (accessToken: string, refreshToken: string) => void
  logout: VoidFunction
}
