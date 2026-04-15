import { Alert, Button, Group, Progress, Stack, Text } from "@mantine/core"

import { type UploadedArchiveInfo, useArchiveUpload } from "../model"

type Props = {
  file: File | null
  disabled?: boolean
  onUploaded: (archive: UploadedArchiveInfo | null) => void
}

export function ArchiveUploadStep({ file, disabled, onUploaded }: Props) {
  const {
    handleUpload,
    isUploading,
    progressPercent,
    statusText,
    toMb,
    uploadError,
    uploadedArchive
  } = useArchiveUpload({ disabled, file, onUploaded })

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
