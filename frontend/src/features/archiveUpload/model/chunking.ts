import type { UploadChunkConfig } from "./types"

const MB = 1024 * 1024
const GB = 1024 * MB

export const resolveUploadChunkConfig = (fileSizeBytes: number): UploadChunkConfig => {
  if (fileSizeBytes < 64 * MB) {
    return {
      chunkSizeBytes: fileSizeBytes,
      maxConcurrent: 1
    }
  }

  if (fileSizeBytes < 512 * MB) {
    return {
      chunkSizeBytes: 64 * MB,
      maxConcurrent: 4
    }
  }

  if (fileSizeBytes <= 2 * GB) {
    return {
      chunkSizeBytes: 128 * MB,
      maxConcurrent: 8
    }
  }

  if (fileSizeBytes <= 5 * GB) {
    return {
      chunkSizeBytes: 128 * MB,
      maxConcurrent: 10
    }
  }

  return {
    chunkSizeBytes: 256 * MB,
    maxConcurrent: 10
  }
}
