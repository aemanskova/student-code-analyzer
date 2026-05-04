import type { Direction } from "@entities/analysis/api"
import { getAnalysisDirectionLabel } from "@entities/analysis/model/direction"
import { Card, Grid, Loader, MultiSelect, Select, Stack, Text, Title } from "@mantine/core"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"

type LevelOption = {
  level: number
  multi: boolean
  options: string[]
}

type Props = {
  levels: LevelOption[]
  cascadedOptions: string[][]
  draftLevels: string[][]
  selectedLevels: string[][]
  direction?: Direction
  pathsCount: number
  isLoading: boolean
  isResolved: boolean
  onBlurLevel: (index: number) => void
  onChangeLevel: (index: number, values: string[]) => void
}

type AnalysisFiltersForm = {
  levels: string[][]
}

export const AnalysisFiltersPanel = ({
  levels,
  cascadedOptions,
  draftLevels,
  selectedLevels,
  direction,
  pathsCount,
  isLoading,
  isResolved,
  onBlurLevel,
  onChangeLevel
}: Props) => {
  const form = useForm<AnalysisFiltersForm>({
    defaultValues: {
      levels: draftLevels.length ? draftLevels : selectedLevels
    }
  })

  useEffect(() => {
    form.reset({ levels: draftLevels.length ? draftLevels : selectedLevels })
  }, [draftLevels, form, selectedLevels])

  return (
    <Grid align="stretch" gutter="md">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Card>
          <Stack gap="md">
            <Title order={3}>Аналитический отчет</Title>

            {levels.length > 0 ? (
              levels.map((level) => {
                const index = level.level - 1
                const options =
                  index === 0
                    ? cascadedOptions[index]?.length
                      ? cascadedOptions[index]
                      : level.options
                    : cascadedOptions[index] || []
                const data = options.map((value) => ({ value, label: value }))
                const value = draftLevels[index] || selectedLevels[index] || []

                if (!level.multi) {
                  return (
                    <Controller
                      key={`shared-level-${level.level}`}
                      control={form.control}
                      name={`levels.${index}`}
                      render={({ field }) => (
                        <Select
                          data={data}
                          disabled={isLoading}
                          label={`Уровень ${level.level}`}
                          readOnly
                          rightSection={isLoading ? <Loader size="xs" /> : undefined}
                          value={field.value?.[0] || value[0] || null}
                          onChange={() => undefined}
                        />
                      )}
                    />
                  )
                }

                return (
                  <Controller
                    key={`shared-level-${level.level}`}
                    control={form.control}
                    name={`levels.${index}`}
                    render={({ field }) => (
                      <MultiSelect
                        clearable
                        data={data}
                        disabled={isLoading}
                        label={`Уровень ${level.level}`}
                        placeholder={isLoading ? "Загрузка..." : "Выберите подпапки"}
                        rightSection={isLoading ? <Loader size="xs" /> : undefined}
                        searchable
                        value={field.value || value}
                        onBlur={() => onBlurLevel(index)}
                        onChange={(values) => {
                          field.onChange(values)
                          onChangeLevel(index, values)
                        }}
                        onDropdownClose={() => onBlurLevel(index)}
                      />
                    )}
                  />
                )
              })
            ) : (
              <Controller
                control={form.control}
                name="levels.0"
                render={() => (
                  <Select
                    data={[]}
                    disabled
                    label="Уровень 1"
                    placeholder={
                      !isResolved || isLoading ? "Загрузка фильтров..." : "Нет доступных значений"
                    }
                    rightSection={isLoading ? <Loader size="xs" /> : undefined}
                  />
                )}
              />
            )}
          </Stack>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card p="md">
          <Stack gap="md">
            <Text c="dimmed" size="sm">
              Параметры среза
            </Text>
            <Text fw={600}>Уровней доступно: {levels.length || 1}</Text>
            <Text size="sm">Направление: {getAnalysisDirectionLabel(direction)}</Text>
            <Text size="sm">Папок в срезе: {pathsCount}</Text>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  )
}
