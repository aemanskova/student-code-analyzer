import { DIRECTION_OPTIONS } from "@features/analysisForm/model"
import { getMetricLabel } from "@entities/glossary"
import { Checkbox, NumberInput, Select } from "@mantine/core"
import { AllOptionsMultiSelect } from "@shared/ui"
import { Controller, type UseFormReturn } from "react-hook-form"

import type { AnalysisFormValues } from "../model"

const ALL_ANALYSIS_METRICS_VALUE = "__all_analysis_metrics__"

type Props = {
  disabled: boolean
  direction: AnalysisFormValues["direction"]
  form: UseFormReturn<AnalysisFormValues>
  metricsOptions: string[]
  recursive: boolean
}

export function AnalysisSettingsFields({
  disabled,
  direction,
  form,
  metricsOptions,
  recursive
}: Props) {
  return (
    <>
      <Controller
        control={form.control}
        name="direction"
        render={({ field, fieldState }) => (
          <Select
            data={DIRECTION_OPTIONS}
            disabled={disabled}
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
          <AllOptionsMultiSelect
            allLabel="Все метрики"
            allValue={ALL_ANALYSIS_METRICS_VALUE}
            clearable
            options={metricsOptions.map((metric) => ({
              label: getMetricLabel(metric),
              value: metric
            }))}
            disabled={disabled || !direction}
            label="Метрики"
            placeholder={direction ? "Выберите метрики" : "Сначала выберите направление"}
            searchable
            value={direction && field.value.length ? field.value : [ALL_ANALYSIS_METRICS_VALUE]}
            onChange={(value) => {
              field.onChange(value.includes(ALL_ANALYSIS_METRICS_VALUE) ? [] : value)
            }}
          />
        )}
      />

      <Controller
        control={form.control}
        name="recursive"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            disabled={disabled}
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
              disabled={disabled}
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
            disabled={disabled}
            label="Дополнительно посчитать Git-метрики"
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
    </>
  )
}
