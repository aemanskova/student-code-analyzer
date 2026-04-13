export interface InitS3MultipartUploadRequest {
  fileName: string;
  contentType?: string;
}

export interface InitS3MultipartUploadResponse {
  bucket: string;
  key: string;
  uploadId: string;
}

export interface PresignS3PartRequest {
  key: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds?: number;
}

export interface PresignS3PartResponse {
  url: string;
  key: string;
  uploadId: string;
  partNumber: number;
  expiresInSeconds: number;
}

export interface UploadS3PartRequest {
  url: string;
  body: Blob;
}

export interface UploadS3PartResponse {
  etag: string;
}

export interface CompleteS3MultipartUploadRequest {
  key: string;
  uploadId: string;
  parts: Array<{ partNumber: number; etag: string }>;
}

export interface CompleteS3MultipartUploadResponse {
  bucket: string;
  key: string;
  location: string | null;
  etag: string | null;
}

