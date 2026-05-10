import { getEslintConfigFormat } from "@features/analysisForm/model"
import { FileInput, Group } from "@mantine/core"
import { Controller, type UseFormReturn } from "react-hook-form"

import type { AnalysisFormValues } from "../model"
import { EslintConfigInfoPopover } from "./EslintConfigInfoPopover"

type Props = {
  disabled: boolean
  form: UseFormReturn<AnalysisFormValues>
}

const eslintConfigLabel = (
  <Group gap={6} wrap="nowrap">
    <span>ESLint config</span>
    <EslintConfigInfoPopover />
  </Group>
)

export function EslintConfigInput({ disabled, form }: Props) {
  return (
    <Controller
      control={form.control}
      name="eslintConfigText"
      render={({ field, fieldState }) => (
        <FileInput
          accept=".js,.mjs,.cjs"
          disabled={disabled}
          error={fieldState.error?.message}
          label={eslintConfigLabel}
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
  )
}
