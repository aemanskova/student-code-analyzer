import { useRunS3AsyncMutation } from "@entities/analysis/api"
import {
  type AnalysisFormValues,
  type AnalysisRunResult,
  analysisSchema,
  DIRECTION_OPTIONS,
  METRICS_BY_DIRECTION
} from "@features/analysisForm/model"
import { ArchiveUploadStep, type UploadedArchiveInfo } from "@features/archiveUpload"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

type Props = {
  onSuccess: (result: AnalysisRunResult) => void
}

export function AnalysisForm({ onSuccess }: Props) {
  const [runS3Async, { isLoading: isAnalyzing, error: analyzeError }] = useRunS3AsyncMutation()
  const [uploadedArchive, setUploadedArchive] = useState<UploadedArchiveInfo | null>(null)
  const [runFormError, setRunFormError] = useState<string | null>(null)

  const form = useForm<AnalysisFormValues>({
    resolver: zodResolver(analysisSchema),
    mode: "onBlur",
    defaultValues: {
      archive: null,
      direction: "html_css",
      metrics: [],
      recursive: false,
      depth: undefined
    }
  })

  const direction = form.watch("direction")
  const recursive = form.watch("recursive")
  const archive = form.watch("archive")

  const onSubmit = form.handleSubmit(async (values) => {
    if (!uploadedArchive || isAnalyzing) {
      setRunFormError("Сначала загрузите архив в хранилище.")
      return
    }

    setRunFormError(null)
    try {
      const request = {
        key: uploadedArchive.key,
        direction: values.direction,
        metrics: values.metrics.length > 0 ? values.metrics : undefined,
        r: values.recursive,
        depth: values.recursive ? values.depth : undefined
      }
      const response = await runS3Async(request).unwrap()
      onSuccess({
        response,
        request
      })
    } catch (e) {
      console.error(e)
    }
  })

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
            placeholder="Выберите архив"
            value={field.value}
            onChange={(value) => {
              field.onChange(value)
              setUploadedArchive(null)
              setRunFormError(null)
            }}
          />
        )}
      />

      <ArchiveUploadStep
        disabled={isAnalyzing}
        file={archive}
        onUploaded={(uploaded) => {
          setUploadedArchive(uploaded)
          setRunFormError(null)
        }}
      />

      <Controller
        control={form.control}
        name="direction"
        render={({ field }) => (
          <Select
            data={DIRECTION_OPTIONS}
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
            label="Рекурсивный режим"
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />

      {recursive && (
        <Controller
          control={form.control}
          name="depth"
          render={({ field, fieldState }) => (
            <NumberInput
              error={fieldState.error?.message}
              label="Глубина"
              min={1}
              value={field.value}
              onChange={(value) => field.onChange(typeof value === "number" ? value : undefined)}
            />
          )}
        />
      )}

      {runFormError && <Alert color="red">{runFormError}</Alert>}
      {analyzeError && (
        <Alert color="red">
          {getApiErrorMessage(analyzeError, "Не удалось запустить анализ. Повторите попытку.")}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button disabled={!uploadedArchive} loading={isAnalyzing} onClick={onSubmit}>
          Запустить анализ
        </Button>
      </Group>
    </Stack>
  )
}
