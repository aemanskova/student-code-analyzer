import {
  type AnalysisRunResult,
  DIRECTION_OPTIONS,
  METRICS_BY_DIRECTION,
  useAnalysisFormModel
} from "@features/analysisForm/model"
import { ArchiveUploadStep } from "@features/archiveUpload"
import {
  Alert,
  Button,
  Checkbox,
  FileInput,
  Group,
  MultiSelect,
  NumberInput,
  Select,
  Stack
} from "@mantine/core"
import { getApiErrorMessage } from "@shared/lib"
import { useEffect } from "react"
import { Controller, useWatch } from "react-hook-form"

import type { AnalysisFormValues } from "../model"

type Props = {
  initialValues?: Partial<AnalysisFormValues>
  locked?: boolean
  restoredArchiveName?: string
  onQueryStateChange?: (
    values: Pick<AnalysisFormValues, "depth" | "direction" | "includeGitMetrics" | "recursive">
  ) => void
  onSuccess: (result: AnalysisRunResult) => void
}

export function AnalysisForm({
  initialValues,
  locked = false,
  restoredArchiveName,
  onQueryStateChange,
  onSuccess
}: Props) {
  const {
    analyzeError,
    form,
    isAnalyzing,
    onSubmit,
    resetAnalyzeError,
    runFormError,
    setRunFormError,
    setUploadedArchive,
    uploadedArchive
  } = useAnalysisFormModel({ initialValues, onSuccess })

  const direction = useWatch({ control: form.control, name: "direction" })
  const recursive = useWatch({ control: form.control, name: "recursive" })
  const archive = useWatch({ control: form.control, name: "archive" })
  const depth = useWatch({ control: form.control, name: "depth" })
  const includeGitMetrics = useWatch({ control: form.control, name: "includeGitMetrics" })
  const controlsDisabled = locked || isAnalyzing

  useEffect(() => {
    onQueryStateChange?.({ depth, direction, includeGitMetrics, recursive })
  }, [depth, direction, includeGitMetrics, onQueryStateChange, recursive])

  return (
    <Stack gap="md">
      <Controller
        control={form.control}
        name="archive"
        render={({ field, fieldState }) => (
          <FileInput
            accept=".zip"
            error={fieldState.error?.message}
            label="ZIP-архив"
            placeholder={restoredArchiveName || "Выберите архив"}
            disabled={controlsDisabled}
            value={field.value}
            onChange={(value) => {
              if (controlsDisabled) {
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
        disabled={controlsDisabled}
        file={archive}
        restoredArchiveName={restoredArchiveName}
        onUploaded={(uploaded) => {
          setUploadedArchive(uploaded)
          setRunFormError(null)
          resetAnalyzeError()
        }}
      />

      <Controller
        control={form.control}
        name="direction"
        render={({ field }) => (
          <Select
            data={DIRECTION_OPTIONS}
            disabled={controlsDisabled}
            label="Направление"
            value={field.value}
            onChange={(value) => field.onChange(value || "html_css")}
          />
        )}
      />

      <Controller
        control={form.control}
        name="metrics"
        render={({ field }) => (
          <MultiSelect
            clearable
            data={METRICS_BY_DIRECTION[direction]}
            disabled={controlsDisabled}
            label="Метрики"
            placeholder="Выберите метрики"
            searchable
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={form.control}
        name="recursive"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            disabled={controlsDisabled}
            label="Рекурсивный режим"
            onChange={(event) => {
              const checked = event.currentTarget.checked
              field.onChange(checked)
              if (!checked) {
                form.setValue("depth", undefined, { shouldDirty: true, shouldValidate: true })
              }
            }}
          />
        )}
      />

      {recursive ? (
        <Controller
          control={form.control}
          name="depth"
          render={({ field, fieldState }) => (
            <NumberInput
              error={fieldState.error?.message}
              disabled={controlsDisabled}
              label="Глубина"
              min={1}
              value={field.value}
              onChange={(value) => field.onChange(typeof value === "number" ? value : undefined)}
            />
          )}
        />
      ) : null}

      <Controller
        control={form.control}
        name="includeGitMetrics"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            disabled={controlsDisabled}
            label="Дополнительно посчитать Git-метрики"
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />

      {runFormError ? <Alert color="red">{runFormError}</Alert> : null}
      {analyzeError ? (
        <Alert color="red">
          {getApiErrorMessage(analyzeError, "Не удалось запустить анализ. Повторите попытку.")}
        </Alert>
      ) : null}

      <Group justify="flex-end">
        <Button disabled={!uploadedArchive || locked} loading={isAnalyzing} onClick={onSubmit}>
          Запустить анализ
        </Button>
      </Group>
    </Stack>
  )
}
