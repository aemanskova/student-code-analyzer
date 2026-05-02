export interface InitS3MultipartUploadRequest {
  fileName: string
  contentType?: string
}

export interface InitS3MultipartUploadResponse {
  bucket: string
  key: string
  uploadId: string
}

export interface PresignS3PartRequest {
  key: string
  uploadId: string
  partNumber: number
  expiresInSeconds?: number
}

export interface PresignS3PartResponse {
  url: string
  key: string
  uploadId: string
  partNumber: number
  expiresInSeconds: number
}

export interface PresignS3PartsRequest {
  key: string
  uploadId: string
  partNumbers: number[]
  expiresInSeconds?: number
}

export interface PresignS3PartsResponse {
  key: string
  uploadId: string
  expiresInSeconds: number
  urls: Array<{ partNumber: number; url: string }>
}

export interface UploadS3PartRequest {
  url: string
  body: Blob
  onProgress?: (loadedBytes: number, totalBytes: number) => void
  timeoutMs?: number
}

export interface UploadS3PartResponse {
  etag: string
}

export interface CompleteS3MultipartUploadRequest {
  key: string
  uploadId: string
  parts: Array<{ partNumber: number; etag: string }>
}

export interface CompleteS3MultipartUploadResponse {
  bucket: string
  key: string
  location: string | null
  etag: string | null
}

export interface AbortS3MultipartUploadRequest {
  key: string
  uploadId: string
}

export interface AbortS3MultipartUploadResponse {
  bucket: string
  key: string
  aborted: boolean
}

export interface DeleteS3ObjectRequest {
  key: string
}

export interface DeleteS3ObjectResponse {
  key: string
  deleted: boolean
}
