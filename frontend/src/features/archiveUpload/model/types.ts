export interface UploadChunkConfig {
  chunkSizeBytes: number
  maxConcurrent: number
}

export interface UploadedArchiveInfo {
  key: string
  fileName: string
  fileSize: number
  chunkSizeBytes: number
  partsTotal: number
}
