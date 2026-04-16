export interface LoginRequest {
  identifier: string
  password: string
}

export interface LoginResponse {
  accessToken?: string
  refreshToken?: string
  message?: string
}

export interface RegisterRequest {
  name: string
  surname: string
  email: string
  password: string
  github?: string
}

export interface RegisterResponse {
  message: string
}

export interface RefreshResponse {
  accessToken?: string
  refreshToken?: string
}

export interface UserRole {
  id: number
  name: string
}

export interface MeResponse {
  id: number
  email: string
  name: string
  surname: string
  github: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  role: UserRole | null
}

export interface UpdateMeRequest {
  name?: string
  surname?: string
  email?: string
  github?: string | null
}
