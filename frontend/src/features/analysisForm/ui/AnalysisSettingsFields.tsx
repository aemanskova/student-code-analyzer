import { DIRECTION_OPTIONS } from "@features/analysisForm/model"
import { Checkbox, MultiSelect, NumberInput, Select } from "@mantine/core"
import { Controller, type UseFormReturn } from "react-hook-form"

import type { AnalysisFormValues } from "../model"

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
          <MultiSelect
            clearable
            data={metricsOptions}
            disabled={disabled || !direction}
            label="Метрики"
            placeholder={direction ? "Выберите метрики" : "Сначала выберите направление"}
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
