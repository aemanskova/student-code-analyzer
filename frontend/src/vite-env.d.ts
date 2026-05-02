/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_UPLOAD_PART_SIZE_MB?: string
  readonly VITE_UPLOAD_MAX_CONCURRENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
