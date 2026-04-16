import { Alert, Button, Group, Progress, Stack, Text } from "@mantine/core"

import { type UploadedArchiveInfo, useArchiveUpload } from "../model"

type Props = {
  file: File | null
  disabled?: boolean
  restoredArchiveName?: string
  onUploaded: (archive: UploadedArchiveInfo | null) => void
}

export function ArchiveUploadStep({ file, disabled, restoredArchiveName, onUploaded }: Props) {
  const {
    displayProgressPercent,
    handleUpload,
    isUploading,
    progressDetails,
    progressPercent,
    statusText,
    toMb,
    uploadError,
    uploadedArchive
  } = useArchiveUpload({ disabled, file, onUploaded })

  return (
    <Stack gap="md">
      <Progress value={displayProgressPercent} />

      <Text c="dimmed" size="xs">
        {!file && restoredArchiveName ? `Архив: ${restoredArchiveName}` : statusText}
        {uploadedArchive
          ? ` (${uploadedArchive.fileName}, ${toMb(uploadedArchive.fileSize)}, частей: ${uploadedArchive.partsTotal})`
          : ""}
      </Text>
      {progressDetails ? (
        <Text c="dimmed" size="xs">
          {progressDetails} · {Math.floor(progressPercent)}%
        </Text>
      ) : null}

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
