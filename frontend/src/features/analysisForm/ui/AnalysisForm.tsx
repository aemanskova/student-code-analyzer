import {
  type AnalysisRunResult,
  DIRECTION_OPTIONS,
  ESLINT_METRIC_SET,
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
import { useEffect, useMemo } from "react"
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

const ESLINT_CONFIG_EXTENSIONS = new Set(["js", "mjs", "cjs"])

const getEslintConfigFormat = (fileName: string): AnalysisFormValues["eslintConfigFormat"] => {
  const extension = fileName.split(".").pop()?.toLowerCase()
  return ESLINT_CONFIG_EXTENSIONS.has(extension || "")
    ? (extension as AnalysisFormValues["eslintConfigFormat"])
    : undefined
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
  const eslintConfigText = useWatch({ control: form.control, name: "eslintConfigText" })
  const selectedMetrics = useWatch({ control: form.control, name: "metrics" }) || []
  const controlsDisabled = locked || isAnalyzing
  const hasEslintConfig = direction === "js" && Boolean(eslintConfigText?.trim())
  const metricsOptions = useMemo(() => {
    if (!direction) {
      return []
    }
    const directionMetrics = METRICS_BY_DIRECTION[direction]
    if (direction !== "js" || hasEslintConfig) {
      return directionMetrics
    }
    return directionMetrics.filter((metric) => !ESLINT_METRIC_SET.has(metric))
  }, [direction, hasEslintConfig])

  useEffect(() => {
    onQueryStateChange?.({ depth, direction, includeGitMetrics, recursive })
  }, [depth, direction, includeGitMetrics, onQueryStateChange, recursive])

  useEffect(() => {
    const unavailableSelectedMetrics = selectedMetrics.filter(
      (metric) => !metricsOptions.includes(metric)
    )
    if (unavailableSelectedMetrics.length) {
      form.setValue(
        "metrics",
        selectedMetrics.filter((metric) => metricsOptions.includes(metric)),
        { shouldDirty: true }
      )
    }
  }, [form, metricsOptions, selectedMetrics])

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
        render={({ field, fieldState }) => (
          <Select
            data={DIRECTION_OPTIONS}
            disabled={controlsDisabled}
            error={fieldState.error?.message}
            label="Направление"
            placeholder="Выберите направление"
            value={field.value}
            onChange={(value) => {
              field.onChange(value)
              form.setValue("metrics", [], { shouldDirty: true })
              form.setValue("eslintConfigText", "", { shouldDirty: true })
              form.setValue("eslintConfigFormat", undefined, { shouldDirty: true })
            }}
          />
        )}
      />

      <Controller
        control={form.control}
        name="metrics"
        render={({ field }) => (
          <MultiSelect
            clearable
            data={metricsOptions}
            disabled={controlsDisabled || !direction}
            label="Метрики"
            placeholder={direction ? "Выберите метрики" : "Сначала выберите направление"}
            searchable
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />

      {direction === "js" ? (
        <Stack gap="xs">
          <Controller
            control={form.control}
            name="eslintConfigText"
            render={({ field, fieldState }) => (
              <FileInput
                accept=".js,.mjs,.cjs"
                disabled={controlsDisabled}
                error={fieldState.error?.message}
                label="ESLint config"
                placeholder="Загрузите eslint.config.js, .mjs или .cjs"
                description="Для подсчета метрик ошибок и предупреждений линтера загрузите ESLint конфиг."
                onChange={(file) => {
                  if (!file) {
                    field.onChange("")
                    form.setValue("eslintConfigFormat", undefined, { shouldDirty: true })
                    return
                  }

                  const format = getEslintConfigFormat(file.name)
                  if (!format) {
                    form.setError("eslintConfigText", {
                      message: "Поддерживаются только файлы .js, .mjs и .cjs"
                    })
                    return
                  }

                  form.setValue("eslintConfigFormat", format, { shouldDirty: true })
                  file
                    .text()
                    .then((text) => {
                      field.onChange(text)
                      form.clearErrors("eslintConfigText")
                    })
                    .catch(() => {
                      form.setError("eslintConfigText", {
                        message: "Не удалось прочитать ESLint config"
                      })
                    })
                }}
              />
            )}
          />
        </Stack>
      ) : null}

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
