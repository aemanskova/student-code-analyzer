import type { UploadChunkConfig } from './types';

const MB = 1024 * 1024;
const GB = 1024 * MB;

export const resolveUploadChunkConfig = (fileSizeBytes: number): UploadChunkConfig => {
  if (fileSizeBytes < 100 * MB) {
    return {
      chunkSizeBytes: fileSizeBytes,
      maxConcurrent: 1,
    };
  }

  if (fileSizeBytes <= GB) {
    return {
      chunkSizeBytes: 10 * MB,
      maxConcurrent: 4,
    };
  }

  if (fileSizeBytes <= 5 * GB) {
    return {
      chunkSizeBytes: 25 * MB,
      maxConcurrent: 5,
    };
  }

  return {
    chunkSizeBytes: 100 * MB,
    maxConcurrent: 6,
  };
};

