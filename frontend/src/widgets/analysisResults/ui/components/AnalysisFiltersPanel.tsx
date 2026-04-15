import { Card, Grid, Loader, MultiSelect, Select, Stack, Text, Title } from "@mantine/core"

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
  pathsCount: number
  isLoading: boolean
  isResolved: boolean
  onBlurLevel: (index: number) => void
  onChangeLevel: (index: number, values: string[]) => void
}

export const AnalysisFiltersPanel = ({
  levels,
  cascadedOptions,
  draftLevels,
  selectedLevels,
  pathsCount,
  isLoading,
  isResolved,
  onBlurLevel,
  onChangeLevel
}: Props) => {
  return (
    <Grid align="stretch" gutter="md">
      <Grid.Col span={{ base: 12, md: 8 }}>
        <Card>
          <Stack gap="xs">
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
                    <Select
                      key={`shared-level-${level.level}`}
                      data={data}
                      disabled={isLoading}
                      label={`Уровень ${level.level}`}
                      readOnly
                      rightSection={isLoading ? <Loader size="xs" /> : undefined}
                      value={value[0] || null}
                      onChange={() => undefined}
                    />
                  )
                }

                return (
                  <MultiSelect
                    key={`shared-level-${level.level}`}
                    clearable
                    data={data}
                    disabled={isLoading}
                    label={`Уровень ${level.level}`}
                    placeholder={isLoading ? "Загрузка..." : "Выберите подпапки"}
                    rightSection={isLoading ? <Loader size="xs" /> : undefined}
                    searchable
                    value={value}
                    onBlur={() => onBlurLevel(index)}
                    onChange={(values) => onChangeLevel(index, values)}
                    onDropdownClose={() => onBlurLevel(index)}
                  />
                )
              })
            ) : (
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
          </Stack>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 4 }}>
        <Card p="md">
          <Stack gap={6}>
            <Text c="dimmed" size="sm">
              Параметры среза
            </Text>
            <Text fw={600}>Уровней доступно: {levels.length || 1}</Text>
            <Text size="sm">Папок в срезе: {pathsCount}</Text>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  )
}
