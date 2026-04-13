export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  message?: string;
}

export interface RegisterRequest {
  name: string;
  surname: string;
  email: string;
  password: string;
  github?: string;
}

export interface RegisterResponse {
  message: string;
}
