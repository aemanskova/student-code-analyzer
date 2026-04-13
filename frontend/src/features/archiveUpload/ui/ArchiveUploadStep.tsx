import {
  useCompleteS3MultipartUploadMutation,
  useInitS3MultipartUploadMutation,
  usePresignS3MultipartPartMutation,
  useUploadS3PartMutation
} from "@entities/s3Multipart"
import { Alert, Button, Group, Progress, Stack, Text } from "@mantine/core"
import { getApiErrorMessage } from "@shared/lib"
import { useEffect, useState } from "react"

import { resolveUploadChunkConfig, type UploadedArchiveInfo } from "../model"

type Props = {
  file: File | null
  disabled?: boolean
  onUploaded: (archive: UploadedArchiveInfo | null) => void
}

const toMb = (bytes: number): string => `${Math.max(1, Math.round(bytes / (1024 * 1024)))} МБ`

export function ArchiveUploadStep({ file, disabled, onUploaded }: Props) {
  const [initUpload] = useInitS3MultipartUploadMutation()
  const [presignPart] = usePresignS3MultipartPartMutation()
  const [uploadPart] = useUploadS3PartMutation()
  const [completeUpload] = useCompleteS3MultipartUploadMutation()

  const [isUploading, setIsUploading] = useState(false)
  const [statusText, setStatusText] = useState("Архив не загружен")
  const [progressPercent, setProgressPercent] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadedArchive, setUploadedArchive] = useState<UploadedArchiveInfo | null>(null)

  useEffect(() => {
    setIsUploading(false)
    setStatusText("Архив не загружен")
    setProgressPercent(0)
    setUploadError(null)
    setUploadedArchive(null)
    onUploaded(null)
  }, [file])

  const handleUpload = async () => {
    if (!file || isUploading || disabled) {
      return
    }

    const config = resolveUploadChunkConfig(file.size)
    const chunkSizeBytes = Math.max(1, config.chunkSizeBytes)
    const partsTotal = Math.max(1, Math.ceil(file.size / chunkSizeBytes))
    const maxConcurrent = Math.max(1, Math.min(config.maxConcurrent, partsTotal))

    setUploadError(null)
    setUploadedArchive(null)
    onUploaded(null)
    setProgressPercent(0)
    setIsUploading(true)
    setStatusText(
      `Подготовка загрузки (${toMb(chunkSizeBytes)} на часть, потоков: ${maxConcurrent})...`
    )

    try {
      const initResponse = await initUpload({
        fileName: file.name,
        contentType: file.type || "application/zip"
      }).unwrap()

      const completedParts: Array<{ partNumber: number; etag: string }> = []
      const loadedBytesByPart = new Map<number, number>()
      let nextPartNumber = 1

      const updateProgress = () => {
        if (file.size <= 0) {
          setProgressPercent(100)
          return
        }
        const loadedTotal = Array.from(loadedBytesByPart.values()).reduce(
          (sum, value) => sum + value,
          0
        )
        setProgressPercent(Math.max(0, Math.min(100, Math.round((loadedTotal / file.size) * 100))))
      }

      const worker = async () => {
        while (true) {
          const partNumber = nextPartNumber
          nextPartNumber += 1
          if (partNumber > partsTotal) {
            return
          }

          const start = (partNumber - 1) * chunkSizeBytes
          const end = Math.min(start + chunkSizeBytes, file.size)
          const chunk = file.slice(start, end)

          setStatusText(`Загрузка архива: часть ${partNumber} из ${partsTotal}`)
          const presigned = await presignPart({
            key: initResponse.key,
            uploadId: initResponse.uploadId,
            partNumber
          }).unwrap()

          const partUpload = await uploadPart({
            url: presigned.url,
            body: chunk
          }).unwrap()

          loadedBytesByPart.set(partNumber, chunk.size)
          updateProgress()
          completedParts.push({
            partNumber,
            etag: partUpload.etag
          })
        }
      }

      await Promise.all(Array.from({ length: maxConcurrent }, () => worker()))

      setStatusText("Подтверждение загруженного архива...")
      await completeUpload({
        key: initResponse.key,
        uploadId: initResponse.uploadId,
        parts: completedParts.sort((a, b) => a.partNumber - b.partNumber)
      }).unwrap()

      const uploaded: UploadedArchiveInfo = {
        key: initResponse.key,
        fileName: file.name,
        fileSize: file.size,
        chunkSizeBytes,
        partsTotal
      }
      setUploadedArchive(uploaded)
      setProgressPercent(100)
      setStatusText("Архив успешно загружен в хранилище")
      onUploaded(uploaded)
    } catch (error) {
      setUploadError(getApiErrorMessage(error, "Не удалось загрузить архив в хранилище."))
      setStatusText("Ошибка загрузки архива")
      onUploaded(null)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Stack gap={6}>
      <Progress value={progressPercent} />

      <Text c="dimmed" size="xs">
        {statusText}
        {uploadedArchive
          ? ` (${uploadedArchive.fileName}, ${toMb(uploadedArchive.fileSize)}, частей: ${uploadedArchive.partsTotal})`
          : ""}
      </Text>

      {uploadError ? <Alert color="red">{uploadError}</Alert> : null}

      {!uploadedArchive ? (
        <Group justify="flex-end">
          <Button
            disabled={!file || disabled}
            loading={isUploading}
            onClick={handleUpload}
            variant="default"
          >
            Загрузить архив
          </Button>
        </Group>
      ) : null}
    </Stack>
  )
}
