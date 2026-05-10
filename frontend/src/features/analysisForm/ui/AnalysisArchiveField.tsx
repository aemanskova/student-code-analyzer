import type { UploadedArchiveInfo } from "@features/archiveUpload"
import { ArchiveUploadStep } from "@features/archiveUpload"
import { FileInput } from "@mantine/core"
import { Controller, type UseFormReturn } from "react-hook-form"

import type { AnalysisFormValues } from "../model"

type Props = {
  disabled: boolean
  form: UseFormReturn<AnalysisFormValues>
  restoredArchiveName?: string
  setRunFormError: (value: string | null) => void
  resetAnalyzeError: () => void
  setUploadedArchive: (value: UploadedArchiveInfo | null) => void
}

export function AnalysisArchiveField({
  disabled,
  form,
  resetAnalyzeError,
  restoredArchiveName,
  setRunFormError,
  setUploadedArchive
}: Props) {
  const archive = form.watch("archive")

  return (
    <>
      <Controller
        control={form.control}
        name="archive"
        render={({ field, fieldState }) => (
          <FileInput
            accept=".zip"
            error={fieldState.error?.message}
            label="ZIP-архив"
            placeholder={restoredArchiveName || "Выберите архив"}
            disabled={disabled}
            value={field.value}
            onChange={(value) => {
              if (disabled) {
                return
              }
              field.onChange(value)
              setUploadedArchive(null)
              setRunFormError(null)
              resetAnalyzeError()
              form.clearErrors()
            }}
          />
        )}
      />

      <ArchiveUploadStep
        disabled={disabled}
        file={archive}
        restoredArchiveName={restoredArchiveName}
        onUploaded={(uploaded) => {
          setUploadedArchive(uploaded)
          setRunFormError(null)
          resetAnalyzeError()
        }}
      />
    </>
  )
}
