import {
  type AnalysisRunResult,
  ESLINT_METRIC_SET,
  METRICS_BY_DIRECTION,
  supportsEslintConfig,
  useAnalysisFormModel
} from "@features/analysisForm/model"
import { Alert, Button, Group, Stack } from "@mantine/core"
import { getApiErrorMessage } from "@shared/lib"
import { useEffect, useMemo } from "react"
import { useWatch } from "react-hook-form"

import type { AnalysisFormValues } from "../model"
import { AnalysisArchiveField } from "./AnalysisArchiveField"
import { AnalysisSettingsFields } from "./AnalysisSettingsFields"
import { EslintConfigInput } from "./EslintConfigInput"

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
  const depth = useWatch({ control: form.control, name: "depth" })
  const includeGitMetrics = useWatch({ control: form.control, name: "includeGitMetrics" })
  const eslintConfigText = useWatch({ control: form.control, name: "eslintConfigText" })
  const selectedMetrics = useWatch({ control: form.control, name: "metrics" })
  const controlsDisabled = locked || isAnalyzing
  const canUseEslintConfig = supportsEslintConfig(direction)
  const hasEslintConfig = canUseEslintConfig && Boolean(eslintConfigText?.trim())

  const metricsOptions = useMemo(() => {
    if (!direction) {
      return []
    }
    const directionMetrics = METRICS_BY_DIRECTION[direction]
    if (!supportsEslintConfig(direction) || hasEslintConfig) {
      return directionMetrics
    }
    return directionMetrics.filter((metric) => !ESLINT_METRIC_SET.has(metric))
  }, [direction, hasEslintConfig])

  useEffect(() => {
    onQueryStateChange?.({ depth, direction, includeGitMetrics, recursive })
  }, [depth, direction, includeGitMetrics, onQueryStateChange, recursive])

  useEffect(() => {
    const currentMetrics = selectedMetrics || []
    const unavailableSelectedMetrics = currentMetrics.filter(
      (metric) => !metricsOptions.includes(metric)
    )
    if (unavailableSelectedMetrics.length) {
      form.setValue(
        "metrics",
        currentMetrics.filter((metric) => metricsOptions.includes(metric)),
        { shouldDirty: true }
      )
    }
  }, [form, metricsOptions, selectedMetrics])

  return (
    <Stack gap="md">
      <AnalysisArchiveField
        disabled={controlsDisabled}
        form={form}
        restoredArchiveName={restoredArchiveName}
        resetAnalyzeError={resetAnalyzeError}
        setRunFormError={setRunFormError}
        setUploadedArchive={setUploadedArchive}
      />

      <AnalysisSettingsFields
        disabled={controlsDisabled}
        direction={direction}
        form={form}
        metricsOptions={metricsOptions}
        recursive={recursive}
      />

      {canUseEslintConfig ? <EslintConfigInput disabled={controlsDisabled} form={form} /> : null}

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
