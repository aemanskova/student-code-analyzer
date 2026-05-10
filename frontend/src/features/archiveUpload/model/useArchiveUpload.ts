import {
  useAbortS3MultipartUploadMutation,
  useCompleteS3MultipartUploadMutation,
  useInitS3MultipartUploadMutation,
  usePresignS3MultipartPartMutation,
  usePresignS3MultipartPartsMutation,
  useUploadS3PartMutation
} from "@entities/s3Multipart"
import { getApiErrorMessage } from "@shared/lib"
import { useCallback, useEffect, useRef, useState } from "react"

import { resolveUploadChunkConfig } from "./chunking"
import type { UploadedArchiveInfo } from "./types"

type Params = {
  file: File | null
  disabled?: boolean
  onUploaded: (archive: UploadedArchiveInfo | null) => void
}

const toMb = (bytes: number): string => `${Math.max(1, Math.round(bytes / (1024 * 1024)))} МБ`
const toPreciseMb = (bytes: number): string =>
  `${(Math.max(0, bytes) / (1024 * 1024)).toFixed(1)} МБ`
const toSeconds = (startedAt: number): number => Math.max(0, (Date.now() - startedAt) / 1000)
const formatSeconds = (seconds: number): string => {
  const rounded = Math.round(seconds)
  const minutes = Math.floor(rounded / 60)
  const rest = rounded % 60
  return minutes > 0 ? `${minutes} мин. ${rest.toString().padStart(2, "0")} сек.` : `${rest} сек.`
}
const PRESIGN_BATCH_SIZE = 16
const PRESIGN_EXPIRES_IN_SECONDS = 3600
const MAX_PART_UPLOAD_ATTEMPTS = 4
const PART_UPLOAD_RETRY_BASE_DELAY_MS = 1200
const PART_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000

const wait = (delayMs: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, delayMs)
  })

