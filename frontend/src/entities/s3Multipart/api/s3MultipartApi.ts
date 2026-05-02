import { baseApi } from "@shared/api/baseApi"
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"

import type {
  AbortS3MultipartUploadRequest,
  AbortS3MultipartUploadResponse,
  CompleteS3MultipartUploadRequest,
  CompleteS3MultipartUploadResponse,
  DeleteS3ObjectRequest,
  DeleteS3ObjectResponse,
  InitS3MultipartUploadRequest,
  InitS3MultipartUploadResponse,
  PresignS3PartRequest,
  PresignS3PartResponse,
  PresignS3PartsRequest,
  PresignS3PartsResponse,
  UploadS3PartRequest,
  UploadS3PartResponse
} from "./types"

type XhrUploadResult = { ok: true; etag: string } | { ok: false; error: FetchBaseQueryError }

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
    presignS3MultipartParts: build.mutation<PresignS3PartsResponse, PresignS3PartsRequest>({
      query: (body) => ({
        url: "/s3/multipart/presign-parts",
        method: "POST",
        body
      })
    }),
    uploadS3Part: build.mutation<UploadS3PartResponse, UploadS3PartRequest>({
      async queryFn(arg) {
        const result = await new Promise<XhrUploadResult>((resolve) => {
          const request = new XMLHttpRequest()
          request.open("PUT", arg.url)
          if (arg.timeoutMs && arg.timeoutMs > 0) {
            request.timeout = arg.timeoutMs
          }
          request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              arg.onProgress?.(event.loaded, event.total)
            }
          }
          request.onerror = () => {
            resolve({
              ok: false,
              error: {
                status: "FETCH_ERROR",
                error: "Не удалось загрузить часть файла"
              }
            })
          }
          request.onabort = () => {
            resolve({
              ok: false,
              error: {
                status: "CUSTOM_ERROR",
                error: "Загрузка части файла была прервана"
              }
            })
          }
          request.ontimeout = () => {
            resolve({
              ok: false,
              error: {
                status: "TIMEOUT_ERROR",
                error: "Истекло время ожидания загрузки части файла"
              }
            })
          }
          request.onload = () => {
            if (request.status < 200 || request.status >= 300) {
              resolve({
                ok: false,
                error: {
                  status: request.status,
                  data:
                    request.responseText ||
                    request.statusText ||
                    `Не удалось загрузить часть файла: HTTP ${request.status}`
                }
              })
              return
            }
            const etagRaw = request.getResponseHeader("etag") || request.getResponseHeader("ETag")
            if (!etagRaw) {
              resolve({
                ok: false,
                error: {
                  status: "CUSTOM_ERROR",
                  data: "Хранилище не вернуло ETag для загруженной части",
                  error: "ETag is missing"
                }
              })
              return
            }
            arg.onProgress?.(arg.body.size, arg.body.size)
            resolve({ ok: true, etag: etagRaw.replaceAll('"', "") })
          }
          request.send(arg.body)
        })

        if (!result.ok) {
          return {
            error: result.error
          }
        }

        return {
          data: {
            etag: result.etag
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
    }),
    abortS3MultipartUpload: build.mutation<
      AbortS3MultipartUploadResponse,
      AbortS3MultipartUploadRequest
    >({
      query: (body) => ({
        url: "/s3/multipart/abort",
        method: "POST",
        body
      })
    }),
    deleteS3Object: build.mutation<DeleteS3ObjectResponse, DeleteS3ObjectRequest>({
      query: (body) => ({
        url: "/s3/object/delete",
        method: "POST",
        body
      })
    })
  })
})

export const {
  useAbortS3MultipartUploadMutation,
  useCompleteS3MultipartUploadMutation,
  useDeleteS3ObjectMutation,
  useInitS3MultipartUploadMutation,
  usePresignS3MultipartPartMutation,
  usePresignS3MultipartPartsMutation,
  useUploadS3PartMutation
} = s3MultipartApi
