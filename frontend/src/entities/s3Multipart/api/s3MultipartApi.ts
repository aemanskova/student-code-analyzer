import { baseApi } from "@shared/api/baseApi"

import type {
  CompleteS3MultipartUploadRequest,
  CompleteS3MultipartUploadResponse,
  InitS3MultipartUploadRequest,
  InitS3MultipartUploadResponse,
  PresignS3PartRequest,
  PresignS3PartResponse,
  UploadS3PartRequest,
  UploadS3PartResponse
} from "./types"

export const s3MultipartApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    initS3MultipartUpload: build.mutation<
      InitS3MultipartUploadResponse,
      InitS3MultipartUploadRequest
    >({
      query: (body) => ({
        url: "/s3/multipart/init",
        method: "POST",
        body
      })
    }),
    presignS3MultipartPart: build.mutation<PresignS3PartResponse, PresignS3PartRequest>({
      query: (body) => ({
        url: "/s3/multipart/presign-part",
        method: "POST",
        body
      })
    }),
    uploadS3Part: build.mutation<UploadS3PartResponse, UploadS3PartRequest>({
      async queryFn(arg) {
        let response: Response
        try {
          response = await fetch(arg.url, {
            method: "PUT",
            body: arg.body
          })
        } catch (error) {
          return {
            error: {
              status: "FETCH_ERROR",
              error: error instanceof Error ? error.message : "Не удалось загрузить часть файла"
            }
          }
        }

        if (!response.ok) {
          const text = await response.text().catch(() => "")
          return {
            error: {
              status: response.status,
              data: text,
              error: `Upload part failed with status ${response.status}`
            }
          }
        }

        const etagRaw = response.headers.get("etag") || response.headers.get("ETag")
        if (!etagRaw) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              data: "Хранилище не вернуло ETag для загруженной части",
              error: "ETag is missing"
            }
          }
        }

        return {
          data: {
            etag: etagRaw.replaceAll('"', "")
          }
        }
      }
    }),
    completeS3MultipartUpload: build.mutation<
      CompleteS3MultipartUploadResponse,
      CompleteS3MultipartUploadRequest
    >({
      query: (body) => ({
        url: "/s3/multipart/complete",
        method: "POST",
        body
      })
    })
  })
})

export const {
  useCompleteS3MultipartUploadMutation,
  useInitS3MultipartUploadMutation,
  usePresignS3MultipartPartMutation,
  useUploadS3PartMutation
} = s3MultipartApi