export const useArchiveUpload = ({ file, disabled, onUploaded }: Params) => {
  const onUploadedRef = useRef(onUploaded)

  const [initUpload] = useInitS3MultipartUploadMutation()
  const [presignPart] = usePresignS3MultipartPartMutation()
  const [presignParts] = usePresignS3MultipartPartsMutation()
  const [uploadPart] = useUploadS3PartMutation()
  const [completeUpload] = useCompleteS3MultipartUploadMutation()
  const [abortUpload] = useAbortS3MultipartUploadMutation()

  const [isUploading, setIsUploading] = useState(false)
  const [statusText, setStatusText] = useState("Архив не загружен")
  const [progressPercent, setProgressPercent] = useState(0)
  const [displayProgressPercent, setDisplayProgressPercent] = useState(0)
  const [progressDetails, setProgressDetails] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedArchive, setUploadedArchive] = useState<UploadedArchiveInfo | null>(null)
  const progressPercentRef = useRef(0)

  useEffect(() => {
    onUploadedRef.current = onUploaded
  }, [onUploaded])

  useEffect(() => {
    progressPercentRef.current = progressPercent
  }, [progressPercent])

  useEffect(() => {
    setIsUploading(false)
    setStatusText("Архив не загружен")
    setProgressPercent(0)
    setDisplayProgressPercent(0)
    setProgressDetails("")
    setUploadError(null)
    setUploadedArchive(null)
    onUploadedRef.current(null)
  }, [file])

  const handleUpload = useCallback(async () => {
    if (!file || isUploading || disabled) {
      return
    }

    const config = resolveUploadChunkConfig(file.size)
    const chunkSizeBytes = Math.max(1, config.chunkSizeBytes)
    const partsTotal = Math.max(1, Math.ceil(file.size / chunkSizeBytes))
    const maxConcurrent = Math.max(1, Math.min(config.maxConcurrent, partsTotal))

    setUploadError(null)
    setUploadedArchive(null)
    onUploadedRef.current(null)
    setProgressPercent(0)
    setDisplayProgressPercent(0)
    setProgressDetails("")
    setIsUploading(true)
    setStatusText(
      `Подготовка загрузки (${toMb(chunkSizeBytes)} на часть, потоков: ${maxConcurrent})...`
    )

    let uploadRef: { key: string; uploadId: string } | null = null

    try {
      const initResponse = await initUpload({
        fileName: file.name,
        contentType: file.type || "application/zip"
      }).unwrap()
      uploadRef = {
        key: initResponse.key,
        uploadId: initResponse.uploadId
      }
      const completedParts: Array<{ partNumber: number; etag: string }> = []
      const loadedBytesByPart = new Map<number, number>()
      const uploadStartedAt = Date.now()
      let presignSeconds = 0
      let nextPartNumber = 1
      let shouldStopUpload = false

      const updateProgress = () => {
        if (file.size <= 0) {
          setProgressPercent(100)
          setDisplayProgressPercent(100)
          return
        }
        const loadedTotal = Array.from(loadedBytesByPart.values()).reduce(
          (sum, value) => sum + value,
          0
        )
        const nextPercent = Math.max(0, Math.min(100, (loadedTotal / file.size) * 100))
        const elapsedSeconds = Math.max(1, (Date.now() - uploadStartedAt) / 1000)
        const speedBytesPerSecond = loadedTotal / elapsedSeconds
        const remainingBytes = Math.max(0, file.size - loadedTotal)
        const remainingSeconds =
          speedBytesPerSecond > 0 ? Math.ceil(remainingBytes / speedBytesPerSecond) : null
        setProgressPercent(nextPercent)
        setProgressDetails(
          [
            `${toPreciseMb(loadedTotal)} из ${toPreciseMb(file.size)}`,
            `${toPreciseMb(speedBytesPerSecond)}/с`,
            remainingSeconds !== null ? `осталось ~${remainingSeconds} сек.` : null
          ]
            .filter(Boolean)
            .join(" · ")
        )
      }

      const presignedUrls = new Map<number, string>()
      const presignBatchPromises = new Map<number, Promise<void>>()

      const ensurePresignedUrl = async (
        partNumber: number,
        forceFresh = false
      ): Promise<string> => {
        if (forceFresh) {
          presignedUrls.delete(partNumber)
          const presignStartedAt = Date.now()
          const refreshed = await presignPart({
            key: initResponse.key,
            uploadId: initResponse.uploadId,
            partNumber,
            expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS
          }).unwrap()
          presignSeconds += toSeconds(presignStartedAt)
          presignedUrls.set(partNumber, refreshed.url)
          return refreshed.url
        }

        const existing = presignedUrls.get(partNumber)
        if (existing) {
          return existing
        }

        const batchStart =
          Math.floor((partNumber - 1) / PRESIGN_BATCH_SIZE) * PRESIGN_BATCH_SIZE + 1
        const batchEnd = Math.min(partsTotal, batchStart + PRESIGN_BATCH_SIZE - 1)
        let batchPromise = presignBatchPromises.get(batchStart)
        if (!batchPromise) {
          const partNumbers = Array.from(
            { length: batchEnd - batchStart + 1 },
            (_, index) => batchStart + index
          )
          setStatusText(
            `Подготовка ссылок для загрузки: ${batchStart}-${batchEnd} из ${partsTotal}`
          )
          const presignStartedAt = Date.now()
          batchPromise = presignParts({
            key: initResponse.key,
            uploadId: initResponse.uploadId,
            partNumbers,
            expiresInSeconds: PRESIGN_EXPIRES_IN_SECONDS
          })
            .unwrap()
            .then((batch) => {
              presignSeconds += toSeconds(presignStartedAt)
              batch.urls.forEach((item) => {
                presignedUrls.set(item.partNumber, item.url)
              })
            })
          presignBatchPromises.set(batchStart, batchPromise)
        }

        await batchPromise
        const url = presignedUrls.get(partNumber)
        if (!url) {
          throw new Error(`Не удалось подготовить ссылку для части ${partNumber}`)
        }
        return url
      }

      const worker = async () => {
        while (true) {
          if (shouldStopUpload) {
            return
          }

          const partNumber = nextPartNumber
          nextPartNumber += 1
          if (partNumber > partsTotal) {
            return
          }

          const start = (partNumber - 1) * chunkSizeBytes
          const end = Math.min(start + chunkSizeBytes, file.size)
          const chunk = file.slice(start, end)
          let lastError: unknown = null

          for (let attempt = 1; attempt <= MAX_PART_UPLOAD_ATTEMPTS; attempt += 1) {
            try {
              const retryText = attempt > 1 ? `, попытка ${attempt}` : ""
              setStatusText(`Загрузка архива: часть ${partNumber} из ${partsTotal}${retryText}`)

              const url = await ensurePresignedUrl(partNumber, attempt > 1)
              const partUpload = await uploadPart({
                url,
                body: chunk,
                timeoutMs: PART_UPLOAD_TIMEOUT_MS,
                onProgress: (loadedBytes) => {
                  loadedBytesByPart.set(partNumber, Math.min(chunk.size, loadedBytes))
                  updateProgress()
                }
              }).unwrap()

              loadedBytesByPart.set(partNumber, chunk.size)
              updateProgress()
              completedParts.push({ partNumber, etag: partUpload.etag })
              lastError = null
              break
            } catch (error) {
              lastError = error
              presignedUrls.delete(partNumber)
              loadedBytesByPart.delete(partNumber)
              updateProgress()

              if (attempt < MAX_PART_UPLOAD_ATTEMPTS) {
                setStatusText(
                  `Повтор загрузки части ${partNumber} из ${partsTotal}: попытка ${attempt + 1}`
                )
                await wait(PART_UPLOAD_RETRY_BASE_DELAY_MS * attempt)
              }
            }
          }

          if (lastError) {
            shouldStopUpload = true
            const reason = getApiErrorMessage(lastError, "Не удалось загрузить часть файла")
            throw new Error(
              `Не удалось загрузить часть ${partNumber} из ${partsTotal} после ${MAX_PART_UPLOAD_ATTEMPTS} попыток. ${reason}`
            )
          }
        }
      }

      const workerResults = await Promise.allSettled(
        Array.from({ length: maxConcurrent }, () => worker())
      )
      const failedWorker = workerResults.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      )
      if (failedWorker) {
        throw failedWorker.reason
      }
      setStatusText("Подтверждение загруженного архива...")

      const completeStartedAt = Date.now()
      await completeUpload({
        key: initResponse.key,
        uploadId: initResponse.uploadId,
        parts: completedParts.sort((a, b) => a.partNumber - b.partNumber)
      }).unwrap()
      const completeSeconds = toSeconds(completeStartedAt)
      const uploadSeconds = toSeconds(uploadStartedAt)

      const uploaded: UploadedArchiveInfo = {
        key: initResponse.key,
        fileName: file.name,
        fileSize: file.size,
        chunkSizeBytes,
        partsTotal,
        uploadSeconds,
        presignSeconds,
        completeSeconds
      }
      setUploadedArchive(uploaded)
      setProgressPercent(100)
      setDisplayProgressPercent(100)
      setProgressDetails(
        [
          `${toPreciseMb(file.size)} из ${toPreciseMb(file.size)}`,
          `итого ${formatSeconds(uploadSeconds)}`,
          `ссылки ${formatSeconds(presignSeconds)}`,
          `подтверждение ${formatSeconds(completeSeconds)}`
        ].join(" · ")
      )
      setStatusText("Архив успешно загружен в хранилище")
      onUploadedRef.current(uploaded)
    } catch (error) {
      if (uploadRef) {
        await abortUpload(uploadRef)
          .unwrap()
          .catch(() => undefined)
      }
      setUploadError(getApiErrorMessage(error, "Не удалось загрузить архив в хранилище."))
      setStatusText("Ошибка загрузки архива")
      setProgressDetails("")
      onUploadedRef.current(null)
    } finally {
      setIsUploading(false)
    }
  }, [
    abortUpload,
    completeUpload,
    disabled,
    file,
    initUpload,
    isUploading,
    presignPart,
    presignParts,
    uploadPart
  ])

  useEffect(() => {
    if (!isUploading) {
      setDisplayProgressPercent(progressPercentRef.current)
      return
    }

    const frame = window.setInterval(() => {
      setDisplayProgressPercent((current) => {
        const targetProgress = progressPercentRef.current
        if (targetProgress >= 100) {
          return 100
        }
        const target = Math.min(targetProgress, 99)
        if (current >= target) {
          return current
        }
        return current + Math.max(0.15, (target - current) * 0.18)
      })
    }, 120)
    return () => window.clearInterval(frame)
  }, [isUploading])

  return {
    displayProgressPercent,
    handleUpload,
    isUploading,
    progressPercent,
    progressDetails,
    statusText,
    toMb,
    uploadError,
    uploadedArchive
  }
}
