import { baseApi } from "@shared/api/baseApi"

import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  RegisterResponse,
  UpdateMeRequest
} from "./types"

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    login: build.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: "/auth/login",
        method: "POST",
        body
      }),
      invalidatesTags: ["Profile"]
    }),
    register: build.mutation<RegisterResponse, RegisterRequest>({
      query: (body) => ({
        url: "/auth/register",
        method: "POST",
        body
      }),
      invalidatesTags: ["Profile"]
    }),
    getMe: build.query<MeResponse, void>({
      query: () => ({
        url: "/users/me",
        method: "GET"
      }),
      providesTags: ["Profile"]
    }),
    updateMe: build.mutation<MeResponse, UpdateMeRequest>({
      query: (body) => ({
        url: "/users/me",
        method: "PATCH",
        body
      }),
      invalidatesTags: ["Profile"]
    })
  })
})

export const { useGetMeQuery, useLoginMutation, useRegisterMutation, useUpdateMeMutation } = authApi
