import type { UploadChunkConfig } from "./types"

const MB = 1024 * 1024
const GB = 1024 * MB
const MIN_S3_MULTIPART_PART_MB = 5
const MAX_S3_MULTIPART_PARTS = 10_000
const MAX_UPLOAD_CONCURRENT = 6

const parsePositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return Math.trunc(parsed)
}

const getConfiguredPartSizeBytes = (): number | null => {
  const mb = parsePositiveInteger(import.meta.env.VITE_UPLOAD_PART_SIZE_MB)
  return mb ? Math.max(MIN_S3_MULTIPART_PART_MB, mb) * MB : null
}

const getConfiguredMaxConcurrent = (): number | null => {
  const value = parsePositiveInteger(import.meta.env.VITE_UPLOAD_MAX_CONCURRENT)
  return value ? Math.min(MAX_UPLOAD_CONCURRENT, value) : null
}

const getDefaultPartSizeBytes = (fileSizeBytes: number): number => {
  if (fileSizeBytes < 64 * MB) {
    return 8 * MB
  }

  if (fileSizeBytes < 512 * MB) {
    return 32 * MB
  }

  if (fileSizeBytes <= 2 * GB) {
    return 64 * MB
  }

  return 128 * MB
}

const getDefaultMaxConcurrent = (fileSizeBytes: number): number => {
  if (fileSizeBytes < 64 * MB) {
    return 4
  }

  if (fileSizeBytes < 512 * MB) {
    return 6
  }

  return 8
}

export const resolveUploadChunkConfig = (fileSizeBytes: number): UploadChunkConfig => {
  const configuredPartSizeBytes = getConfiguredPartSizeBytes()
  const configuredMaxConcurrent = getConfiguredMaxConcurrent()
  const minimumPartSizeForS3Limit = Math.ceil(fileSizeBytes / MAX_S3_MULTIPART_PARTS)
  const chunkSizeBytes = Math.max(
    configuredPartSizeBytes ?? getDefaultPartSizeBytes(fileSizeBytes),
    minimumPartSizeForS3Limit
  )
  return {
    chunkSizeBytes: Math.min(Math.max(1, fileSizeBytes), chunkSizeBytes),
    maxConcurrent: configuredMaxConcurrent ?? getDefaultMaxConcurrent(fileSizeBytes)
  }
}
